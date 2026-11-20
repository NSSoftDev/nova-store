/**
 * Unit tests for the shared pricing engine.
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { PROMO_LIST, calculateTotals, luhn, validatePromo } from '@nova/shared';

const SOUND20 = PROMO_LIST.find((p) => p.code === 'SOUND20');
const NOVA10 = PROMO_LIST.find((p) => p.code === 'NOVA10');
const headphones = { price: 14990, audio: true };
const watch = { price: 22490 };
const bottle = { price: 1990 };

describe('calculateTotals', () => {
  it('matches the checkout screenshot', () => {
    const t = calculateTotals({
      lines: [{ product: headphones, qty: 1 }, { product: watch, qty: 1 }, { product: bottle, qty: 1 }],
      promo: SOUND20,
      freeDeliveryFrom: 3000,
    });
    assert.deepEqual(t, { subtotal: 39470, discount: 2998, delivery: 0, total: 36472, count: 3 });
  });

  it('charges express delivery even above the threshold', () => {
    const t = calculateTotals({ lines: [{ product: watch, qty: 1 }], deliveryKey: 'express', freeDeliveryFrom: 3000 });
    assert.equal(t.delivery, 590);
  });

  it('applies NOVA10 only from 5 000 ₽', () => {
    assert.equal(validatePromo(NOVA10, [{ product: bottle, qty: 2 }]).ok, false);
    const t = calculateTotals({ lines: [{ product: bottle, qty: 3 }], promo: NOVA10, freeDeliveryFrom: 3000 });
    assert.equal(t.discount, 597);
  });

  it('returns zeros for an empty cart', () => {
    assert.deepEqual(calculateTotals({ lines: [], freeDeliveryFrom: 3000 }), { subtotal: 0, discount: 0, delivery: 0, total: 0, count: 0 });
  });
});

describe('luhn', () => {
  it('accepts valid and rejects invalid numbers', () => {
    assert.equal(luhn('4242424242424242'), true);
    assert.equal(luhn('4242424242424241'), false);
  });
});
