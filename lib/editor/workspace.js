import { getPool } from './db.js';
import { loadDraft } from './content.js';
import { canSaveContent } from './permissions.js';
import { publicationEstimate } from './progress.js';

export async function loadStatus(env, pool = getPool(env)) {
  const { rows } = await pool.query(`SELECT
    COALESCE((SELECT jsonb_agg(p ORDER BY p.created_at DESC) FROM (
      SELECT id, status, error, deployment_url, created_at, updated_at
      FROM velocity_editor.content_publications ORDER BY created_at DESC LIMIT 10
    ) p), '[]'::jsonb) AS publications,
    EXISTS(SELECT 1 FROM velocity_editor.site_state s
      JOIN velocity_editor.content_publications p ON p.id=s.publication_id
      JOIN velocity_editor.drafts d ON d.id='site'
      WHERE s.environment='staging' AND p.status='ready' AND p.created_at >= d.updated_at) AS current`);
  const publications = rows[0].publications;
  return { privateUploadsConfigured: Boolean(env.EDITOR_BLOB_PRIVATE_TOKEN),
    publishingConfigured: env.EDITOR_PUBLISH_ENABLED === 'true', stagingCurrent: rows[0].current,
    publications, estimate: publicationEstimate(publications) };
}

// The handler verifies the session and current permissions once for this request.
// Load independent draft/status data together instead of three browser round trips.
export async function loadWorkspace(editor, env, dependencies = {}) {
  const [draft, status] = await Promise.all([
    (dependencies.loadDraft || loadDraft)(editor, env),
    (dependencies.loadStatus || loadStatus)(env),
  ]);
  return { session: { email: editor.email, role: editor.role, canSave: canSaveContent(editor), environment: 'staging' }, draft, status };
}
