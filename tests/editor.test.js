import test from 'node:test';
import assert from 'node:assert/strict';
import sharp from 'sharp';
import { editorConfig, checkOrigin, publishConfig } from '../lib/editor/config.js';
import { requireEditor, sendCode, verifyCode, readSessionCookie, sessionCookie, callAuth } from '../lib/editor/auth.js';
import { EditorError } from '../lib/editor/errors.js';
import { normalizeImage, readBytes, MAX_UPLOAD_BYTES } from '../lib/editor/media.js';
import { handleEditor } from '../lib/editor/handler.js';
import { deploymentPayload, verifyDeployment } from '../lib/editor/publish.js';
const env = { EDITOR_ENABLED: 'true', EDITOR_ENVIRONMENT: 'staging', EDITOR_ORIGINS: 'http://localhost:4321,https://staging.example.com', NEON_AUTH_BASE_URL: 'https://example.neon.tech/db/auth', DATABASE_URL: 'postgresql://example.invalid/db', EDITOR_OTP_EMAILS: 'sam@sampenny.io' };
const request = (method = 'GET', cookie = '', origin = 'http://localhost:4321') => new Request('http://localhost:4321/api/editor', { method, headers: { ...(origin ? { origin } : {}), ...(cookie ? { cookie } : {}) } });
const session = () => ({ session: { expiresAt: new Date(Date.now() + 60000).toISOString() }, user: { id: 'neon-user-1', email: 'sam@sampenny.io', emailVerified: true } });
const signedCookie = '__Secure-neon-auth.session_token=opaque.signature%2Bvalue%3D';
const browserCookie = `velocity_staging_session=${encodeURIComponent(signedCookie)}`;

test('editor is disabled by default and rejects production and unsafe origins', () => {
  assert.throws(() => editorConfig({}), { status: 503 });
  assert.throws(() => editorConfig({ ...env, VERCEL_ENV: 'production' }), { status: 503 });
  assert.throws(() => editorConfig({ ...env, EDITOR_ORIGINS: 'https://velocitymarketing.com.au' }), { status: 503 });
  assert.throws(() => editorConfig({ ...env, EDITOR_ORIGINS: 'http://untrusted.test' }), { status: 503 });
  for (const origin of [undefined, 'https://evil.example', 'null', 'https://staging.example.com.evil.test']) {
    assert.throws(() => checkOrigin(request('POST', '', origin || ''), editorConfig(env)), { status: 403 });
  }
  checkOrigin(request('POST'), editorConfig(env));
  assert.throws(() => publishConfig(env), { status: 503 });
});

test('anonymous requests cannot reach status, media, uploads or publishing', async () => {
  for (const action of ['status', 'image&id=7', 'publish-status&id=7', 'upload', 'publish']) {
    const req = new Request(`http://localhost:4321/api/editor?action=${action}`, { method: ['upload', 'publish'].includes(action) ? 'POST' : 'GET', headers: { origin: 'http://localhost:4321' } });
    const res = await handleEditor(req, env); assert.equal(res.status, 401); assert.match(res.headers.get('cache-control'), /no-store/);
  }
});

test('only a current verified Neon session plus current editor permission authorizes access', async () => {
  const req = request('GET', browserCookie);
  let checks = 0;
  const deps = { fetcher: async (url, init) => { assert.match(url, /get-session\?disableCookieCache=true$/); assert.equal(init.headers.Cookie, signedCookie); assert.equal(init.headers.Authorization, undefined); return Response.json(session()); }, approvedEditor: async (email, id) => { checks++; assert.equal(email, 'sam@sampenny.io'); assert.equal(id, 'neon-user-1'); return { email, role: 'owner' }; } };
  assert.equal((await requireEditor(req, env, deps)).role, 'owner');
  await requireEditor(req, env, deps); assert.equal(checks, 2, 'permission is rechecked each request');
  await assert.rejects(requireEditor(req, env, { ...deps, approvedEditor: async () => { throw new EditorError(403, 'Removed'); } }), { status: 403 });
  for (const data of [null, { ...session(), user: { ...session().user, emailVerified: false } }, { ...session(), session: { expiresAt: '2000-01-01' } }]) {
    await assert.rejects(requireEditor(req, env, { ...deps, fetcher: async () => Response.json(data) }), { status: 401 });
  }
  await assert.rejects(requireEditor(request('POST', 'velocity_staging_session=t', 'https://evil.test'), env, deps), { status: 403 });
});

test('OTP login preserves the signed provider cookie and proves the session before returning success', async () => {
  let signIns = 0; let sessionChecks = 0;
  const deps = {
    rateLimit: async () => {}, approvedEditor: async () => ({ email: 'sam@sampenny.io', role: 'owner' }),
    fetcher: async (url, init) => {
      if (url.endsWith('/sign-in/email-otp')) {
        signIns++;
        return Response.json({ token: 'unsigned-body-token', user: session().user }, { headers: { 'Set-Cookie': `${signedCookie}; Path=/; Secure; HttpOnly; SameSite=None` } });
      }
      sessionChecks++;
      // Reproduce Neon: a JSON bearer token cannot authenticate get-session.
      return Response.json(init.headers.Cookie === signedCookie ? session() : null);
    },
  };
  const cookie = await verifyCode('sam@sampenny.io', '123456', request('POST'), env, deps);
  assert.equal(signIns, 1); assert.equal(sessionChecks, 1);
  assert.equal(readSessionCookie(request('GET', cookie)), signedCookie);
  assert.ok(!cookie.includes('unsigned-body-token'));
  assert.equal((await requireEditor(request('GET', cookie), env, deps)).role, 'owner');
  await assert.rejects(verifyCode('sam@sampenny.io', '123456', request('POST'), env, {
    ...deps, fetcher: async () => Response.json({ token: 'unsigned-body-token', user: session().user }),
  }), { status: 503 });
  await assert.rejects(verifyCode('sam@sampenny.io', '123456', request('POST'), env, {
    ...deps, fetcher: async (url, init) => url.endsWith('/sign-in/email-otp') ? deps.fetcher(url, init) : Response.json(null),
  }), { status: 503 });
});

