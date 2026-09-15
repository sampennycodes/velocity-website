import { contentSchema, fields } from '../content/model.js';

const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

// Public builds select immutable published content, never the editable draft.
export async function resolvePublishedContent(db, { environment, revisionId, jobId, sourceSha }) {
  if (!['staging', 'production'].includes(environment)) throw new Error('Invalid content environment.');
  if (revisionId && !uuid.test(revisionId)) throw new Error('Invalid content revision.');
  if (revisionId && environment === 'production') {
    if (!uuid.test(jobId || '')) throw new Error('Production content requires a publication job.');
    const { rows } = await db.query('SELECT revision_id, source_sha, environment FROM velocity_editor.content_publications WHERE id=$1', [jobId]);
    const job = rows[0];
    if (!job || job.environment !== environment || job.revision_id !== revisionId || job.source_sha !== sourceSha) {
      throw new Error('Production publication does not match the revision, source or destination.');
    }
  }
  let selectedId = revisionId;
  if (!selectedId) {
    const { rows } = await db.query('SELECT revision_id FROM velocity_editor.site_state WHERE environment=$1', [environment]);
    selectedId = rows[0]?.revision_id;
  }
  if (!selectedId) return null;
  const { rows } = await db.query('SELECT snapshot, source_sha, kind FROM velocity_editor.content_revisions WHERE id=$1', [selectedId]);
  const revision = rows[0];
  if (!revision || revision.kind !== 'publish' || (revisionId && revision.source_sha !== sourceSha)) {
    throw new Error('Missing published revision or source commit mismatch.');
  }
  const content = contentSchema.parse(revision.snapshot);
  for (const field of fields.filter(f => f.type === 'image')) {
    if (content.values[field.key].src.startsWith('/api/')) throw new Error('Unpublished media cannot appear in a public build.');
  }
  return { content, revisionId: selectedId };
}
