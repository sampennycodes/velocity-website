import { randomUUID } from 'node:crypto';
import { getPool } from './db.js';
import { publishConfig } from './config.js';
import { insist, EditorError } from './errors.js';
export function deploymentPayload(config, revisionId, jobId) {
  insist(/^[0-9a-f-]{36}$/.test(revisionId), 400, 'Invalid revision.');
  return {
    name: 'velocity-website', project: config.project,
    // Omit target: Vercel documents this as preview. Never use production or promotion.
    gitSource: { type: 'github', org: 'sampennycodes', repo: 'velocity-website', ref: 'codex/visual-refresh', sha: config.sha },
    projectSettings: { buildCommand: `VELOCITY_INTEGRATION_REVISION=${revisionId} npm run build` },
    meta: { velocityIntegrationRevision: revisionId, velocityIntegrationJob: jobId, velocitySourceSha: config.sha, velocityEnvironment: 'staging' },
  };
}
async function vercel(path, config, body) {
  return fetch(`https://api.vercel.com${path}${path.includes('?') ? '&' : '?'}teamId=${config.team}`, {
    method: body ? 'POST' : 'GET', headers: { Authorization: `Bearer ${config.token}`, ...(body ? { 'Content-Type': 'application/json' } : {}) },
    body: body ? JSON.stringify(body) : undefined, cache: 'no-store', redirect: 'error', signal: AbortSignal.timeout(20000),
  });
}
export function verifyDeployment(deployment, job, config) {
  insist(deployment.projectId === config.project && deployment.ownerId === config.team && deployment.target == null,
    502, 'The deployment does not match the staging project. Sam must inspect it.');
  insist(deployment.meta?.velocityIntegrationRevision === job.revision_id && deployment.meta?.velocityIntegrationJob === job.id && deployment.meta?.velocitySourceSha === job.source_sha && deployment.meta?.velocityEnvironment === 'staging',
    502, 'The deployment revision does not match this publishing request.');
  insist(deployment.gitSource?.sha === job.source_sha || deployment.meta?.githubCommitSha === job.source_sha, 502, 'The deployed source commit could not be verified.');
}
const publicJob = row => ({ id: row.id, revisionId: row.revision_id, status: row.status, url: row.deployment_url, error: row.error, createdAt: row.created_at });
export async function startPublication(key, editor, env) {
  insist(editor.role === 'owner', 403, 'Only the owner can run the integration deployment.');
  const config = publishConfig(env); const pool = getPool(env);
  // Resolve the configured project before any deployment mutation.
  const projectResponse = await vercel(`/v9/projects/${config.project}`, config);
  insist(projectResponse.ok, 503, 'The publishing credential cannot access the Vercel project.');
  const project = await projectResponse.json();
  insist(project.id === config.project && project.accountId === config.team && project.name === 'velocity-website' && project.link?.org === 'sampennycodes' && project.link?.repo === 'velocity-website', 503, 'The publishing configuration does not match the Velocity website.');
  const client = await pool.connect(); let job;
  try {
    await client.query('BEGIN');
    await client.query("SELECT pg_advisory_xact_lock(hashtext('velocity-editor-staging-publish'))");
    const existing = await client.query('SELECT * FROM velocity_editor.integration_publications WHERE idempotency_key = $1', [key]);
    if (existing.rows[0]) { await client.query('COMMIT'); return publicJob(existing.rows[0]); }
    const active = await client.query("SELECT id FROM velocity_editor.integration_publications WHERE status IN ('preparing', 'building', 'unknown') LIMIT 1");
    insist(!active.rowCount, 409, 'Another staging deployment is in progress. Check its status before starting a new one.');
    const revisionId = randomUUID(); const jobId = randomUUID();
    await client.query(`INSERT INTO velocity_editor.integration_revisions (id, author, source_sha, snapshot) VALUES ($1,$2,$3,$4)`,
      [revisionId, editor.email, config.sha, { schemaVersion: 0, kind: 'integration-proof', sourceSha: config.sha }]);
    const inserted = await client.query('INSERT INTO velocity_editor.integration_publications (id, revision_id, idempotency_key) VALUES ($1,$2,$3) RETURNING *', [jobId, revisionId, key]);
    job = inserted.rows[0];
    await client.query('COMMIT');
  } catch (error) { await client.query('ROLLBACK'); throw error; } finally { client.release(); }
  let response;
  try { response = await vercel('/v13/deployments', config, deploymentPayload(config, job.revision_id, job.id)); }
  catch {
    // An ambiguous network result is not a failed deployment: keep the lock and reconcile by metadata.
    await pool.query("UPDATE velocity_editor.integration_publications SET status = 'unknown', error = $2, updated_at = now() WHERE id = $1", [job.id, 'Vercel has not confirmed the request. Check status; do not start another deployment.']);
    return { ...publicJob(job), status: 'unknown' };
  }
  if (!response.ok) {
    // 5xx might arrive after Vercel accepted the mutation. Keep those jobs locked.
    const status = response.status >= 500 ? 'unknown' : 'failed';
    const error = status === 'unknown' ? 'Vercel has not confirmed the request. Check status.' : 'Vercel rejected the staging deployment. Check project access and the approved source commit, then retry.';
    await pool.query('UPDATE velocity_editor.integration_publications SET status = $2, error = $3, updated_at = now() WHERE id = $1', [job.id, status, error]);
    return { ...publicJob(job), status, error };
  }
  let result;
  try { result = await response.json(); } catch { result = {}; }
  if (!/^dpl_[A-Za-z0-9]+$/.test(result.id || '')) {
    await pool.query("UPDATE velocity_editor.integration_publications SET status = 'unknown', updated_at = now() WHERE id = $1", [job.id]);
    return { ...publicJob(job), status: 'unknown' };
  }
  await pool.query("UPDATE velocity_editor.integration_publications SET status = 'building', deployment_id = $2, updated_at = now() WHERE id = $1", [job.id, result.id]);
  return { ...publicJob(job), status: 'building' };
}
export async function publicationStatus(id, env) {
  const config = publishConfig(env); const pool = getPool(env);
  const { rows } = await pool.query(`SELECT p.*, r.source_sha FROM velocity_editor.integration_publications p JOIN velocity_editor.integration_revisions r ON r.id = p.revision_id WHERE p.id = $1`, [id]);
  const job = rows[0]; insist(job, 404, 'Deployment not found.');
  if (['ready', 'failed'].includes(job.status)) return publicJob(job);
  if (!job.deployment_id) {
    const response = await vercel(`/v6/deployments?projectId=${config.project}&limit=100&since=${new Date(job.created_at).getTime() - 60000}`, config);
    insist(response.ok, 503, 'Vercel status is temporarily unavailable.');
    const data = await response.json();
    const matches = (data.deployments || []).filter(d => d.meta?.velocityIntegrationJob === job.id);
    insist(matches.length <= 1, 502, 'Multiple deployments match this job. Sam must inspect Vercel.');
    if (!matches[0]) return { ...publicJob(job), error: 'Waiting for Vercel confirmation. If this persists, Sam must inspect the request before retrying.' };
    job.deployment_id = matches[0].uid;
    insist(/^dpl_[A-Za-z0-9]+$/.test(job.deployment_id || ''), 502, 'Vercel returned an invalid deployment identifier.');
    await pool.query('UPDATE velocity_editor.integration_publications SET deployment_id = $2, updated_at = now() WHERE id = $1', [id, job.deployment_id]);
  }
  const response = await vercel(`/v13/deployments/${job.deployment_id}`, config);
  insist(response.ok, 503, 'Vercel status is temporarily unavailable.');
  const deployment = await response.json(); verifyDeployment(deployment, job, config);
  const status = deployment.readyState === 'READY' ? 'ready' : ['ERROR', 'CANCELED'].includes(deployment.readyState) ? 'failed' : 'building';
  const url = /^[a-z0-9.-]+\.vercel\.app$/.test(deployment.url || '') ? `https://${deployment.url}` : null;
  const error = status === 'failed' ? 'The staging build failed. The current website is unchanged. You can retry after Sam checks the build log.' : null;
  await pool.query('UPDATE velocity_editor.integration_publications SET status = $2, deployment_url = $3, error = $4, updated_at = now() WHERE id = $1', [id, status, url, error]);
  return { ...publicJob(job), status, url, error };
}
