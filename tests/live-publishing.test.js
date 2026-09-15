import test from 'node:test';
import assert from 'node:assert/strict';
import { contentDeploymentPayload, checkContentDeployment, startContentPublication } from '../lib/editor/content-publish.js';
import { resolvePublishedContent } from '../lib/editor/build-content.js';
import { publicationEnvironment, publishConfig } from '../lib/editor/config.js';
import { saveAndPublish } from '../lib/editor/save-publish.js';
import { loadStatus } from '../lib/editor/workspace.js';
import { publicationProgress, publicationEstimate } from '../lib/editor/progress.js';
import { initialContent } from '../lib/content/model.js';
const revision = '00000000-0000-4000-8000-000000000001';
const jobId = '00000000-0000-4000-8000-000000000002';
const sha = 'a'.repeat(40);
const env = { EDITOR_ENVIRONMENT: 'staging', VERCEL_ENV: 'preview', EDITOR_PUBLISH_TARGET: 'production', EDITOR_PUBLISH_ENABLED: 'true', EDITOR_VERCEL_PROJECT_ID: 'prj_test', EDITOR_VERCEL_TEAM_ID: 'team_test', EDITOR_VERCEL_TOKEN: 'test', EDITOR_APPROVED_SOURCE_SHA: sha };
const options = { environment: 'production', revisionId: revision, jobId, sourceSha: sha };
const job = { id: jobId, revision_id: revision, source_sha: sha, environment: 'production' };
const editor = { email: 'mike@velocitymarketing.com.au', role: 'editor' };
function database(overrides = {}) {
  return { query: async (sql, args) => {
    assert.doesNotMatch(sql, /drafts|UPDATE|INSERT/);
    if (sql.includes('content_publications')) {
      assert.deepEqual(args, [jobId]);
      return { rows: [{ ...job, ...overrides.job }] };
    }
    if (sql.includes('site_state')) {
      assert.deepEqual(args, ['production']);
      return { rows: overrides.empty ? [] : [{ revision_id: revision }] };
    }
    assert.deepEqual(args, [revision]);
    return { rows: overrides.missing ? [] : [{ kind: 'publish', source_sha: sha, snapshot: initialContent, ...overrides.revision }] };
  } };
}
test('live publishing uses the server destination, exact saved revision and approved source', () => {
  const config = publishConfig(env);
  const payload = contentDeploymentPayload(config, revision, jobId);
  assert.equal(payload.target, 'production');
  assert.equal(payload.gitSource.sha, sha);
  assert.deepEqual(payload.env, { VELOCITY_CONTENT_REVISION: revision, VELOCITY_CONTENT_JOB: jobId });
  assert.equal(payload.meta.velocityEnvironment, 'production');
  assert.equal(payload.projectSettings, undefined);
  const deployment = { projectId: config.project, ownerId: config.team, target: 'production', meta: payload.meta, gitSource: { sha } };
  checkContentDeployment(deployment, job, config);
  for (const patch of [{ target: null }, { projectId: 'prj_wrong' }, { meta: { ...payload.meta, velocityEnvironment: 'staging' } }, { gitSource: { sha: 'b'.repeat(40) } }]) {
    assert.throws(() => checkContentDeployment({ ...deployment, ...patch }, job, config), { status: 502 });
  }
  assert.equal(publicationEnvironment({}), 'staging');
  assert.throws(() => publicationEnvironment({ EDITOR_PUBLISH_TARGET: 'anything' }), { status: 503 });
});
test('Mike can publish live; preview roles and stale staging tabs cannot save or publish live', async () => {
  let calls = 0;
  const dependencies = {
    saveDraft: async () => { calls++; return { version: 13 }; },
    startPublication: async (_key, version, who) => { calls++; assert.equal(version, 13); assert.equal(who.role, 'editor'); return { id: jobId, status: 'building' }; },
  };
  const body = { version: 12, key: jobId, content: initialContent, environment: 'production' };
  assert.equal((await saveAndPublish(body, editor, env, dependencies)).publication.status, 'building');
  assert.equal(calls, 2);
  for (const environment of [undefined, 'staging']) await assert.rejects(saveAndPublish({ ...body, environment }, editor, env, dependencies), { status: 409 });
  await assert.rejects(saveAndPublish(body, { ...editor, role: 'preview' }, env, dependencies), { status: 403 });
  await assert.rejects(startContentPublication(jobId, 12, { ...editor, role: 'preview' }, env), { status: 403 });
  assert.equal(calls, 2, 'Rejected requests never reach the draft or publisher');
});
test('production builds resolve the immutable publication and reject wrong jobs, sources, environments and private media', async () => {
  const result = await resolvePublishedContent(database(), options);
  assert.equal(result.revisionId, revision);
  assert.deepEqual(result.content, initialContent);
  for (const mismatch of [{ environment: 'staging' }, { revision_id: jobId }, { source_sha: 'b'.repeat(40) }]) {
    await assert.rejects(resolvePublishedContent(database({ job: mismatch }), options), /does not match/);
  }
  await assert.rejects(resolvePublishedContent(database(), { ...options, jobId: undefined }), /requires a publication job/);
  await assert.rejects(resolvePublishedContent(database({ missing: true }), options), /Missing published revision/);
  await assert.rejects(resolvePublishedContent(database({ revision: { kind: 'save' } }), options), /Missing published revision/);
  const content = structuredClone(initialContent);
  content.values['shared.profile.image'] = { ...content.values['shared.profile.image'], assetId: revision, src: `/api/editor?action=image&id=${revision}` };
  await assert.rejects(resolvePublishedContent(database({ revision: { snapshot: content } }), options), /Unpublished media/);
});
test('ordinary production code deployments retain the last confirmed live content and never load a moving draft', async () => {
  const selected = await resolvePublishedContent(database(), { environment: 'production', sourceSha: 'b'.repeat(40) });
  assert.equal(selected.revisionId, revision);
  assert.equal(await resolvePublishedContent(database({ empty: true }), { environment: 'production' }), null);
});
test('live workspace status uses only live publication history and live confirmation', async () => {
  const status = await loadStatus(env, { query: async (sql, args) => {
    assert.deepEqual(args, ['production']);
    assert.match(sql, /content_publications WHERE environment=\$1/);
    assert.match(sql, /s.environment=\$1/);
    return { rows: [{ publications: [], current: true }] };
  } });
  assert.equal(status.environment, 'production');
  assert.equal(status.publishedCurrent, true);
  assert.equal(status.stagingCurrent, false);
  assert.equal(status.publishingConfigured, true);
});
test('live progress describes live publishing, including failure and domain confirmation', () => {
  const estimate = publicationEstimate();
  for (const job of [null, { status: 'building', phase: 'checking' }, { status: 'failed' }, { status: 'ready' }]) {
    const progress = publicationProgress(job, estimate, Date.now(), 'production');
    assert.doesNotMatch(progress.title + progress.detail, /staging/i);
    assert.match(progress.title + progress.detail, /live/i);
  }
});
