/**
 * Nova Store — admin analytics (pure functions).
 * Shared by the API (SQL rows in, JSON out) and the client demo adapter
 * (localStorage data in), so both modes show identical numbers.
 */
import { CATEGORIES } from './catalog.js';

export const RANGES = {
  '12d': { label: '1–12 ноября', days: 12 },
  '7d': { label: 'Последние 7 дней', days: 7 },
  '30d': { label: 'Последние 30 дней', days: 30 },
};

/**
 * KPIs + chart series for a period vs the previous period of equal length.
 * @param {{date: string, revenue: number, orders: number, returnsRate: number}[]} history  oldest → newest
 * @param {keyof RANGES} rangeKey
 * @param {{ revenue: number, orders: number }} live  web orders not yet in the history (added to "today")
 */
export function computeStats(history, rangeKey, live = { revenue: 0, orders: 0 }) {
  const days = (RANGES[rangeKey] || RANGES['12d']).days;
  const period = (offset) => {
    const slice = history.slice(history.length - days - offset, history.length - offset);
    return {
      slice,
      revenue: slice.reduce((s, d) => s + d.revenue, 0),
      orders: slice.reduce((s, d) => s + d.orders, 0),
      returns: slice.reduce((s, d) => s + d.returnsRate, 0) / Math.max(1, slice.length),
    };
  };
  const cur = period(0);
  const prev = period(days);
  cur.revenue += live.revenue;
  cur.orders += live.orders;
  const series = cur.slice.map((d) => d.revenue);
  if (series.length) series[series.length - 1] += live.revenue;
  const pct = (a, b) => (b ? ((a - b) / b) * 100 : 0);
  const avg = cur.orders ? cur.revenue / cur.orders : 0;
  const prevAvg = prev.orders ? prev.revenue / prev.orders : 0;
  return {
    range: rangeKey,
    revenue: cur.revenue,
    orders: cur.orders,
    avgCheck: avg,
    returnsRate: cur.returns,
    delta: {
      revenue: pct(cur.revenue, prev.revenue),
      orders: pct(cur.orders, prev.orders),
      avgCheck: pct(avg, prevAvg),
      returnsRate: pct(cur.returns, prev.returns),
    },
    series,
    prevSeries: prev.slice.map((d) => d.revenue),
    dates: cur.slice.map((d) => d.date),
  };
}

/** Customers aggregated from orders, biggest spenders first. Returns are excluded from spend. */
export function aggregateCustomers(orders) {
  const map = new Map();
  orders.forEach((o) => {
    const c = map.get(o.customer) || { name: o.customer, orders: 0, spent: 0, lastOrderAt: o.createdAt };
    c.orders += 1;
    if (o.status !== 'returned') c.spent += o.total;
    if (o.createdAt > c.lastOrderAt) c.lastOrderAt = o.createdAt;
    map.set(o.customer, c);
  });
  return [...map.values()]
    .map((c) => ({ ...c, segment: c.spent >= 30000 ? 'vip' : c.orders > 1 ? 'regular' : 'new' }))
    .sort((a, b) => b.spent - a.spent);
}

/** Revenue by category (price × sold) and payment-method mix. */
export function salesBreakdown(products, orders) {
  const byCategory = CATEGORIES.map((c) => ({
    id: c.id,
    name: c.name,
    revenue: products.filter((p) => p.cat === c.id).reduce((s, p) => s + p.price * (p.sold || 0), 0),
  })).sort((a, b) => b.revenue - a.revenue);
  const byPayment = ['Карта', 'СБП', 'Сплит'].map((method) => ({
    method,
    orders: orders.filter((o) => o.payment === method).length,
  }));
  return { byCategory, byPayment, totalOrders: orders.length };
}
