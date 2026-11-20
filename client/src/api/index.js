/**
 * Picks the data adapter at build time:
 *   VITE_API_MODE=http (default) → Node.js API
 *   VITE_API_MODE=demo           → in-browser demo database (static hosting)
 */
import { httpApi } from './http.js';
import { demoApi } from './demo.js';

export const api = import.meta.env.VITE_API_MODE === 'demo' ? demoApi : httpApi;
export { ApiError } from './http.js';
