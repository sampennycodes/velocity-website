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

// Resolve one immutable content revision once, then share its snapshot across all pages.
// Ordinary code deploys retain the last successful staging content, never the draft.
const { contentSchema, initialContent, fields } = await import('../lib/content/model.js');
let content = initialContent;
let contentRevisionId = null;
let requestedRevision = process.env.VELOCITY_CONTENT_REVISION;
const staging = process.env.EDITOR_ENVIRONMENT === 'staging' && process.env.VERCEL_ENV !== 'production';
// Read this build's immutable deployment metadata instead of mutating the
// project's shared build command or a moving environment-variable pointer.
if (staging && process.env.VERCEL_ENV === 'preview' && process.env.EDITOR_PUBLISH_ENABLED === 'true' && process.env.VERCEL_URL) {
  const { deploymentContentRevision } = await import('../lib/editor/build-context.js');
  const response = await fetch(`https://api.vercel.com/v13/deployments/${encodeURIComponent(process.env.VERCEL_URL)}?teamId=${process.env.EDITOR_VERCEL_TEAM_ID}`, {
    headers: { Authorization: `Bearer ${process.env.EDITOR_VERCEL_TOKEN}` },
    cache: 'no-store', redirect: 'error', signal: AbortSignal.timeout(20000),
  });
  if (!response.ok) throw new Error('Could not verify this content deployment.');
  requestedRevision = deploymentContentRevision(await response.json(), process.env) || requestedRevision;
}
if (requestedRevision || (staging && process.env.EDITOR_ENABLED === 'true' && process.env.DATABASE_URL)) {
  if (!staging || (requestedRevision && process.env.VERCEL_ENV !== 'preview')) throw new Error('Content publishing is staging-only.');
  if (requestedRevision && !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(requestedRevision)) throw new Error('Invalid content revision.');
  const pool = createPool(process.env.DATABASE_URL);
  try {
    let selectedId = requestedRevision;
    if (!selectedId) {
      const state = await pool.query("SELECT revision_id FROM velocity_editor.site_state WHERE environment = 'staging'");
      selectedId = state.rows[0]?.revision_id;
    }
    if (selectedId) {
      const { rows } = await pool.query('SELECT snapshot, source_sha, kind FROM velocity_editor.content_revisions WHERE id = $1', [selectedId]);
      const revision = rows[0];
      if (!revision || revision.kind !== 'publish' || (requestedRevision && revision.source_sha !== process.env.VERCEL_GIT_COMMIT_SHA)) throw new Error('Missing published revision or source commit mismatch.');
      content = contentSchema.parse(revision.snapshot);
      for (const field of fields.filter(f => f.type === 'image')) if (content.values[field.key].src.startsWith('/api/')) throw new Error('Unpublished media cannot appear in a public build.');
      contentRevisionId = selectedId;
      console.log(`Rendering saved content revision ${selectedId}`);
    }
  } finally { await pool.end(); }
}
await writeFile('.generated/editor-content.json', JSON.stringify(content));
await writeFile('.generated/editor-content-revision.json', JSON.stringify(contentRevisionId));
const { contactSettings } = await import('../lib/content/model.js');
await writeFile('.generated/contact-email-settings.json', JSON.stringify(contactSettings(content)));
