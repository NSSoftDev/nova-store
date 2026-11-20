/**
 * Fills the database with the demo catalogue, promo codes, seed orders and
 * 60 days of sales history from @nova/shared. Idempotent: wipes the demo
 * tables first.
 *   npm run seed
 */
import { fileURLToPath } from 'node:url';
import { CATEGORIES, DEFAULT_SETTINGS, PRODUCTS, PROMO_LIST, SEED_ORDERS, buildHistory } from '@nova/shared';
import { createPool, withTransaction } from '../src/db.js';
import { config } from '../src/config.js';

export async function seed(pool, log = console.log) {
  await withTransaction(pool, async (db) => {
    await db.query('TRUNCATE order_items, orders, products, categories, promo_codes, daily_revenue, settings RESTART IDENTITY CASCADE');
    await db.query("SELECT setval('order_number_seq', 48213)");

    for (const [i, c] of CATEGORIES.entries()) {
      await db.query('INSERT INTO categories (id, name, position) VALUES ($1, $2, $3)', [c.id, c.name, i]);
    }
    for (const p of PRODUCTS) {
      await db.query(
        `INSERT INTO products (id, name, brand, category_id, kind, price, old_price, rating, reviews, badge, audio,
                               stock, sold, added, colors, description, specs)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17)`,
        [p.id, p.name, p.brand, p.cat, p.kind, p.price, p.oldPrice ?? null, p.rating, p.reviews, p.badge ?? null,
          Boolean(p.audio), p.stock, p.sold, p.added, p.colors, p.desc, JSON.stringify(p.specs)],
      );
    }
    for (const p of PROMO_LIST) {
      await db.query(
        'INSERT INTO promo_codes (code, label, percent, scope, min_subtotal, active) VALUES ($1,$2,$3,$4,$5,$6)',
        [p.code, p.label, p.percent, p.scope, p.min ?? null, p.active],
      );
    }
    for (const o of SEED_ORDERS) {
      await db.query(
        `INSERT INTO orders (id, customer_name, delivery_method, payment_method, total, subtotal, status, source, created_at)
         VALUES ($1, $2, 'courier', $3, $4, $4, $5, 'seed', $6)`,
        [o.id, o.customer, o.payment, o.total, o.status, `${o.date}+03:00`],
      );
    }
    for (const d of buildHistory()) {
      await db.query(
        'INSERT INTO daily_revenue (day, revenue, orders, returns_rate) VALUES ($1, $2, $3, $4)',
        [d.date, d.revenue, d.orders, d.returnsRate.toFixed(2)],
      );
    }
    for (const [key, value] of Object.entries(DEFAULT_SETTINGS)) {
      await db.query('INSERT INTO settings (key, value) VALUES ($1, $2)', [key, JSON.stringify(value)]);
    }
  });
  log(`✔ seeded ${PRODUCTS.length} products, ${PROMO_LIST.length} promo codes, ${SEED_ORDERS.length} orders, 60 days of history`);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const pool = createPool(config.databaseUrl);
  seed(pool)
    .catch((err) => { console.error(err); process.exitCode = 1; })
    .finally(() => pool.end());
}
