/**
 * Storefront state: catalogue (from the API), cart, favourites, applied
 * promo code and toast notifications. Cart + favourites persist in
 * localStorage so they survive reloads in both API and demo modes.
 */
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { calculateTotals } from '@nova/shared';
import { api } from '../api/index.js';

const CART_KEY = 'nova-store:cart:v2';
const ShopContext = createContext(null);

function loadCart() {
  try {
    const saved = JSON.parse(localStorage.getItem(CART_KEY) || 'null');
    if (saved && Array.isArray(saved.cart)) return saved;
  } catch { /* ignore */ }
  // First visit: the same three items as on the checkout screenshot
  return {
    cart: [
      { id: 'aura-pro-anc', color: 'lavender', qty: 1 },
      { id: 'pulse-s2', color: 'lavender', qty: 1 },
      { id: 'hydro', color: 'cyan', qty: 1 },
    ],
    favs: ['lumen-x'],
    promo: null,
  };
}

export function ShopProvider({ children }) {
  const [catalog, setCatalog] = useState({ status: 'loading', categories: [], products: [], settings: { freeDeliveryFrom: 3000 }, error: null });
  const [saved, setSaved] = useState(loadCart);
  const [toasts, setToasts] = useState([]);
  const toastId = useRef(0);

  /* -- catalogue ----------------------------------------------------- */
  const reloadCatalog = useCallback(async () => {
    try {
      const data = await api.catalog();
      setCatalog({ status: 'ready', ...data, error: null });
    } catch (err) {
      setCatalog((c) => ({ ...c, status: 'error', error: err.message }));
    }
  }, []);
  useEffect(() => { reloadCatalog(); }, [reloadCatalog]);

  /* -- persistence --------------------------------------------------- */
  useEffect(() => {
    try { localStorage.setItem(CART_KEY, JSON.stringify(saved)); } catch { /* ignore */ }
  }, [saved]);

  /* -- toasts -------------------------------------------------------- */
  const toast = useCallback((message, icon = 'check') => {
    toastId.current += 1;
    const id = toastId.current;
    setToasts((t) => [...t, { id, message, icon }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 2600);
  }, []);

  /* -- derived ------------------------------------------------------- */
  const productById = useMemo(() => new Map(catalog.products.map((p) => [p.id, p])), [catalog.products]);
  const lines = useMemo(
    () => saved.cart
      .map((l, index) => {
        const product = productById.get(l.id);
        return product ? { ...l, index, product, sum: product.price * l.qty } : null;
      })
      .filter(Boolean),
    [saved.cart, productById],
  );

  const totals = useCallback(
    (deliveryKey = 'courier') => calculateTotals({
      lines,
      promo: saved.promo,
      deliveryKey,
      freeDeliveryFrom: catalog.settings.freeDeliveryFrom,
    }),
    [lines, saved.promo, catalog.settings.freeDeliveryFrom],
  );

  /* -- actions ------------------------------------------------------- */
  const addToCart = useCallback((id, color, qty = 1) => {
    const product = productById.get(id);
    if (!product) return;
    const c = color || product.colors[0];
    setSaved((s) => {
      const cart = s.cart.map((l) => ({ ...l }));
      const line = cart.find((l) => l.id === id && l.color === c);
      if (line) line.qty = Math.min(99, line.qty + qty);
      else cart.push({ id, color: c, qty });
      return { ...s, cart };
    });
    toast(`«${product.name}» в корзине`, 'cart');
  }, [productById, toast]);

  const setQty = useCallback((index, qty) => {
    setSaved((s) => {
      const cart = [...s.cart];
      if (qty <= 0) cart.splice(index, 1);
      else cart[index] = { ...cart[index], qty: Math.min(99, qty) };
      return { ...s, cart, promo: cart.length ? s.promo : null };
    });
  }, []);

  const toggleFav = useCallback((id) => {
    let on = false;
    setSaved((s) => {
      on = !s.favs.includes(id);
      return { ...s, favs: on ? [...s.favs, id] : s.favs.filter((f) => f !== id) };
    });
    // state updater runs synchronously for this event, so `on` is set
    setTimeout(() => toast(on ? 'Добавлено в избранное' : 'Удалено из избранного', 'heart'), 0);
  }, [toast]);

  /** Validates the code with the API and stores its terms for live totals. */
  const applyPromo = useCallback(async (code) => {
    const result = await api.validatePromo(code, lines);
    if (!result.ok) return result;
    setSaved((s) => ({ ...s, promo: { code: result.code, label: result.label, percent: result.percent, scope: result.scope, min: result.min, active: true } }));
    toast(`Промокод применён: ${result.label}`, 'percent');
    return result;
  }, [lines, toast]);

  const removePromo = useCallback(() => setSaved((s) => ({ ...s, promo: null })), []);
  const clearCart = useCallback(() => setSaved((s) => ({ ...s, cart: [], promo: null })), []);

  const value = useMemo(() => ({
    catalog, reloadCatalog, productById,
    cart: saved.cart, favs: saved.favs, promo: saved.promo, lines, totals,
    cartCount: saved.cart.reduce((s, l) => s + l.qty, 0),
    addToCart, setQty, toggleFav, applyPromo, removePromo, clearCart,
    toasts, toast,
  }), [catalog, reloadCatalog, productById, saved, lines, totals, addToCart, setQty, toggleFav, applyPromo, removePromo, clearCart, toasts, toast]);

  return <ShopContext.Provider value={value}>{children}</ShopContext.Provider>;
}

export function useShop() {
  const ctx = useContext(ShopContext);
  if (!ctx) throw new Error('useShop must be used inside <ShopProvider>');
  return ctx;
}
