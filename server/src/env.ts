// Loads server/.env for local development. Imported first in index.ts so the
// variables exist before any other module reads them. On Render the real
// environment variables are used and no .env file is present.
import fs from 'fs';
import path from 'path';

const envPath = path.resolve(__dirname, '../.env');

if (fs.existsSync(envPath)) {
  if (typeof process.loadEnvFile === 'function') {
    process.loadEnvFile(envPath); // Node ≥ 20.12; doesn't override variables that are already set
  } else {
    console.warn('⚠️  server/.env found but this Node version cannot load it — upgrade to Node 20.12+');
  }
}
