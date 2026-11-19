/* ==========================================================================
   Nova Store — store.js
   --------------------------------------------------------------------------
   Application state + shared helpers:
     • escaping-safe HTML templating (Nova.html / Nova.raw)
     • ru-RU number / money formatting
     • persistent state in localStorage (cart, favourites, orders, admin
       edits, settings) with a tiny pub/sub so views re-render on change
     • pricing engine: subtotal, promo codes, delivery, total
     • toast notifications
   ========================================================================== */
(function () {
  'use strict';

  const Nova = (window.Nova = window.Nova || {});
  const D = Nova.data;
  const STORAGE_KEY = 'nova-store:v1';

  /* ------------------------------------------------------------------
     1. HTML templating with automatic escaping
     html`<p>${userText}</p>` escapes userText; nested html`` results and
     raw() values are inserted as-is. Arrays are joined.
     ------------------------------------------------------------------ */
  const RAW = Symbol('raw');
  const raw = (value) => ({ [RAW]: true, value: String(value) });
  const esc = (v) => String(v).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  function renderValue(v) {
    if (v === null || v === undefined || v === false) return '';
    if (Array.isArray(v)) return v.map(renderValue).join('');
    if (typeof v === 'object' && v[RAW]) return v.value;
    return esc(v);
  }

  Nova.raw = raw;
  Nova.esc = esc;
  Nova.html = function html(strings, ...values) {
    let out = strings[0];
    values.forEach((v, i) => { out += renderValue(v) + strings[i + 1]; });
    return raw(out);
  };

  /* ------------------------------------------------------------------
     2. Formatting
     ------------------------------------------------------------------ */
  const nf = new Intl.NumberFormat('ru-RU');
  Nova.fmt = (n) => nf.format(Math.round(n)).replace(/ /g, ' ');
  Nova.money = (n) => `${Nova.fmt(n)} ₽`;
  Nova.fmtDec = (n, d) => n.toLocaleString('ru-RU', { minimumFractionDigits: d, maximumFractionDigits: d });
  Nova.compactMoney = (n) => {
    if (n >= 1e6) return `${Nova.fmtDec(n / 1e6, 2)} млн ₽`;
    if (n >= 1e3) return `${Nova.fmtDec(n / 1e3, 1)} тыс ₽`;
    return Nova.money(n);
  };
  Nova.plural = (n, one, few, many) => {
    const m10 = n % 10, m100 = n % 100;
    if (m10 === 1 && m100 !== 11) return one;
    if (m10 >= 2 && m10 <= 4 && (m100 < 12 || m100 > 14)) return few;
    return many;
  };
  Nova.initials = (name) => name.split(/\s+/).map((w) => w[0]).join('').slice(0, 2).toUpperCase();

  /* ------------------------------------------------------------------
     3. Persistent state
     ------------------------------------------------------------------ */
  function defaults() {
    return {
      cart: [
        // The screenshots show a cart of 3 items — start with the same set
        { id: 'aura-pro-anc', color: 'lavender', qty: 1 },
        { id: 'pulse-s2', color: 'lavender', qty: 1 },
        { id: 'hydro', color: 'cyan', qty: 1 },
      ],
      favs: ['lumen-x'],
      promo: null,           // applied promo code (string)
      orders: [],            // orders placed by the visitor (newest first)
      customProducts: [],    // products created in the admin
      productEdits: {},      // { id: { price, stock, hidden } } from the admin
      orderStatus: {},       // { orderId: status } overrides from the admin
      promoState: {},        // { CODE: active } overrides from the admin
      settings: { freeDeliveryFrom: 3000, storeName: 'Nova Store', currency: '₽' },
    };
  }

  function load() {
    try {
      const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null');
      if (saved && typeof saved === 'object') return Object.assign(defaults(), saved);
    } catch (e) { /* storage unavailable or corrupted — fall back to defaults */ }
    return defaults();
  }

  const state = load();
  const listeners = new Set();

  function save() {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); } catch (e) { /* private mode / quota */ }
  }

  /** Mutate state through this so it is persisted and views refresh. */
  function update(mutator) {
    mutator(state);
    save();
    listeners.forEach((fn) => fn(state));
  }

  Nova.state = state;
  Nova.update = update;
  Nova.subscribe = (fn) => { listeners.add(fn); return () => listeners.delete(fn); };
  Nova.resetDemo = () => {
    try { localStorage.removeItem(STORAGE_KEY); } catch (e) { /* ignore */ }
    location.hash = '#/';
    location.reload();
  };

  /* ------------------------------------------------------------------
     4. Catalogue access (seed + admin-created products + admin edits)
     ------------------------------------------------------------------ */
  Nova.allProducts = function allProducts(includeHidden) {
    return D.PRODUCTS.concat(state.customProducts)
      .map((p) => Object.assign({}, p, state.productEdits[p.id] || {}))
      .filter((p) => includeHidden || !p.hidden);
  };
  Nova.product = (id) => Nova.allProducts(true).find((p) => p.id === id);
  Nova.category = (id) => D.CATEGORIES.find((c) => c.id === id);
  Nova.palette = (product, colorKey) => {
    const key = colorKey || (product.colors && product.colors[0]) || 'lavender';
    return (D.COLORS[key] || D.COLORS.lavender).palette;
  };
  Nova.discountPercent = (p) => (p.oldPrice ? Math.round((1 - p.price / p.oldPrice) * 100) : 0);

  /* ------------------------------------------------------------------
     5. Cart & favourites
     ------------------------------------------------------------------ */
  Nova.cartCount = () => state.cart.reduce((s, l) => s + l.qty, 0);

  Nova.addToCart = function addToCart(id, color, qty) {
    const product = Nova.product(id);
    if (!product) return;
    const c = color || product.colors[0];
    update((s) => {
      const line = s.cart.find((l) => l.id === id && l.color === c);
      if (line) line.qty = Math.min(line.qty + (qty || 1), 99);
      else s.cart.push({ id, color: c, qty: qty || 1 });
    });
    Nova.toast(`«${product.name}» в корзине`, 'cart');
  };

  Nova.setQty = (index, qty) => update((s) => {
    if (qty <= 0) s.cart.splice(index, 1);
    else s.cart[index].qty = Math.min(qty, 99);
  });

  Nova.toggleFav = (id) => {
    const on = !state.favs.includes(id);
    update((s) => {
      if (on) s.favs.push(id);
      else s.favs = s.favs.filter((f) => f !== id);
    });
    Nova.toast(on ? 'Добавлено в избранное' : 'Удалено из избранного', 'heart');
  };

  /* ------------------------------------------------------------------
     6. Pricing engine
     ------------------------------------------------------------------ */
  Nova.promoDef = (code) => {
    const def = D.PROMOS[code];
    if (!def) return null;
    const active = state.promoState[code] !== undefined ? state.promoState[code] : def.active;
    return active ? def : null;
  };

  /**
   * Validates a promo code against the current cart.
   * @returns {{ok: boolean, message: string}}
   */
  Nova.checkPromo = function checkPromo(code) {
    const c = String(code || '').trim().toUpperCase();
    if (!c) return { ok: false, message: 'Введите промокод' };
    const def = Nova.promoDef(c);
    if (!def) return { ok: false, message: 'Промокод не найден или неактивен' };
    const lines = Nova.cartLines();
    const subtotal = lines.reduce((s, l) => s + l.sum, 0);
    if (def.min && subtotal < def.min) return { ok: false, message: `Действует от ${Nova.money(def.min)}` };
    if (def.scope === 'audio' && !lines.some((l) => l.product.audio)) return { ok: false, message: 'В корзине нет аудиотоваров' };
    return { ok: true, message: def.label };
  };

  /** Cart lines enriched with product data and line sums. */
  Nova.cartLines = () => state.cart
    .map((l) => {
      const product = Nova.product(l.id);
      return product ? { ...l, product, sum: product.price * l.qty } : null;
    })
    .filter(Boolean);

  /**
   * Full order calculation.
   * @param {string} deliveryKey key of D.DELIVERY
   */
  Nova.totals = function totals(deliveryKey) {
    const lines = Nova.cartLines();
    const subtotal = lines.reduce((s, l) => s + l.sum, 0);
    let discount = 0;
    const def = state.promo ? Nova.promoDef(state.promo) : null;
    if (def && (!def.min || subtotal >= def.min)) {
      const base = def.scope === 'audio' ? lines.filter((l) => l.product.audio).reduce((s, l) => s + l.sum, 0) : subtotal;
      discount = Math.round((base * def.percent) / 100);
    }
    const opt = D.DELIVERY[deliveryKey || 'courier'];
    let delivery = opt ? opt.price : 0;
    // Courier delivery becomes free above the threshold set in admin → Settings
    if (deliveryKey !== 'express' && subtotal - discount >= state.settings.freeDeliveryFrom) delivery = 0;
    if (!lines.length) delivery = 0;
    return { lines, subtotal, discount, delivery, total: Math.max(0, subtotal - discount + delivery), count: lines.reduce((s, l) => s + l.qty, 0) };
  };

  /* ------------------------------------------------------------------
     7. Orders (seed + visitor orders, with admin status overrides)
     ------------------------------------------------------------------ */
  Nova.allOrders = () => state.orders.concat(D.SEED_ORDERS).map((o) => Object.assign({}, o, { status: state.orderStatus[o.id] || o.status }));

  Nova.nextOrderId = () => {
    const nums = Nova.allOrders().map((o) => parseInt(o.id.replace(/\D/g, ''), 10));
    return `NS-${Math.max(...nums) + 1}`;
  };

  /* ------------------------------------------------------------------
     8. Toasts
     ------------------------------------------------------------------ */
  Nova.toast = function toast(message, icon) {
    let host = document.getElementById('toasts');
    if (!host) {
      host = document.createElement('div');
      host.id = 'toasts';
      host.className = 'toasts';
      host.setAttribute('role', 'status');
      host.setAttribute('aria-live', 'polite');
      document.body.appendChild(host);
    }
    const el = document.createElement('div');
    el.className = 'toast';
    el.innerHTML = `${Nova.icon(icon || 'check', 16)}<span>${esc(message)}</span>`;
    host.appendChild(el);
    requestAnimationFrame(() => el.classList.add('is-in'));
    setTimeout(() => {
      el.classList.remove('is-in');
      setTimeout(() => el.remove(), 300);
    }, 2400);
  };

  /** Copies text to the clipboard with a toast; works without the async API too. */
  Nova.copy = function copy(text, message) {
    const done = () => Nova.toast(message || 'Скопировано', 'copy');
    if (navigator.clipboard && window.isSecureContext) {
      navigator.clipboard.writeText(text).then(done, done);
      return;
    }
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.style.position = 'fixed';
    ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.select();
    try { document.execCommand('copy'); } catch (e) { /* ignore */ }
    ta.remove();
    done();
  };
})();
