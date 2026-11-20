/**
 * Runtime configuration from environment variables (see .env.example).
 */
export const config = {
  port: Number(process.env.PORT || 4000),
  databaseUrl: process.env.DATABASE_URL || 'postgres://nova:nova@localhost:5432/nova_store',
  /** Bearer token for /api/admin/*. Admin routes are disabled when empty. */
  adminToken: process.env.ADMIN_TOKEN || '',
  /** Comma-separated list of origins allowed to call the API from a browser. */
  corsOrigins: (process.env.CORS_ORIGIN || 'http://localhost:5173')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean),
  nodeEnv: process.env.NODE_ENV || 'development',
};
