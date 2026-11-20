/**
 * API integration tests against a real PostgreSQL.
 *   npm test
 */
import { after, before, beforeEach, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import { createApp } from '../src/app.js';
import { ADMIN_TOKEN, startDatabase } from './helpers.js';

let db;
let app;
const admin = (req) => req.set('Authorization', `Bearer ${ADMIN_TOKEN}`);

const ORDER = {
  customer: { name: 'Александра К.', phone: '+7 916 555-12-48' },
  delivery: { method: 'courier', address: 'Москва, ул. Тверская, 12, кв. 48', slot: '10:00–14:00' },
  payment: { method: 'card' },
  items: [
    { productId: 'aura-pro-anc', color: 'lavender', qty: 1 },
    { productId: 'pulse-s2', color: 'lavender', qty: 1 },
    { productId: 'hydro', color: 'cyan', qty: 1 },
  ],
};

before(async () => {
  db = await startDatabase();
  app = createApp({ pool: db.pool, adminToken: ADMIN_TOKEN, logger: { error: () => {} } });
});
after(async () => { await db.stop(); });
beforeEach(async () => { await db.reset(); });

describe('storefront', () => {
  it('reports health', async () => {
    const res = await request(app).get('/api/health').expect(200);
    assert.deepEqual(res.body, { status: 'ok', db: 'up' });
  });

  it('returns the catalogue with categories and settings', async () => {
    const res = await request(app).get('/api/catalog').expect(200);
    assert.equal(res.body.categories.length, 5);
    assert.equal(res.body.products.length, 15);
    assert.equal(res.body.settings.freeDeliveryFrom, 3000);
    const aura = res.body.products.find((p) => p.id === 'aura-pro-anc');
    assert.equal(aura.price, 14990);
    assert.equal(aura.rating, 4.9);
    assert.deepEqual(aura.colors.slice(0, 2), ['lavender', 'pink']);
  });

  it('404s for unknown products', async () => {
    const res = await request(app).get('/api/products/nope').expect(404);
    assert.equal(res.body.error, 'Товар не найден');
  });

  it('validates promo codes against the cart', async () => {
    const ok = await request(app).post('/api/promos/validate').send({ code: 'sound20', items: ORDER.items }).expect(200);
    assert.equal(ok.body.ok, true);
    const noAudio = await request(app).post('/api/promos/validate')
      .send({ code: 'SOUND20', items: [{ productId: 'hydro', color: 'cyan', qty: 1 }] }).expect(200);
    assert.equal(noAudio.body.ok, false);
    assert.match(noAudio.body.message, /нет аудиотоваров/);
  });
});

describe('orders', () => {
  it('recomputes totals server-side and updates stock', async () => {
    const res = await request(app).post('/api/orders')
      .send({ ...ORDER, promo: 'SOUND20', total: 1 /* ignored: the server never trusts client totals */ })
      .expect(201);
    assert.equal(res.body.id, 'NS-48214');
    assert.equal(res.body.subtotal, 39470);
    assert.equal(res.body.discount, 2998); // 20 % of the audio line only
    assert.equal(res.body.deliveryPrice, 0); // above the free-delivery threshold
    assert.equal(res.body.total, 36472);
    assert.equal(res.body.payment, 'Карта');
    assert.equal(res.body.items.length, 3);

    const product = await request(app).get('/api/products/aura-pro-anc').expect(200);
    assert.equal(product.body.stock, 47);
    assert.equal(product.body.sold, 645);
  });

  it('rejects orders above available stock', async () => {
    const res = await request(app).post('/api/orders')
      .send({ ...ORDER, items: [{ productId: 'lumen-x', color: 'graphite', qty: 13 }] })
      .expect(409);
    assert.match(res.body.error, /в наличии только 12/);
  });

  it('validates the payload', async () => {
    const res = await request(app).post('/api/orders').send({ ...ORDER, customer: { name: 'A', phone: '1' } }).expect(400);
    assert.match(res.body.error, /customer\.name/);
    await request(app).post('/api/orders').send({ ...ORDER, items: [] }).expect(400);
    await request(app).post('/api/orders')
      .send({ ...ORDER, items: [{ productId: 'aura-pro-anc', color: 'neon', qty: 1 }] }).expect(400);
  });

  it('charges delivery below the threshold', async () => {
    const res = await request(app).post('/api/orders')
      .send({ ...ORDER, items: [{ productId: 'brew-mug', color: 'sunset', qty: 1 }] }).expect(201);
    assert.equal(res.body.deliveryPrice, 390);
    assert.equal(res.body.total, 1290 + 390);
  });
});

describe('admin', () => {
  it('requires the admin token', async () => {
    await request(app).get('/api/admin/orders').expect(401);
    await request(app).get('/api/admin/orders').set('Authorization', 'Bearer wrong').expect(401);
  });

  it('lists and updates orders', async () => {
    await request(app).post('/api/orders').send(ORDER).expect(201);
    const list = await admin(request(app).get('/api/admin/orders')).expect(200);
    assert.equal(list.body.length, 8);
    assert.equal(list.body[0].id, 'NS-48214');
    const updated = await admin(request(app).patch('/api/admin/orders/NS-48214')).send({ status: 'shipping' }).expect(200);
    assert.equal(updated.body.status, 'shipping');
    const filtered = await admin(request(app).get('/api/admin/orders?status=shipping')).expect(200);
    assert.ok(filtered.body.every((o) => o.status === 'shipping'));
  });

  it('hides products from the storefront and blocks ordering them', async () => {
    await admin(request(app).patch('/api/admin/products/hydro')).send({ hidden: true }).expect(200);
    const catalog = await request(app).get('/api/catalog').expect(200);
    assert.equal(catalog.body.products.some((p) => p.id === 'hydro'), false);
    await request(app).post('/api/orders').send(ORDER).expect(400);
  });

  it('creates products and edits price', async () => {
    const created = await admin(request(app).post('/api/admin/products'))
      .send({ name: 'Наушники Aura Lite', cat: 'electronics', kind: 'earbuds', color: 'mint', price: 4990, stock: 25, audio: true })
      .expect(201);
    assert.match(created.body.id, /^naushniki-aura-lite-/);
    assert.equal(created.body.badge, 'new');
    const edited = await admin(request(app).patch(`/api/admin/products/${created.body.id}`)).send({ price: 4490 }).expect(200);
    assert.equal(edited.body.price, 4490);
  });

  it('switches promo codes off', async () => {
    await admin(request(app).patch('/api/admin/promos/SOUND20')).send({ active: false }).expect(200);
    await request(app).post('/api/orders').send({ ...ORDER, promo: 'SOUND20' }).expect(400);
  });

  it('computes stats including live web orders', async () => {
    const before = await admin(request(app).get('/api/admin/stats?range=7d')).expect(200);
    assert.equal(before.body.series.length, 7);
    await request(app).post('/api/orders').send(ORDER).expect(201);
    const afterOrder = await admin(request(app).get('/api/admin/stats?range=7d')).expect(200);
    assert.equal(afterOrder.body.revenue - before.body.revenue, 39470);
    assert.equal(afterOrder.body.orders - before.body.orders, 1);
  });

  it('applies the free-delivery setting to new orders', async () => {
    await admin(request(app).patch('/api/admin/settings')).send({ freeDeliveryFrom: 100000 }).expect(200);
    const res = await request(app).post('/api/orders').send(ORDER).expect(201);
    assert.equal(res.body.deliveryPrice, 390);
  });

  it('aggregates customers and sales', async () => {
    const customers = await admin(request(app).get('/api/admin/customers')).expect(200);
    assert.equal(customers.body[0].name, 'Анна Орлова');
    assert.equal(customers.body[0].segment, 'vip');
    const sales = await admin(request(app).get('/api/admin/sales')).expect(200);
    assert.equal(sales.body.byCategory[0].id, 'electronics');
    assert.equal(sales.body.totalOrders, 7);
  });
});
