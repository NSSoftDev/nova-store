/**
 * Data access layer: every SQL statement of the API lives here.
 * Rows are mapped to the same camelCase shape the React client uses
 * (see @nova/shared PRODUCTS), so the client works identically against
 * the API and against its offline demo adapter.
 */
import { calculateTotals, validatePromo, PAYMENT_METHODS, DELIVERY } from '@nova/shared';
import { withTransaction } from './db.js';
import { badRequest, conflict, notFound } from './errors.js';

/* ------------------------------------------------------------------ */
/* Row mappers                                                         */
/* ------------------------------------------------------------------ */
const PRODUCT_COLUMNS = `
  id, name, brand, category_id, kind, price, old_price, rating, reviews, badge, audio,
  stock, sold, added, colors, description, specs, hidden`;

export function mapProduct(r) {
  return {
    id: r.id,
    name: r.name,
    brand: r.brand,
    cat: r.category_id,
    kind: r.kind,
    price: r.price,
    oldPrice: r.old_price ?? undefined,
    rating: r.rating,
    reviews: r.reviews,
    badge: r.badge ?? undefined,
    audio: r.audio,
    stock: r.stock,
    sold: r.sold,
    added: r.added,
    colors: r.colors,
    desc: r.description,
    specs: r.specs,
    hidden: r.hidden,
  };
}

const mapPromo = (r) => ({
  code: r.code,
  label: r.label,
  percent: r.percent,
  scope: r.scope,
  min: r.min_subtotal ?? undefined,
  active: r.active,
});

function mapOrder(r, items = []) {
  return {
    id: r.id,
    customer: r.customer_name,
    phone: r.customer_phone ?? undefined,
    delivery: { method: r.delivery_method, address: r.delivery_address ?? undefined, slot: r.delivery_slot ?? undefined },
    payment: r.payment_method,
    promo: r.promo_code ?? undefined,
    subtotal: r.subtotal,
    discount: r.discount,
    deliveryPrice: r.delivery_price,
    total: r.total,
    status: r.status,
    source: r.source,
    createdAt: new Date(r.created_at).toISOString(),
    items: items.map((i) => ({ id: i.product_id, name: i.name, color: i.color, qty: i.qty, unitPrice: i.unit_price, sum: i.unit_price * i.qty })),
  };
}

/* ------------------------------------------------------------------ */
/* Catalogue                                                           */
/* ------------------------------------------------------------------ */
export async function listCategories(db) {
  const { rows } = await db.query('SELECT id, name FROM categories ORDER BY position');
  return rows;
}

export async function listProducts(db, { includeHidden = false } = {}) {
  const { rows } = await db.query(
    `SELECT ${PRODUCT_COLUMNS} FROM products ${includeHidden ? '' : 'WHERE NOT hidden'} ORDER BY sold DESC, id`,
  );
  return rows.map(mapProduct);
}

export async function getProduct(db, id, { includeHidden = false } = {}) {
  const { rows } = await db.query(`SELECT ${PRODUCT_COLUMNS} FROM products WHERE id = $1`, [id]);
  if (!rows[0] || (rows[0].hidden && !includeHidden)) throw notFound('Товар не найден');
  return mapProduct(rows[0]);
}

export async function createProduct(db, p) {
  const { rows } = await db.query(
    `INSERT INTO products (id, name, brand, category_id, kind, price, rating, reviews, badge, audio, stock, sold, added, colors, description, specs)
     VALUES ($1, $2, $3, $4, $5, $6, 5.0, 0, 'new', $7, $8, 0, (SELECT coalesce(max(added), 0) + 1 FROM products), $9, $10, $11)
     RETURNING ${PRODUCT_COLUMNS}`,
    [p.id, p.name, p.brand, p.cat, p.kind, p.price, p.audio, p.stock, p.colors, p.desc, JSON.stringify(p.specs || {})],
  );
  return mapProduct(rows[0]);
}

