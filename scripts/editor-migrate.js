import { loadEnvFile } from 'node:process';
import { createPool } from '../lib/editor/connection.js';
import { drizzle } from 'drizzle-orm/neon-serverless';
import { migrate } from 'drizzle-orm/neon-serverless/migrator';
try { loadEnvFile('.env'); } catch (error) { if (error.code !== 'ENOENT') throw error; }
if (process.env.EDITOR_ENVIRONMENT !== 'staging' || process.env.VERCEL_ENV === 'production') throw new Error('This migration entrypoint is staging-only.');
const url = new URL(process.env.DATABASE_URL_UNPOOLED);
if (url.hostname.includes('-pooler')) throw new Error('Use a direct connection for migrations.');
const pool = createPool(url.href);
try {
  await migrate(drizzle(pool), { migrationsFolder: './db/migrations' });
  console.log('Editor staging migrations applied.');
} finally { await pool.end(); }
