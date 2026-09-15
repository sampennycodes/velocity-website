import test from 'node:test';
import assert from 'node:assert/strict';
import { saveAndPublish, monitorPublication } from '../lib/editor/save-publish.js';
import { deploymentContentRevision } from '../lib/editor/build-context.js';
import { EditorError } from '../lib/editor/errors.js';
import { initialContent } from '../lib/content/model.js';
const env = { EDITOR_PUBLISH_ENABLED: 'true', EDITOR_ENVIRONMENT: 'staging', EDITOR_VERCEL_PROJECT_ID: 'prj_test', EDITOR_VERCEL_TEAM_ID: 'team_test', EDITOR_VERCEL_TOKEN: 'test', EDITOR_APPROVED_SOURCE_SHA: 'a'.repeat(40), VERCEL_GIT_COMMIT_SHA: 'a'.repeat(40) };
const editor = { email: 'mike@velocitymarketing.com.au', role: 'editor' };
const body = { key: '00000000-0000-4000-8000-000000000001', version: 2, content: initialContent };
test('one save publishes precisely the saved version; preview and disabled publishing cannot start a write', async () => {
  const calls = [];
  const draft = { version: 3, content: initialContent };
  const dependencies = {
    saveDraft: async (content, version, who) => { calls.push('save'); assert.equal(version, 2); assert.equal(who, editor); return draft; },
    startPublication: async (key, version) => { calls.push('publish'); assert.equal(key, body.key); assert.equal(version, 3); return { id: 'job', status: 'building' }; },
  };
  assert.deepEqual(await saveAndPublish(body, editor, env, dependencies), { draft, publication: { id: 'job', status: 'building' }, publishError: null });
  assert.deepEqual(calls, ['save', 'publish']);
  await assert.rejects(saveAndPublish(body, { ...editor, role: 'preview' }, env, dependencies), { status: 403 });
  await assert.rejects(saveAndPublish(body, editor, { ...env, EDITOR_PUBLISH_ENABLED: 'false' }, dependencies), { status: 503 });
  assert.equal(calls.length, 2);
  await assert.rejects(saveAndPublish(body, editor, env, { ...dependencies, saveDraft: async () => { throw new EditorError(409, 'Conflict'); } }), { status: 409 });
  assert.equal(calls.length, 2, 'A conflicting save never publishes');
});
test('publishing failure preserves and reports the committed draft without leaking provider details', async () => {
  for (const error of [new Error('SECRET provider response'), new EditorError(503, 'Publishing is temporarily unavailable.')]) {
    const result = await saveAndPublish(body, editor, env, {
      saveDraft: async () => ({ version: 3, content: initialContent }),
      startPublication: async () => { throw error; },
    });
    assert.equal(result.draft.version, 3);
    assert.equal(result.publication, null);
    assert.ok(result.publishError);
    assert.ok(!result.publishError.includes('SECRET'));
  }
});
test('server monitoring survives transient errors and stops after confirmed completion', async () => {
  let elapsed = 0, checks = 0;
  await monitorPublication('job', env, {
    now: () => elapsed,
    pause: async ms => { elapsed += ms; },
    status: async id => { assert.equal(id, 'job'); checks++; if (checks === 1) throw Error('Temporary'); return { status: checks === 2 ? 'building' : 'ready' }; },
  });
  assert.equal(checks, 3);
  assert.equal(elapsed, 10000);
});
test('build revision comes only from the matching staging deployment metadata', () => {
  const deployment = { projectId: 'prj_test', ownerId: 'team_test', target: null, meta: { velocityContentRevision: body.key, velocitySourceSha: env.EDITOR_APPROVED_SOURCE_SHA, velocityEnvironment: 'staging' } };
  assert.equal(deploymentContentRevision(deployment, env), body.key);
  assert.equal(deploymentContentRevision({ meta: {} }, env), null);
  for (const change of [{ target: 'production' }, { projectId: 'prj_wrong' }, { ownerId: 'team_wrong' }, { meta: { ...deployment.meta, velocitySourceSha: 'b'.repeat(40) } }])
    assert.throws(() => deploymentContentRevision({ ...deployment, ...change }, env), { status: 403 });
});
