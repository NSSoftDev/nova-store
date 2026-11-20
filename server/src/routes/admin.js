/**
 * Nova Admin API — every route requires `Authorization: Bearer <ADMIN_TOKEN>`.
 *   GET   /api/admin/products            all products incl. hidden
 *   POST  /api/admin/products            create
 *   PATCH /api/admin/products/:id        price / stock / hidden
 *   GET   /api/admin/orders?status=&q=   list
 *   PATCH /api/admin/orders/:id          status
 *   GET   /api/admin/stats?range=12d     KPIs + revenue series
 *   GET   /api/admin/customers           aggregated from orders
 *   GET   /api/admin/sales               revenue by category, payment mix
 *   GET   /api/admin/promos              list
 *   PATCH /api/admin/promos/:code        { active }
 *   PATCH /api/admin/settings            { freeDeliveryFrom }
 */
import { timingSafeEqual } from 'node:crypto';
import { Router } from 'express';
import { CATEGORIES, COLORS, ORDER_STATUSES, RANGES, aggregateCustomers, computeStats, salesBreakdown, slugify } from '@nova/shared';
import * as repo from '../repository.js';
import { HttpError, asyncRoute, requireBool, requireInt, requireOneOf, requireString } from '../errors.js';

const ILLUSTRATIONS = ['headphones', 'earbuds', 'watch', 'speaker', 'camera', 'keyboard', 'sneaker', 'backpack', 'lamp', 'bottle', 'hoodie', 'dumbbell', 'mug', 'sunglasses'];

/** Constant-time bearer token check. */
export function requireAdmin(token) {
  return (req, _res, next) => {
    if (!token) return next(new HttpError(503, 'Админ-API отключено: задайте ADMIN_TOKEN'));
    const header = req.get('authorization') || '';
    const given = Buffer.from(header.replace(/^Bearer\s+/i, ''));
    const expected = Buffer.from(token);
    if (given.length !== expected.length || !timingSafeEqual(given, expected)) {
      return next(new HttpError(401, 'Неверный токен администратора'));
    }
    return next();
  };
}

export function adminRoutes(pool, token) {
  const r = Router();
  r.use(requireAdmin(token));

  r.get('/products', asyncRoute(async (_req, res) => {
    res.json(await repo.listProducts(pool, { includeHidden: true }));
  }));

  r.post('/products', asyncRoute(async (req, res) => {
    const b = req.body || {};
    const name = requireString(b.name, 'name', { min: 3, max: 120 });
    const color = requireOneOf(b.color, 'color', Object.keys(COLORS));
    const cat = requireOneOf(b.cat, 'cat', CATEGORIES.map((c) => c.id));
    const product = await repo.createProduct(pool, {
      id: `${slugify(name)}-${Date.now().toString(36).slice(-4)}`,
      name,
      brand: name.split(/\s+/)[1] || 'Nova',
      cat,
      kind: requireOneOf(b.kind, 'kind', ILLUSTRATIONS),
      price: requireInt(b.price, 'price', { min: 100, max: 10_000_000 }),
      stock: requireInt(b.stock, 'stock', { min: 0, max: 1_000_000 }),
      audio: Boolean(b.audio),
      colors: [color, ...['lavender', 'graphite'].filter((c) => c !== color)],
      desc: 'Новый товар, добавленный через Nova Admin.',
      specs: { 'Категория': CATEGORIES.find((c) => c.id === cat).name },
    });
    res.status(201).json(product);
  }));

  r.patch('/products/:id', asyncRoute(async (req, res) => {
    const b = req.body || {};
    const patch = {};
    if (b.price !== undefined) patch.price = requireInt(b.price, 'price', { min: 1, max: 10_000_000 });
    if (b.stock !== undefined) patch.stock = requireInt(b.stock, 'stock', { min: 0, max: 1_000_000 });
    if (b.hidden !== undefined) patch.hidden = requireBool(b.hidden, 'hidden');
    res.json(await repo.updateProduct(pool, req.params.id, patch));
  }));

  r.get('/orders', asyncRoute(async (req, res) => {
    const status = req.query.status ? requireOneOf(String(req.query.status), 'status', ['all', ...Object.keys(ORDER_STATUSES)]) : undefined;
    res.json(await repo.listOrders(pool, { status, q: req.query.q ? String(req.query.q).slice(0, 80) : undefined }));
  }));

  r.patch('/orders/:id', asyncRoute(async (req, res) => {
    const status = requireOneOf(req.body && req.body.status, 'status', Object.keys(ORDER_STATUSES));
    res.json(await repo.setOrderStatus(pool, req.params.id, status));
  }));

  r.get('/stats', asyncRoute(async (req, res) => {
    const range = requireOneOf(String(req.query.range || '12d'), 'range', Object.keys(RANGES));
    const [history, live] = await Promise.all([repo.dailyHistory(pool), repo.liveTotals(pool)]);
    res.json(computeStats(history, range, live));
  }));

  r.get('/customers', asyncRoute(async (_req, res) => {
    res.json(aggregateCustomers(await repo.listOrders(pool)));
  }));

  r.get('/sales', asyncRoute(async (_req, res) => {
    const [products, orders] = await Promise.all([repo.listProducts(pool, { includeHidden: true }), repo.listOrders(pool)]);
    res.json(salesBreakdown(products, orders));
  }));

  r.get('/promos', asyncRoute(async (_req, res) => {
    res.json(await repo.listPromos(pool));
  }));

  r.patch('/promos/:code', asyncRoute(async (req, res) => {
    res.json(await repo.setPromoActive(pool, req.params.code.toUpperCase(), requireBool(req.body && req.body.active, 'active')));
  }));

  r.patch('/settings', asyncRoute(async (req, res) => {
    const freeDeliveryFrom = requireInt(req.body && req.body.freeDeliveryFrom, 'freeDeliveryFrom', { min: 0, max: 1_000_000 });
    res.json(await repo.updateSettings(pool, { freeDeliveryFrom }));
  }));

  return r;
}
