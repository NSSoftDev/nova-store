/**
 * HTTP errors + request validation helpers.
 */
export class HttpError extends Error {
  /**
   * @param {number} status
   * @param {string} message  human-readable (Russian, shown in the UI)
   * @param {object} [details]
   */
  constructor(status, message, details) {
    super(message);
    this.status = status;
    this.details = details;
  }
}

export const badRequest = (message, details) => new HttpError(400, message, details);
export const notFound = (message = 'Не найдено') => new HttpError(404, message);
export const conflict = (message) => new HttpError(409, message);

/** Wraps an async route handler so rejections reach the error middleware. */
export const asyncRoute = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

/* ---- tiny validators: throw 400 with a field name on failure ---------- */

export function requireString(value, field, { min = 1, max = 500 } = {}) {
  if (typeof value !== 'string' || value.trim().length < min || value.trim().length > max) {
    throw badRequest(`Поле «${field}»: строка от ${min} до ${max} символов`, { field });
  }
  return value.trim();
}

export function optionalString(value, field, opts) {
  if (value === undefined || value === null || value === '') return null;
  return requireString(value, field, { min: 0, ...opts });
}

export function requireInt(value, field, { min = -Infinity, max = Infinity } = {}) {
  const n = Number(value);
  if (!Number.isInteger(n) || n < min || n > max) {
    throw badRequest(`Поле «${field}»: целое число от ${min} до ${max}`, { field });
  }
  return n;
}

export function requireOneOf(value, field, allowed) {
  if (!allowed.includes(value)) throw badRequest(`Поле «${field}»: допустимо ${allowed.join(', ')}`, { field });
  return value;
}

export function requireBool(value, field) {
  if (typeof value !== 'boolean') throw badRequest(`Поле «${field}»: true или false`, { field });
  return value;
}