/** Partial update of admin-editable fields: price, stock, hidden. */
export async function updateProduct(db, id, patch) {
  const sets = [];
  const values = [];
  for (const [key, column] of [['price', 'price'], ['stock', 'stock'], ['hidden', 'hidden']]) {
    if (patch[key] !== undefined) {
      values.push(patch[key]);
      sets.push(`${column} = $${values.length}`);
    }
  }
  if (!sets.length) throw badRequest('Нет полей для обновления');
  values.push(id);
  const { rows } = await db.query(
    `UPDATE products SET ${sets.join(', ')}, updated_at = now() WHERE id = $${values.length} RETURNING ${PRODUCT_COLUMNS}`,
    values,
  );
  if (!rows[0]) throw notFound('Товар не найден');
  return mapProduct(rows[0]);
}

/* ------------------------------------------------------------------ */
/* Promo codes & settings                                              */
/* ------------------------------------------------------------------ */
export async function listPromos(db) {
  const { rows } = await db.query('SELECT * FROM promo_codes ORDER BY code');
  return rows.map(mapPromo);
}

export async function getPromo(db, code) {
  const { rows } = await db.query('SELECT * FROM promo_codes WHERE code = $1', [String(code).trim().toUpperCase()]);
  return rows[0] ? mapPromo(rows[0]) : null;
}

export async function setPromoActive(db, code, active) {
  const { rows } = await db.query('UPDATE promo_codes SET active = $2 WHERE code = $1 RETURNING *', [code, active]);
  if (!rows[0]) throw notFound('Промокод не найден');
  return mapPromo(rows[0]);
}

export async function getSettings(db) {
  const { rows } = await db.query('SELECT key, value FROM settings');
  return Object.fromEntries(rows.map((r) => [r.key, r.value]));
}

export async function updateSettings(db, patch) {
  for (const [key, value] of Object.entries(patch)) {
    await db.query(
      'INSERT INTO settings (key, value) VALUES ($1, $2) ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value',
      [key, JSON.stringify(value)],
    );
  }
  return getSettings(db);
}

/* ------------------------------------------------------------------ */
/* Pricing helpers                                                     */
/* ------------------------------------------------------------------ */

/** Loads products for cart lines and returns priced lines (throws on unknown/hidden ids). */
async function pricedLines(db, items, { lock = false } = {}) {
  const ids = [...new Set(items.map((i) => i.productId))];
  const { rows } = await db.query(
    `SELECT ${PRODUCT_COLUMNS} FROM products WHERE id = ANY($1::text[]) ${lock ? 'FOR UPDATE' : ''}`,
    [ids],
  );
  const byId = new Map(rows.map((r) => [r.id, mapProduct(r)]));
  return items.map((i) => {
    const product = byId.get(i.productId);
    if (!product || product.hidden) throw badRequest(`Товар ${i.productId} недоступен`, { productId: i.productId });
    if (!product.colors.includes(i.color)) throw badRequest(`У товара «${product.name}» нет цвета ${i.color}`);
    return { product, qty: i.qty, color: i.color };
  });
}

export async function validatePromoForItems(db, code, items) {
  const promo = await getPromo(db, code);
  const lines = await pricedLines(db, items);
  const result = validatePromo(promo, lines);
  // Public promo terms are returned so the client can show the discount live;
  // the order endpoint recomputes it anyway.
  return result.ok
    ? { ...result, code: promo.code, label: promo.label, percent: promo.percent, scope: promo.scope, min: promo.min, active: true }
    : { ...result, code: String(code).toUpperCase() };
}

/* ------------------------------------------------------------------ */
/* Orders                                                              */
/* ------------------------------------------------------------------ */

/**
 * Places an order atomically:
 *   lock product rows → check stock → recompute totals server-side →
 *   insert order + items → decrement stock / increment sold.
 * Card details never reach this API: in production the payment form posts
 * them straight to the payment provider, which returns a token.
 */
