/**
 * ru-RU formatting helpers.
 */
import { COLORS } from '@nova/shared';

const nf = new Intl.NumberFormat('ru-RU');

/** 14990 → "14 990" (narrow no-break space, like the design). */
export const fmt = (n) => nf.format(Math.round(n)).replace(/ /g, ' ');
export const money = (n) => `${fmt(n)} ₽`;
export const fmtDec = (n, d) => n.toLocaleString('ru-RU', { minimumFractionDigits: d, maximumFractionDigits: d });

export function compactMoney(n) {
  if (n >= 1e6) return `${fmtDec(n / 1e6, 2)} млн ₽`;
  if (n >= 1e3) return `${fmtDec(n / 1e3, 1)} тыс ₽`;
  return money(n);
}

/** Russian plural: plural(5, 'товар', 'товара', 'товаров') → 'товаров'. */
export function plural(n, one, few, many) {
  const m10 = n % 10;
  const m100 = n % 100;
  if (m10 === 1 && m100 !== 11) return one;
  if (m10 >= 2 && m10 <= 4 && (m100 < 12 || m100 > 14)) return few;
  return many;
}

export const initials = (name) => name.split(/\s+/).map((w) => w[0]).join('').slice(0, 2).toUpperCase();

/** Gradient palette for a product colour key (falls back to the first colour). */
export function paletteOf(product, colorKey) {
  const key = colorKey || (product.colors && product.colors[0]) || 'lavender';
  return (COLORS[key] || COLORS.lavender).palette;
}

export const discountPercent = (p) => (p.oldPrice ? Math.round((1 - p.price / p.oldPrice) * 100) : 0);

export const formatDate = (iso, opts) => new Date(iso).toLocaleString('ru-RU', opts);
