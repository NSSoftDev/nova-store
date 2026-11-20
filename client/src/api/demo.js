/**
 * Demo adapter — the same interface as httpApi, backed by localStorage.
 * Used for the static build (`npm run build:demo`) hosted on nssoftdev.com:
 * the full shop + admin run in the browser without the Node.js API.
 * Business rules mirror the server: totals via @nova/shared, stock checks,
 * hidden products, promo activation, free-delivery setting.
 */
import {
  CATEGORIES, DEFAULT_SETTINGS, PAYMENT_METHODS, PRODUCTS, PROMO_LIST, SEED_ORDERS,
  aggregateCustomers, buildHistory, calculateTotals, computeStats, salesBreakdown, slugify, validatePromo,
} from '@nova/shared';
import { ApiError } from './http.js';

const KEY = 'nova-store:demo-db:v2';
const HISTORY = buildHistory();

function fresh() {
  return {
    products: PRODUCTS.map((p) => ({ ...p, hidden: false })),
    promos: PROMO_LIST.map((p) => ({ ...p })),
    orders: SEED_ORDERS.map((o) => ({ ...o, createdAt: new Date(`${o.date}+03:00`).toISOString(), source: 'seed', items: [] })),
    settings: { ...DEFAULT_SETTINGS },
    nextOrder: 48214,
  };
}

function load() {
  try {
    const saved = JSON.parse(localStorage.getItem(KEY) || 'null');
    if (saved && Array.isArray(saved.products)) return saved;
  } catch { /* corrupted or disabled storage */ }
  return fresh();
}

let db = load();
const save = () => { try { localStorage.setItem(KEY, JSON.stringify(db)); } catch { /* quota / private mode */ } };

/** Small artificial latency so loading states are exercised like with a real API. */
const delay = (value) => new Promise((resolve) => { setTimeout(() => resolve(structuredClone(value)), 120); });
const fail = (status, message) => Promise.reject(new ApiError(status, message));

function pricedLines(items) {
  return items.map((i) => {
    const product = db.products.find((p) => p.id === i.id);
    if (!product || product.hidden) throw new ApiError(400, `Товар ${i.id} недоступен`);
    return { product, qty: i.qty, color: i.color };
  });
}

// Keep several open tabs (shop + admin) consistent
window.addEventListener('storage', (e) => { if (e.key === KEY) db = load(); });

export const demoApi = {
  mode: 'demo',
  requiresLogin: false,
  hasAdminToken: () => true,
  login: async () => true,
  logout() {},

  catalog: () => delay({
    categories: CATEGORIES,
    products: db.products.filter((p) => !p.hidden),
    settings: { freeDeliveryFrom: db.settings.freeDeliveryFrom },
  }),

  async validatePromo(code, lines) {
    const promo = db.promos.find((p) => p.code === String(code).trim().toUpperCase());
    try {
      const result = validatePromo(promo, pricedLines(lines));
      return delay(result.ok ? { ...result, ...promo } : { ...result, code: String(code).trim().toUpperCase() });
    } catch (err) { return Promise.reject(err); }
  },

  async createOrder(payload) {
    let lines;
    try { lines = pricedLines(payload.items); } catch (err) { return Promise.reject(err); }
    const need = new Map();
    lines.forEach((l) => need.set(l.product.id, (need.get(l.product.id) || 0) + l.qty));
    for (const [id, qty] of need) {
      const p = db.products.find((x) => x.id === id);
      if (p.stock < qty) return fail(409, `«${p.name}»: в наличии только ${p.stock} шт.`);
    }
    let promo = null;
    if (payload.promo) {
      promo = db.promos.find((p) => p.code === payload.promo);
      const check = validatePromo(promo, lines);
      if (!check.ok) return fail(400, `Промокод: ${check.message}`);
    }
    const totals = calculateTotals({ lines, promo, deliveryKey: payload.delivery.method, freeDeliveryFrom: db.settings.freeDeliveryFrom });
    const order = {
      id: `NS-${db.nextOrder}`,
      customer: payload.customer.name,
      phone: payload.customer.phone,
      delivery: payload.delivery,
      payment: PAYMENT_METHODS[payload.payment.method].short,
      promo: promo ? promo.code : undefined,
      subtotal: totals.subtotal,
      discount: totals.discount,
      deliveryPrice: totals.delivery,
      total: totals.total,
      status: 'processing',
      source: 'web',
      createdAt: new Date().toISOString(),
      items: lines.map((l) => ({ id: l.product.id, name: l.product.name, color: l.color, qty: l.qty, unitPrice: l.product.price, sum: l.product.price * l.qty })),
    };
    db.nextOrder += 1;
    db.orders.unshift(order);
    for (const [id, qty] of need) {
      const p = db.products.find((x) => x.id === id);
      p.stock -= qty;
      p.sold += qty;
    }
    save();
    return delay(order);
  },

  adminProducts: () => delay(db.products),

  createProduct(data) {
    const product = {
      id: `${slugify(data.name)}-${Date.now().toString(36).slice(-4)}`,
      name: data.name.trim(),
      brand: data.name.trim().split(/\s+/)[1] || 'Nova',
      cat: data.cat,
      kind: data.kind,
      price: Number(data.price),
      rating: 5,
      reviews: 0,
      badge: 'new',
      audio: Boolean(data.audio),
      stock: Number(data.stock),
      sold: 0,
      added: Math.max(...db.products.map((p) => p.added)) + 1,
      colors: [data.color, ...['lavender', 'graphite'].filter((c) => c !== data.color)],
      desc: 'Новый товар, добавленный через Nova Admin.',
      specs: { 'Категория': CATEGORIES.find((c) => c.id === data.cat).name },
      hidden: false,
    };
    db.products.unshift(product);
    save();
    return delay(product);
  },

  updateProduct(id, patch) {
    const p = db.products.find((x) => x.id === id);
    if (!p) return fail(404, 'Товар не найден');
    Object.assign(p, patch);
    save();
    return delay(p);
  },

  orders: () => delay([...db.orders].sort((a, b) => b.createdAt.localeCompare(a.createdAt))),

  updateOrder(id, status) {
    const o = db.orders.find((x) => x.id === id);
    if (!o) return fail(404, 'Заказ не найден');
    o.status = status;
    save();
    return delay(o);
  },

  stats(range) {
    const web = db.orders.filter((o) => o.source === 'web' && o.status !== 'returned');
    return delay(computeStats(HISTORY, range, { revenue: web.reduce((s, o) => s + o.total, 0), orders: web.length }));
  },
  customers: () => delay(aggregateCustomers(db.orders)),
  sales: () => delay(salesBreakdown(db.products, db.orders)),
  promos: () => delay(db.promos),

  setPromoActive(code, active) {
    const p = db.promos.find((x) => x.code === code);
    if (!p) return fail(404, 'Промокод не найден');
    p.active = active;
    save();
    return delay(p);
  },

  updateSettings(patch) {
    Object.assign(db.settings, patch);
    save();
    return delay(db.settings);
  },

  /** Demo only: wipe everything back to the seed. */
  reset() {
    db = fresh();
    save();
  },
};
