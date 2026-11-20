/**
 * Nova Store — pricing engine (pure functions, no I/O).
 *
 * Used by the React client to show totals instantly and by the Node.js API
 * to recompute them authoritatively when an order is placed — the server
 * never trusts prices or discounts sent by the browser.
 */
import { DELIVERY } from './catalog.js';

/**
 * @typedef {{ price: number, audio?: boolean }} PricedProduct
 * @typedef {{ product: PricedProduct, qty: number }} PricedLine
 * @typedef {{ code: string, label: string, percent: number, scope: 'all'|'audio', min?: number, active: boolean }} Promo
 */

/** Sum of price × qty. */
export function subtotalOf(lines) {
  return lines.reduce((sum, l) => sum + l.product.price * l.qty, 0);
}

/**
 * Checks whether a promo code can be applied to the given lines.
 * @param {Promo|null|undefined} promo
 * @param {PricedLine[]} lines
 * @returns {{ ok: boolean, message: string }}
 */
export function validatePromo(promo, lines) {
  if (!promo || !promo.active) return { ok: false, message: 'Промокод не найден или неактивен' };
  const subtotal = subtotalOf(lines);
  if (promo.min && subtotal < promo.min) return { ok: false, message: `Действует от ${promo.min.toLocaleString('ru-RU')} ₽` };
  if (promo.scope === 'audio' && !lines.some((l) => l.product.audio)) return { ok: false, message: 'В корзине нет аудиотоваров' };
  return { ok: true, message: promo.label };
}

/**
 * Discount in roubles for a valid promo (0 when not applicable).
 * SOUND20-style promos (`scope: 'audio'`) only discount audio lines.
 */
export function discountOf(promo, lines) {
  if (!validatePromo(promo, lines).ok) return 0;
  const base = promo.scope === 'audio'
    ? subtotalOf(lines.filter((l) => l.product.audio))
    : subtotalOf(lines);
  return Math.round((base * promo.percent) / 100);
}

/**
 * Delivery price. Courier and pickup are free once the discounted subtotal
 * reaches `freeDeliveryFrom`; express is always paid.
 */
export function deliveryOf(deliveryKey, discountedSubtotal, freeDeliveryFrom, hasItems = true) {
  const option = DELIVERY[deliveryKey] || DELIVERY.courier;
  if (!hasItems) return 0;
  if (deliveryKey !== 'express' && discountedSubtotal >= freeDeliveryFrom) return 0;
  return option.price;
}

/**
 * Full order calculation.
 * @param {{ lines: PricedLine[], promo?: Promo|null, deliveryKey?: string, freeDeliveryFrom: number }} input
 */
export function calculateTotals({ lines, promo = null, deliveryKey = 'courier', freeDeliveryFrom }) {
  const subtotal = subtotalOf(lines);
  const discount = discountOf(promo, lines);
  const delivery = deliveryOf(deliveryKey, subtotal - discount, freeDeliveryFrom, lines.length > 0);
  return {
    subtotal,
    discount,
    delivery,
    total: Math.max(0, subtotal - discount + delivery),
    count: lines.reduce((s, l) => s + l.qty, 0),
  };
}

/** Luhn checksum for card numbers (client-side validation only). */
export function luhn(digits) {
  let sum = 0;
  let double = false;
  for (let i = digits.length - 1; i >= 0; i -= 1) {
    let d = Number(digits[i]);
    if (double) {
      d *= 2;
      if (d > 9) d -= 9;
    }
    sum += d;
    double = !double;
  }
  return digits.length >= 13 && sum % 10 === 0;
}
