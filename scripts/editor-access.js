import { loadEnvFile } from 'node:process';
import { createPool } from '../lib/editor/connection.js';
try { loadEnvFile('.env'); } catch (error) { if (error.code !== 'ENOENT') throw error; }
if (process.env.EDITOR_ENVIRONMENT !== 'staging' || process.env.VERCEL_ENV === 'production') throw new Error('This setup is staging-only.');
const pool = createPool(process.env.DATABASE_URL_UNPOOLED);
try {
  // User-confirmed identities. Mike remains disabled until setup is complete.
  // Idempotent: never re-enables previously revoked accounts.
  await pool.query(`INSERT INTO velocity_editor.editors (email, role, enabled) VALUES
    ('sam@sampenny.io', 'owner', true), ('mike@velocitymarketing.com.au', 'editor', false)
    ON CONFLICT (email) DO NOTHING`);
  console.log('Editor access seeded. No invitations or emails sent.');
} finally { await pool.end(); }