test('legacy and malformed credentials never authenticate; sign-out forwards the signed cookie', async () => {
  for (const token of ['unsigned-body-token', `${signedCookie}; injected=1`, `${signedCookie}\r\nX-Header: bad`]) {
    await assert.rejects(requireEditor(request('GET', `velocity_staging_session=${encodeURIComponent(token)}`), env, {
      fetcher: async () => { assert.fail('Invalid credentials must not be sent upstream'); },
    }), { status: 401 });
  }
  await callAuth('/sign-out', editorConfig(env), { token: signedCookie, body: {}, fetcher: async (_url, init) => {
    assert.equal(init.headers.Cookie, signedCookie);
    assert.equal(init.headers.Origin, 'http://localhost:4321');
    assert.equal(init.headers.Authorization, undefined);
    return Response.json({ success: true });
  } });
});

test('Mike and non-editors never trigger setup emails; Sam uses managed OTP', async () => {
  const sent = []; let permitted = true;
  const deps = { rateLimit: async () => {}, approvedEditor: async () => { if (!permitted) throw new EditorError(403, 'Removed'); }, fetcher: async (url, init) => { sent.push({ url, body: JSON.parse(init.body) }); return Response.json({ success: true }); } };
  await sendCode('mike@velocitymarketing.com.au', request('POST'), env, deps);
  await sendCode('stranger@example.com', request('POST'), env, deps); assert.equal(sent.length, 0);
  await sendCode('sam@sampenny.io', request('POST'), env, deps); assert.equal(sent.length, 1); assert.deepEqual(sent[0].body, { email: 'sam@sampenny.io', type: 'sign-in' });
  permitted = false; await sendCode('sam@sampenny.io', request('POST'), env, deps); assert.equal(sent.length, 1);
});

test('session cookie is private, narrowly scoped and secure on HTTPS', () => {
  const cookie = sessionCookie('token+special=', request('POST', '', 'https://staging.example.com'), editorConfig(env));
  for (const flag of ['HttpOnly', 'Secure', 'SameSite=Strict', 'Path=/api/editor', 'Max-Age=86400']) assert.ok(cookie.includes(flag));
  assert.equal(readSessionCookie(request('GET', cookie)), 'token+special=');
  assert.equal(readSessionCookie(request('GET', 'velocity_staging_session=%XX')), '');
  assert.match(sessionCookie('', request('POST'), editorConfig(env), true), /Max-Age=0/);
});

test('provider failures do not leak messages, tokens or credentials', async () => {
  for (const status of [400, 401, 429, 500]) {
    await assert.rejects(callAuth('/sign-in/email-otp', editorConfig(env), { fetcher: async () => Response.json({ message: 'SECRET' }, { status }) }), error => !error.message.includes('SECRET') && error.status === (status === 429 ? 429 : status === 500 ? 503 : 401));
  }
});

test('uploads are decoded, bounded, resized and re-encoded; spoofed content is rejected', async () => {
  const png = await sharp({ create: { width: 3000, height: 1000, channels: 3, background: '#7540b2' } }).png().toBuffer();
  const normalized = await normalizeImage(png, 'image/png');
  assert.equal(normalized.width, 2048); assert.equal(normalized.height, 683);
  const metadata = await sharp(normalized.data).metadata(); assert.equal(metadata.format, 'webp'); assert.equal(metadata.exif, undefined);
  await assert.rejects(normalizeImage(png, 'image/jpeg'), { status: 415 });
  await assert.rejects(normalizeImage(Buffer.from('<svg><script>bad()</script></svg>'), 'image/png'), { status: 415 });
  await assert.rejects(normalizeImage(Buffer.alloc(MAX_UPLOAD_BYTES + 1), 'image/png'), { status: 413 });
  await assert.rejects(readBytes(new Request('http://localhost', { method: 'POST', body: 'oversized' }), 4), { status: 413 });
});

test('deployment requests pin both source and revision and cannot choose production', () => {
  const config = { sha: 'a'.repeat(40), project: 'prj_123', team: 'team_123' };
  const job = { id: '00000000-0000-4000-8000-000000000001', revision_id: '00000000-0000-4000-8000-000000000002', source_sha: config.sha };
  const payload = deploymentPayload(config, job.revision_id, job.id);
  assert.equal(payload.target, undefined); assert.equal(payload.gitSource.sha, config.sha); assert.equal(payload.gitSource.ref, 'codex/visual-refresh');
  assert.ok(payload.projectSettings.buildCommand.startsWith(`VELOCITY_INTEGRATION_REVISION=${job.revision_id} `));
  const deployment = { projectId: config.project, ownerId: config.team, target: null, gitSource: { sha: config.sha }, meta: payload.meta };
  verifyDeployment(deployment, job, config);
  for (const override of [{ target: 'production' }, { projectId: 'other' }, { ownerId: 'other' }, { gitSource: { sha: 'b'.repeat(40) } }, { meta: { ...payload.meta, velocityIntegrationRevision: 'other' } }]) assert.throws(() => verifyDeployment({ ...deployment, ...override }, job, config), { status: 502 });
});
