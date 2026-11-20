/**
 * Express application factory (no listen) — used by index.js and the tests.
 */
import express from 'express';
import { publicRoutes } from './routes/public.js';
import { adminRoutes } from './routes/admin.js';
import { HttpError } from './errors.js';

/**
 * @param {{ pool: import('pg').Pool, adminToken: string, corsOrigins?: string[], logger?: Pick<Console,'error'> }} deps
 */
export function createApp({ pool, adminToken, corsOrigins = [], logger = console }) {
  const app = express();
  app.disable('x-powered-by');
  app.set('trust proxy', 1);
  app.use(express.json({ limit: '100kb' }));

  // Security headers for a JSON API
  app.use((_req, res, next) => {
    res.set({
      'X-Content-Type-Options': 'nosniff',
      'X-Frame-Options': 'DENY',
      'Referrer-Policy': 'no-referrer',
      'Cache-Control': 'no-store',
    });
    next();
  });

  // CORS: only the configured storefront origins
  app.use((req, res, next) => {
    const origin = req.get('origin');
    if (origin && corsOrigins.includes(origin)) {
      res.set({
        'Access-Control-Allow-Origin': origin,
        Vary: 'Origin',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
        'Access-Control-Allow-Methods': 'GET, POST, PATCH, OPTIONS',
      });
    }
    if (req.method === 'OPTIONS') return res.sendStatus(204);
    return next();
  });

  app.get('/api/health', async (_req, res) => {
    try {
      await pool.query('SELECT 1');
      res.json({ status: 'ok', db: 'up' });
    } catch {
      res.status(503).json({ status: 'degraded', db: 'down' });
    }
  });

  app.use('/api', publicRoutes(pool));
  app.use('/api/admin', adminRoutes(pool, adminToken));

  app.use('/api', (_req, _res, next) => next(new HttpError(404, 'Маршрут не найден')));

  // Error handler: HttpError → its status; invalid JSON → 400; anything else → 500
  // eslint-disable-next-line no-unused-vars
  app.use((err, _req, res, _next) => {
    if (err instanceof HttpError) {
      return res.status(err.status).json({ error: err.message, details: err.details });
    }
    if (err.type === 'entity.parse.failed') return res.status(400).json({ error: 'Некорректный JSON' });
    if (err.code === '23514' || err.code === '23503') return res.status(400).json({ error: 'Нарушено ограничение данных' });
    logger.error(err);
    return res.status(500).json({ error: 'Внутренняя ошибка сервера' });
  });

  return app;
}