export async function createOrder(pool, input) {
  return withTransaction(pool, async (db) => {
    const lines = await pricedLines(db, input.items, { lock: true });

    // Merge duplicate product+color lines and check stock per product
    const need = new Map();
    lines.forEach((l) => need.set(l.product.id, (need.get(l.product.id) || 0) + l.qty));
    for (const [id, qty] of need) {
      const product = lines.find((l) => l.product.id === id).product;
      if (product.stock < qty) throw conflict(`«${product.name}»: в наличии только ${product.stock} шт.`);
    }

    let promo = null;
    if (input.promo) {
      promo = await getPromo(db, input.promo);
      const check = validatePromo(promo, lines);
      if (!check.ok) throw badRequest(`Промокод: ${check.message}`);
    }
    const settings = await getSettings(db);
    const totals = calculateTotals({
      lines,
      promo,
      deliveryKey: input.delivery.method,
      freeDeliveryFrom: settings.freeDeliveryFrom ?? 3000,
    });

    const { rows: [{ n }] } = await db.query("SELECT nextval('order_number_seq') AS n");
    const id = `NS-${n}`;
    const { rows: [orderRow] } = await db.query(
      `INSERT INTO orders (id, customer_name, customer_phone, delivery_method, delivery_address, delivery_slot,
                           payment_method, promo_code, subtotal, discount, delivery_price, total, status, source)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, 'processing', 'web') RETURNING *`,
      [id, input.customer.name, input.customer.phone, input.delivery.method, input.delivery.address, input.delivery.slot,
        PAYMENT_METHODS[input.payment.method].short, promo ? promo.code : null,
        totals.subtotal, totals.discount, totals.delivery, totals.total],
    );

    const itemRows = [];
    for (const l of lines) {
      const { rows } = await db.query(
        `INSERT INTO order_items (order_id, product_id, name, color, qty, unit_price) VALUES ($1, $2, $3, $4, $5, $6)
         ON CONFLICT (order_id, product_id, color) DO UPDATE SET qty = order_items.qty + EXCLUDED.qty
         RETURNING *`,
        [id, l.product.id, l.product.name, l.color, l.qty, l.product.price],
      );
      itemRows.push(rows[0]);
    }
    for (const [productId, qty] of need) {
      await db.query('UPDATE products SET stock = stock - $2, sold = sold + $2, updated_at = now() WHERE id = $1', [productId, qty]);
    }
    const unique = [...new Map(itemRows.map((r) => [`${r.product_id}|${r.color}`, r])).values()];
    return mapOrder(orderRow, unique);
  });
}

export async function listOrders(db, { status, q } = {}) {
  const where = [];
  const values = [];
  if (status && status !== 'all') {
    values.push(status);
    where.push(`o.status = $${values.length}`);
  }
  if (q) {
    values.push(`%${q.toLowerCase()}%`);
    where.push(`(lower(o.id) LIKE $${values.length} OR lower(o.customer_name) LIKE $${values.length})`);
  }
  const { rows } = await db.query(
    `SELECT o.*, coalesce(json_agg(i.*) FILTER (WHERE i.order_id IS NOT NULL), '[]') AS items
       FROM orders o LEFT JOIN order_items i ON i.order_id = o.id
      ${where.length ? `WHERE ${where.join(' AND ')}` : ''}
      GROUP BY o.id ORDER BY o.created_at DESC`,
    values,
  );
  return rows.map((r) => mapOrder(r, r.items));
}

export async function setOrderStatus(db, id, status) {
  const { rows } = await db.query('UPDATE orders SET status = $2 WHERE id = $1 RETURNING *', [id, status]);
  if (!rows[0]) throw notFound('Заказ не найден');
  return mapOrder(rows[0]);
}

/* ------------------------------------------------------------------ */
/* Analytics inputs                                                    */
/* ------------------------------------------------------------------ */
export async function dailyHistory(db) {
  const { rows } = await db.query('SELECT day, revenue, orders, returns_rate FROM daily_revenue ORDER BY day');
  return rows.map((r) => ({ date: r.day, revenue: r.revenue, orders: r.orders, returnsRate: r.returns_rate }));
}

/** Web orders newer than the pre-aggregated history (counted towards "today"). */
export async function liveTotals(db) {
  const { rows: [r] } = await db.query(
    `SELECT coalesce(sum(total), 0)::int AS revenue, count(*)::int AS orders
       FROM orders WHERE source = 'web' AND status <> 'returned'`,
  );
  return r;
}

export { DELIVERY };
