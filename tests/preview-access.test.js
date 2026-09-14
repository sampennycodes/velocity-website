import test from 'node:test';
import assert from 'node:assert/strict';
import { handleEditor } from '../lib/editor/handler.js';
import { loadDraft, saveDraft, restoreDraft } from '../lib/editor/content.js';
import { initialContent, contentSchema } from '../lib/content/model.js';
import { previewImageSource } from '../lib/content/preview.js';
import { sendCode } from '../lib/editor/auth.js';

const origin = 'https://staging.example.com';
const env = { EDITOR_ENABLED: 'true', EDITOR_ENVIRONMENT: 'staging', EDITOR_ORIGINS: origin, NEON_AUTH_BASE_URL: 'https://example.neon.tech/auth', DATABASE_URL: 'postgresql://example.invalid/db', EDITOR_OTP_EMAILS: 'sam@sampenny.io,mike@velocitymarketing.com.au' };
const mike = { email: 'mike@velocitymarketing.com.au', role: 'preview' };
const cookie = 'velocity_staging_session=' + encodeURIComponent('__Secure-neon-auth.session_token=test.signature');
const auth = {
  approvedEditor: async () => mike,
  fetcher: async () => Response.json({ session: { expiresAt: new Date(Date.now() + 60000).toISOString() }, user: { id: 'mike-test', email: mike.email, emailVerified: true } }),
};
const request = (action, method = 'GET') => new Request(origin + '/api/editor?action=' + action, { method, headers: { origin, cookie } });

test('authenticated preview access cannot save, restore, upload, publish or reconcile publication jobs', async () => {
  for (const [action, method] of [['save', 'POST'], ['restore', 'POST'], ['upload', 'POST'], ['publish', 'POST'], ['publish-status&id=invalid', 'GET']]) {
    const response = await handleEditor(request(action, method), env, { auth });
    assert.equal(response.status, 403, action);
    assert.match((await response.json()).message, /Preview-only/);
  }
  for (const [role, canSave] of [['preview', false], ['owner', true], ['editor', true], ['unknown', false]]) {
    const response = await handleEditor(request('session'), env, { auth: { ...auth, approvedEditor: async () => ({ ...mike, role }) } });
    assert.equal(response.status, 200);
    assert.equal((await response.json()).canSave, canSave);
  }
});

test('preview loading does not create drafts or history; content service rejects preview writes', async () => {
  const pool = { query: async sql => {
    assert.match(sql, /^SELECT \* FROM velocity_editor\.drafts/);
    return { rows: [] };
  }, connect: () => assert.fail('Preview access must not start a write transaction') };
  const result = await loadDraft(mike, env, { pool });
  assert.deepEqual(result.content, initialContent);
  assert.equal(result.revisionId, null);
  assert.equal(result.version, 0);
  await assert.rejects(saveDraft(initialContent, 1, mike, env, null, { pool }), { status: 403 });
  await assert.rejects(restoreDraft('any', 1, mike, env, { pool }), { status: 403 });
});

test('local preview images allow only same-origin blob URLs and remain invalid saved content', () => {
  const key = 'shared.profile.image';
  const blob = 'blob:' + origin + '/00000000-0000-4000-8000-000000000001';
  assert.equal(previewImageSource({ [key]: blob }, key, origin), blob);
  for (const source of [blob.replace(origin, 'https://evil.example'), 'javascript:alert(1)', 'data:image/svg+xml,bad', origin + '/image.png', blob + '?x=1', 'blob:' + origin + '/invalid']) {
    assert.equal(previewImageSource({ [key]: source }, key, origin), null);
  }
  const content = structuredClone(initialContent);
  content.values[key].src = blob;
  assert.equal(contentSchema.safeParse(content).success, false);
});

test('released preview account can request an OTP without sending invitations or granting write access', async () => {
  const calls = [];
  await sendCode(mike.email, request('send-code', 'POST'), env, {
    rateLimit: async () => {},
    approvedEditor: async email => { assert.equal(email, mike.email); return mike; },
    fetcher: async (url, init) => { calls.push({ url, body: JSON.parse(init.body) }); return Response.json({ success: true }); },
  });
  assert.equal(calls.length, 1);
  assert.match(calls[0].url, /email-otp\/send-verification-otp$/);
  assert.deepEqual(calls[0].body, { email: mike.email, type: 'sign-in' });
});
