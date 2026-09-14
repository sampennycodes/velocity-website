import { loadEnvFile } from 'node:process';
import { mkdir, writeFile } from 'node:fs/promises';
import { createPool } from '../lib/editor/connection.js';
try { loadEnvFile('.env'); } catch (error) { if (error.code !== 'ENOENT') throw error; }
const id = process.env.VELOCITY_INTEGRATION_REVISION;
let proof = null;
if (id) {
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(id)) throw new Error('Invalid integration revision identifier.');
  if (process.env.EDITOR_ENVIRONMENT !== 'staging' || process.env.VERCEL_ENV !== 'preview') throw new Error('Pinned integration builds must run on a Vercel preview.');
  if (!process.env.VERCEL_GIT_COMMIT_SHA) throw new Error('Vercel source commit is required.');
  const pool = createPool(process.env.DATABASE_URL);
  try {
    const { rows } = await pool.query('SELECT id, source_sha, snapshot FROM velocity_editor.integration_revisions WHERE id = $1', [id]);
    const revision = rows[0];
    if (!revision || revision.source_sha !== process.env.VERCEL_GIT_COMMIT_SHA || revision.snapshot?.kind !== 'integration-proof' || revision.snapshot?.schemaVersion !== 0 || revision.snapshot?.sourceSha !== revision.source_sha) throw new Error('Missing or incompatible revision, or source commit mismatch.');
    proof = { revisionId: revision.id, sourceSha: revision.source_sha };
  } finally { await pool.end(); }
}
// Always overwrite so ordinary builds cannot reuse a cached proof.
await mkdir('.generated', { recursive: true });
await writeFile('.generated/editor-revision.json', JSON.stringify(proof));
console.log(proof ? `Building pinned integration revision ${proof.revisionId}` : 'Building the existing static content.');
