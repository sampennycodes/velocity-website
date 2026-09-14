import { createPool } from './connection.js';
import { attachDatabasePool } from '@vercel/functions';
import { drizzle } from 'drizzle-orm/neon-serverless';
import { createHash } from 'node:crypto';
import { insist } from './errors.js';
let pool;
export function getPool(env = process.env) {
  if (!pool) {
    insist(env.DATABASE_URL, 503, 'The editor database is not configured.');
    pool = createPool(env.DATABASE_URL);
    attachDatabasePool(pool);
  }
  return pool;
}
export const getDb = env => drizzle(getPool(env));
export async function approvedEditor(email, userId, env) {
  const p = getPool(env);
  const { rows } = await p.query('SELECT email, role, user_id FROM velocity_editor.editors WHERE email = $1 AND enabled = true', [email.toLowerCase()]);
  const editor = rows[0];
  insist(editor && (!editor.user_id || !userId || editor.user_id === userId), 403, 'This account does not have editor access. Please contact Sam.');
  if (userId && !editor.user_id) {
    const bound = await p.query('UPDATE velocity_editor.editors SET user_id = $1 WHERE email = $2 AND enabled = true AND (user_id IS NULL OR user_id = $1) RETURNING email', [userId, editor.email]);
    insist(bound.rowCount === 1, 403, 'This account does not have editor access.');
  }
  return { email: editor.email, role: editor.role };
}
export async function rateLimit(scope, identity, limit, seconds, env) {
  const key = createHash('sha256').update(`${scope}:${identity}`).digest('hex');
  const { rows } = await getPool(env).query(`INSERT INTO velocity_editor.rate_limits (key, count, reset_at)
    VALUES ($1, 1, now() + $2 * interval '1 second')
    ON CONFLICT (key) DO UPDATE SET count = CASE WHEN velocity_editor.rate_limits.reset_at <= now() THEN 1 ELSE velocity_editor.rate_limits.count + 1 END,
    reset_at = CASE WHEN velocity_editor.rate_limits.reset_at <= now() THEN now() + $2 * interval '1 second' ELSE velocity_editor.rate_limits.reset_at END
    RETURNING count`, [key, seconds]);
  insist(rows[0].count <= limit, 429, 'Too many attempts. Please wait a few minutes and try again.');
}
