/**
 * Nova Store API — entry point.
 *   npm run migrate && npm run seed && npm start
 */
import { createApp } from './app.js';
import { config } from './config.js';
import { createPool } from './db.js';

const pool = createPool(config.databaseUrl);
const app = createApp({ pool, adminToken: config.adminToken, corsOrigins: config.corsOrigins });

const server = app.listen(config.port, () => {
  console.log(`Nova Store API → http://localhost:${config.port}/api (env: ${config.nodeEnv})`);
  if (!config.adminToken) console.warn('ADMIN_TOKEN is empty — /api/admin/* will answer 503.');
});

// Graceful shutdown (docker stop / Ctrl+C)
for (const signal of ['SIGINT', 'SIGTERM']) {
  process.on(signal, () => {
    server.close(() => pool.end().then(() => process.exit(0)));
  });
}
