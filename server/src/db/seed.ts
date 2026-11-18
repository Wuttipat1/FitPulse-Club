/**
 * Reset + seed the database from the terminal (alternative to pasting
 * server/db/supabase.sql into the Supabase SQL Editor).
 *
 *   npm run db:setup -- --reset
 *
 * ⚠ Drops and recreates all FitPulse tables in the DATABASE_URL database.
 */
import '../env';
import fs from 'fs';
import path from 'path';
import { pool } from './database';

async function main() {
  if (!process.argv.includes('--reset')) {
    console.error('This wipes every FitPulse table. Re-run with:  npm run db:setup -- --reset');
    process.exit(1);
  }

  // src/db → server/db   (also works from dist/db)
  const sqlPath = path.resolve(__dirname, '../../db/supabase.sql');
  const sql = fs.readFileSync(sqlPath, 'utf8');

  const target = new URL(process.env.DATABASE_URL || 'postgresql://localhost').hostname;
  console.log(`Running ${path.relative(process.cwd(), sqlPath)} against ${target} …`);

  // A multi-statement script runs fine as a single simple query (no parameters).
  const results = await pool.query(sql);
  const last = Array.isArray(results) ? results[results.length - 1] : results;
  console.table(last.rows);
  console.log('✅ Database reset and seeded');
}

main()
  .catch((err) => {
    console.error('❌ Setup failed:', err.message);
    process.exitCode = 1;
  })
  .finally(() => pool.end());
