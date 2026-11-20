/**
 * HTTP adapter — talks to the Node.js API (server/).
 * In development Vite proxies /api to http://localhost:4000.
 */
const BASE = import.meta.env.VITE_API_URL || '/api';
const TOKEN_KEY = 'nova-store:admin-token';

export class ApiError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

function adminToken() {
  try { return sessionStorage.getItem(TOKEN_KEY) || ''; } catch { return ''; }
}

async function request(path, { method = 'GET', body, admin = false } = {}) {
  const headers = { Accept: 'application/json' };
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  if (admin) headers.Authorization = `Bearer ${adminToken()}`;
  let res;
  try {
    res = await fetch(`${BASE}${path}`, { method, headers, body: body === undefined ? undefined : JSON.stringify(body) });
  } catch {
    throw new ApiError(0, 'Сервер недоступен. Запустите API (npm run dev:api) или соберите демо-версию.');
  }
  const data = res.status === 204 ? null : await res.json().catch(() => null);
  if (!res.ok) throw new ApiError(res.status, (data && data.error) || `Ошибка ${res.status}`);
  return data;
}

const toItems = (lines) => lines.map((l) => ({ productId: l.id, color: l.color, qty: l.qty }));

export const httpApi = {
  mode: 'http',
  requiresLogin: true,

  setAdminToken(token) {
    try { if (token) sessionStorage.setItem(TOKEN_KEY, token); else sessionStorage.removeItem(TOKEN_KEY); } catch { /* storage disabled */ }
  },
  hasAdminToken: () => Boolean(adminToken()),

  /* storefront */
  catalog: () => request('/catalog'),
  validatePromo: (code, lines) => request('/promos/validate', { method: 'POST', body: { code, items: toItems(lines) } }),
  createOrder: (payload) => request('/orders', { method: 'POST', body: { ...payload, items: toItems(payload.items) } }),

  /* admin */
  adminProducts: () => request('/admin/products', { admin: true }),
  createProduct: (data) => request('/admin/products', { method: 'POST', body: data, admin: true }),
  updateProduct: (id, patch) => request(`/admin/products/${encodeURIComponent(id)}`, { method: 'PATCH', body: patch, admin: true }),
  orders: () => request('/admin/orders', { admin: true }),
  updateOrder: (id, status) => request(`/admin/orders/${encodeURIComponent(id)}`, { method: 'PATCH', body: { status }, admin: true }),
  stats: (range) => request(`/admin/stats?range=${encodeURIComponent(range)}`, { admin: true }),
  customers: () => request('/admin/customers', { admin: true }),
  sales: () => request('/admin/sales', { admin: true }),
  promos: () => request('/admin/promos', { admin: true }),
  setPromoActive: (code, active) => request(`/admin/promos/${encodeURIComponent(code)}`, { method: 'PATCH', body: { active }, admin: true }),
  updateSettings: (patch) => request('/admin/settings', { method: 'PATCH', body: patch, admin: true }),

  /** Checks a token by calling a cheap admin endpoint. */
  async login(token) {
    this.setAdminToken(token);
    try {
      await request('/admin/promos', { admin: true });
      return true;
    } catch (err) {
      this.setAdminToken('');
      throw err;
    }
  },
  logout() { this.setAdminToken(''); },
};
