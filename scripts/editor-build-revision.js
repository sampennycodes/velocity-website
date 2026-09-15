import { loadEnvFile } from 'node:process';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
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
// Ordinary code deploys retain the last successful content for their environment, never the draft.
const { contentSchema, initialContent, fields } = await import('../lib/content/model.js');
let content = initialContent;
let contentRevisionId = null;
let requestedRevision = process.env.VELOCITY_CONTENT_REVISION;
if (process.env.VERCEL_ENV === 'production') {
  if (process.env.PUBLIC_SITE_PREVIEW === 'true' || process.env.CONTACT_FORM_DISABLED === 'true') {
    throw new Error('Production release requires preview mode and contact-form disabling to be off.');
  }
  const { productionRelease } = await import('../lib/content/production.js');
  const release = productionRelease(JSON.parse(await readFile('content/production.json', 'utf8')));
  content = release.content;
  contentRevisionId = release.revisionId;
  console.log(`Rendering approved production content revision ${contentRevisionId}`);
}
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
const production = process.env.VERCEL_ENV === 'production';
const liveContent = production && process.env.EDITOR_CONTENT_ENABLED === 'true';
if (production && requestedRevision && !liveContent) throw new Error('Live content publishing is not configured.');
if (requestedRevision || liveContent || (staging && process.env.EDITOR_ENABLED === 'true' && process.env.DATABASE_URL)) {
  if (!staging && !liveContent) throw new Error('Content publishing is not configured.');
  if (requestedRevision && !['preview', 'production'].includes(process.env.VERCEL_ENV)) throw new Error('Pinned content requires a Vercel deployment.');
  const connection = production ? process.env.EDITOR_CONTENT_DATABASE_URL : process.env.DATABASE_URL;
  if (!connection) throw new Error('The content build database is not configured.');
  const pool = createPool(connection);
  try {
    const { resolvePublishedContent } = await import('../lib/editor/build-content.js');
    const selected = await resolvePublishedContent(pool, {
      environment: production ? 'production' : 'staging', revisionId: requestedRevision,
      jobId: process.env.VELOCITY_CONTENT_JOB, sourceSha: process.env.VERCEL_GIT_COMMIT_SHA,
    });
    if (selected) {
      content = selected.content;
      contentRevisionId = selected.revisionId;
      console.log(`Rendering saved content revision ${contentRevisionId}`);
    }
  } finally { await pool.end(); }
}
await writeFile('.generated/editor-content.json', JSON.stringify(content));
await writeFile('.generated/editor-content-revision.json', JSON.stringify(contentRevisionId));
const { contactSettings } = await import('../lib/content/model.js');
await writeFile('.generated/contact-email-settings.json', JSON.stringify(contactSettings(content)));
