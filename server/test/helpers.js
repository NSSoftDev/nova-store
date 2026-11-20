/**
 * Test database bootstrap.
 *   • TEST_DATABASE_URL set (CI service container) → use it
 *   • otherwise → start a throwaway PostgreSQL with `embedded-postgres`
 * Then apply migrations and seed demo data.
 */
import { chmod, mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { createPool } from '../src/db.js';
import { migrate } from '../scripts/migrate.js';
import { seed } from '../scripts/seed.js';

export const ADMIN_TOKEN = 'test-admin-token';

export async function startDatabase() {
  let embedded = null;
  let dataDir = null;
  let url = process.env.TEST_DATABASE_URL;

  if (!url) {
    const { default: EmbeddedPostgres } = await import('embedded-postgres');
    // A world-writable parent dir: when tests run as root, embedded-postgres
    // runs initdb as an unprivileged "postgres" user that must create the
    // data directory itself.
    const parent = await mkdtemp(path.join(tmpdir(), 'nova-pg-'));
    await chmod(parent, 0o777);
    dataDir = path.join(parent, 'data');
    const port = 54000 + Math.floor(Math.random() * 1000);
    embedded = new EmbeddedPostgres({ databaseDir: dataDir, user: 'nova', password: 'nova', port, persistent: false, onLog: () => {} });
    await embedded.initialise();
    await embedded.start();
    await embedded.createDatabase('nova_test');
    url = `postgres://nova:nova@localhost:${port}/nova_test`;
  }

  const pool = createPool(url);
  await migrate(pool, () => {});
  await seed(pool, () => {});

  return {
    pool,
    /** Re-seed between tests that mutate data. */
    reset: () => seed(pool, () => {}),
    async stop() {
      await pool.end();
      if (embedded) await embedded.stop();
      if (dataDir) await rm(path.dirname(dataDir), { recursive: true, force: true });
    },
  };
}
