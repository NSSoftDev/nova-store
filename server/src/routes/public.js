/**
 * Public storefront API (no authentication).
 *   GET  /api/catalog            categories + visible products + public settings
 *   GET  /api/products/:id       one visible product
 *   POST /api/promos/validate    check a promo code against cart items
 *   POST /api/orders             place an order (totals recomputed server-side)
 */
import { Router } from 'express';
import { DELIVERY, PAYMENT_METHODS } from '@nova/shared';
import * as repo from '../repository.js';
import { asyncRoute, badRequest, optionalString, requireInt, requireOneOf, requireString } from '../errors.js';

/** Validates `[{ productId, color, qty }]` from the request body. */
function parseItems(raw) {
  if (!Array.isArray(raw) || raw.length === 0 || raw.length > 50) throw badRequest('Корзина пуста или слишком большая');
  return raw.map((i, idx) => ({
    productId: requireString(i && i.productId, `items[${idx}].productId`, { max: 80 }),
    color: requireString(i && i.color, `items[${idx}].color`, { max: 40 }),
    qty: requireInt(i && i.qty, `items[${idx}].qty`, { min: 1, max: 99 }),
  }));
}

export function publicRoutes(pool) {
  const r = Router();

  r.get('/catalog', asyncRoute(async (_req, res) => {
    const [categories, products, settings] = await Promise.all([
      repo.listCategories(pool),
      repo.listProducts(pool),
      repo.getSettings(pool),
    ]);
    res.json({ categories, products, settings: { freeDeliveryFrom: settings.freeDeliveryFrom } });
  }));

  r.get('/products/:id', asyncRoute(async (req, res) => {
    res.json(await repo.getProduct(pool, req.params.id));
  }));

  r.post('/promos/validate', asyncRoute(async (req, res) => {
    const code = requireString(req.body.code, 'code', { max: 32 });
    const items = parseItems(req.body.items);
    res.json(await repo.validatePromoForItems(pool, code, items));
  }));

  r.post('/orders', asyncRoute(async (req, res) => {
    const b = req.body || {};
    const method = requireOneOf(b.delivery && b.delivery.method, 'delivery.method', Object.keys(DELIVERY));
    const input = {
      items: parseItems(b.items),
      customer: {
        name: requireString(b.customer && b.customer.name, 'customer.name', { min: 2, max: 120 }),
        phone: requireString(b.customer && b.customer.phone, 'customer.phone', { min: 10, max: 32 }),
      },
      delivery: {
        method,
        // courier/express: street address; pickup: the chosen pickup point
        address: requireString(b.delivery.address, 'delivery.address', { min: 5, max: 300 }),
        slot: optionalString(b.delivery.slot, 'delivery.slot', { max: 40 }),
      },
      payment: { method: requireOneOf(b.payment && b.payment.method, 'payment.method', Object.keys(PAYMENT_METHODS)) },
      promo: optionalString(b.promo, 'promo', { max: 32 }),
    };
    const order = await repo.createOrder(pool, input);
    res.status(201).json(order);
  }));

  return r;
}
