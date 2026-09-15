import test from 'node:test';
import assert from 'node:assert/strict';
import { stat } from 'node:fs/promises';
import { handleEditor } from '../lib/editor/handler.js';
import { loadWorkspace } from '../lib/editor/workspace.js';
import { publicationEstimate, publicationProgress } from '../lib/editor/progress.js';
import { responsiveImage } from '../lib/site.js';
import { initialContent } from '../lib/content/model.js';

const origin = 'https://staging.example.com';
const env = { EDITOR_ENABLED: 'true', EDITOR_ENVIRONMENT: 'staging', EDITOR_ORIGINS: origin, NEON_AUTH_BASE_URL: 'https://example.neon.tech/auth', DATABASE_URL: 'postgresql://example.invalid/db' };
const req = cookie => new Request(origin + '/api/editor?action=workspace', { headers: cookie ? { cookie } : {} });
const cookie = 'velocity_staging_session=' + encodeURIComponent('__Secure-neon-auth.session_token=test.signature');

test('combined workspace authenticates once, checks current access and never exposes data anonymously', async () => {
  let sessions = 0, permissions = 0, reads = 0;
  const dependencies = {
    auth: {
      fetcher: async () => { sessions++; return Response.json({ session: { expiresAt: new Date(Date.now() + 60000).toISOString() }, user: { id: 'test', email: 'mike@velocitymarketing.com.au', emailVerified: true } }); },
      approvedEditor: async () => { permissions++; return { email: 'mike@velocitymarketing.com.au', role: 'preview' }; },
    },
    workspace: {
      loadDraft: async editor => { reads++; assert.equal(editor.role, 'preview'); return { content: initialContent, version: 1 }; },
      loadStatus: async () => { reads++; return { publications: [], publishingConfigured: true }; },
    },
  };
  assert.equal((await handleEditor(req(), env, dependencies)).status, 401);
  assert.equal(reads, 0);
  const response = await handleEditor(req(cookie), env, dependencies);
  const data = await response.json();
  assert.equal(response.status, 200);
  assert.match(response.headers.get('cache-control'), /private, no-store/);
  assert.equal(sessions, 1);
  assert.equal(permissions, 1);
  assert.equal(reads, 2);
  assert.equal(data.session.canSave, false);
  assert.deepEqual(data.draft.content, initialContent);
  dependencies.auth.fetcher = async () => Response.json(null);
  assert.equal((await handleEditor(req(cookie), env, dependencies)).status, 401);
  assert.equal(reads, 2, 'expired sessions cannot read cached workspace data');
});

test('workspace loads independent data concurrently', async () => {
  let release;
  const waiting = new Promise(resolve => { release = resolve; });
  const result = await loadWorkspace({ email: 'sam@sampenny.io', role: 'owner' }, env, {
    loadDraft: async () => { await waiting; return { version: 4 }; },
    loadStatus: async () => { release(); return { stagingCurrent: true }; },
  });
  assert.equal(result.draft.version, 4);
  assert.equal(result.session.canSave, true);
});

test('publication estimates use completed builds and explain delays without pretending they are finished', () => {
  const start = '2026-09-15T01:00:00Z';
  const jobs = [23, 28, 27, 33, 23].map(seconds => ({ status: 'ready', created_at: start, updated_at: new Date(Date.parse(start) + seconds * 1000).toISOString() }));
  const estimate = publicationEstimate([...jobs, { status: 'failed', created_at: start, updated_at: '2026-09-15T02:00:00Z' }]);
  assert.deepEqual(estimate, { minSeconds: 20, maxSeconds: 45 });
  const job = { status: 'building', createdAt: start };
  const late = publicationProgress(job, estimate, Date.parse(start) + 61000);
  assert.equal(late.active, true);
  assert.equal(late.elapsed, '1m 1s elapsed');
  assert.match(late.detail, /longer than usual/);
  assert.match(publicationProgress({ ...job, phase: 'checking' }, estimate).title, /checking the staging link/);
  const ready = publicationProgress({ ...job, status: 'ready', updatedAt: jobs[0].updated_at }, estimate);
  assert.equal(ready.active, false);
  assert.match(ready.detail, /23s/);
  assert.match(publicationProgress(null, estimate).detail, /until your draft is saved/);
  assert.equal(publicationProgress({ ...job, status: 'failed' }, estimate).active, false);
});

test('responsive defaults are smaller and custom uploads never inherit an old portrait srcset', async () => {
  const optimized = responsiveImage('/img_8071.png');
  assert.match(optimized.srcset, /480w.*800w.*1200w/);
  assert.ok((await stat('public' + optimized.src)).size < (await stat('public/img_8071.png')).size / 4);
  for (const src of ['/api/editor?action=image&id=asset', 'https://store.public.blob.vercel-storage.com/custom.webp', 'blob:https://staging.example.com/test']) {
    assert.deepEqual(responsiveImage(src), { src });
  }
});
