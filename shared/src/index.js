/** Public entry of @nova/shared — imported by both client and server. */
export * from './catalog.js';
export * from './pricing.js';
export * from './analytics.js';

import { PROMOS } from './catalog.js';

/** Promo codes as an array with the code inside each object. */
export const PROMO_LIST = Object.entries(PROMOS).map(([code, p]) => ({ code, ...p }));

/** Transliterates a product name into a URL-safe slug (used for new product ids). */
export function slugify(name) {
  const map = { а: 'a', б: 'b', в: 'v', г: 'g', д: 'd', е: 'e', ё: 'e', ж: 'zh', з: 'z', и: 'i', й: 'y', к: 'k', л: 'l', м: 'm', н: 'n', о: 'o', п: 'p', р: 'r', с: 's', т: 't', у: 'u', ф: 'f', х: 'h', ц: 'c', ч: 'ch', ш: 'sh', щ: 'sch', ъ: '', ы: 'y', ь: '', э: 'e', ю: 'yu', я: 'ya' };
  return String(name).toLowerCase()
    .replace(/[а-яё]/g, (ch) => map[ch])
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '') || 'item';
}
