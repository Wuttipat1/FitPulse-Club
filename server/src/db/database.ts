import { Pool, types, type PoolClient, type QueryResultRow } from 'pg';

// ---------------------------------------------------------------------
// Type parsers — keep the JSON the API returns identical to the old
// SQLite version, which the React client already expects.
// ---------------------------------------------------------------------
types.setTypeParser(types.builtins.INT8, (v) => parseInt(v, 10)); // COUNT(*) → number, not "3"
types.setTypeParser(types.builtins.NUMERIC, (v) => parseFloat(v)); // price → 599, not "599.00"
types.setTypeParser(types.builtins.DATE, (v) => v); // "2026-11-18", not a shifted JS Date
types.setTypeParser(types.builtins.TIME, (v) => v.slice(0, 5)); // "07:00", not "07:00:00"

// ---------------------------------------------------------------------
// Connection
// ---------------------------------------------------------------------
// Production (Render): DATABASE_URL = Supabase *Session pooler* string.
// Local dev: put DATABASE_URL in server/.env, or run a local Postgres
// that matches the fallback below.
const LOCAL_FALLBACK = 'postgresql://postgres:postgres@localhost:5432/fitpulse';
const rawUrl = process.env.DATABASE_URL || LOCAL_FALLBACK;

if (!process.env.DATABASE_URL) {
  if (process.env.NODE_ENV === 'production') {
    throw new Error('DATABASE_URL is not set. Add your Supabase connection string to the environment.');
  }
  console.warn(`⚠️  DATABASE_URL not set — falling back to ${LOCAL_FALLBACK}`);
}

const url = new URL(rawUrl);
const isLocal = ['localhost', '127.0.0.1', '::1'].includes(url.hostname);
// SSL is configured below; drop sslmode from the URL so it can't override that.
url.searchParams.delete('sslmode');

/** Club timezone, so CURRENT_DATE means "today in Bangkok", not UTC. */
const APP_TIMEZONE = process.env.APP_TIMEZONE || 'Asia/Bangkok';
if (!/^[A-Za-z0-9_+\-/]+$/.test(APP_TIMEZONE)) throw new Error(`Invalid APP_TIMEZONE: ${APP_TIMEZONE}`);

export const pool = new Pool({
  connectionString: url.toString(),
  // Supabase requires TLS. Its certificate isn't in Node's default CA store,
  // so the chain isn't verified unless you provide the CA (see DEPLOYMENT.md).
  ssl:
    isLocal || process.env.DATABASE_SSL === 'false'
      ? false
      : process.env.DATABASE_CA_CERT
        ? { ca: process.env.DATABASE_CA_CERT.replace(/\\n/g, '\n') }
        : { rejectUnauthorized: false },
  max: Number(process.env.PG_POOL_MAX) || 5, // keep well under Supabase's free-tier pooler limit
  idleTimeoutMillis: 30_000,
  connectionTimeoutMillis: 10_000,
});

pool.on('connect', (client) => {
  client.query(`SET TIME ZONE '${APP_TIMEZONE}'`).catch((err) => console.error('Failed to set time zone:', err));
});

pool.on('error', (err) => {
  // An idle client died (e.g. the pooler restarted). The pool replaces it.
  console.error('Postgres pool error:', err.message);
});

// ---------------------------------------------------------------------
// Query helpers
// ---------------------------------------------------------------------
type Queryable = Pick<PoolClient, 'query'>;

/** Run a query and return all rows. */
export async function query<T extends QueryResultRow = any>(
  text: string,
  params: unknown[] = [],
  db: Queryable = pool,
): Promise<T[]> {
  const res = await db.query<T>(text, params);
  return res.rows;
}

/** Run a query and return the first row (or undefined). */
export async function queryOne<T extends QueryResultRow = any>(
  text: string,
  params: unknown[] = [],
  db: Queryable = pool,
): Promise<T | undefined> {
  const res = await db.query<T>(text, params);
  return res.rows[0];
}

/** Run a statement and return how many rows it changed. */
export async function execute(text: string, params: unknown[] = [], db: Queryable = pool): Promise<number> {
  const res = await db.query(text, params);
  return res.rowCount ?? 0;
}

/**
 * Run `fn` inside BEGIN/COMMIT on a single connection.
 * Anything thrown rolls the whole transaction back.
 */
export async function withTransaction<T>(fn: (client: PoolClient) => Promise<T>): Promise<T> {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await fn(client);
    await client.query('COMMIT');
    return result;
  } catch (err) {
    await client.query('ROLLBACK').catch(() => undefined);
    throw err;
  } finally {
    client.release();
  }
}

/** Fail fast on boot if the database is unreachable. */
export async function checkConnection(): Promise<void> {
  const row = await queryOne<{ now: string; tz: string }>(`SELECT now()::text AS now, current_setting('TimeZone') AS tz`);
  console.log(`🐘 Connected to Postgres at ${url.hostname} (${row?.tz})`);
}

export default pool;
