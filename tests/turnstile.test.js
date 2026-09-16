import test from 'node:test';
import assert from 'node:assert/strict';
import { submitContact } from '../lib/contact.js';
import { verifyContactTurnstile } from '../lib/turnstile.js';

const env = { RESEND_API_KEY_NEW: 'unused-email-key', TURNSTILE_SECRET_KEY: 'unused-secret', VERCEL_ENV: 'production' };
const body = { name: 'Alex', email: 'alex@example.com', message: 'Hello', 'cf-turnstile-response': 'valid-token' };
const success = { success: true, hostname: 'velocitymarketing.com.au', action: 'contact' };

async function submitWith(fetchImpl, data = body, config = env) {
  const emails = [];
  const result = await submitContact(data, config, {
    fetchImpl, loadSettings: () => ({}),
    sendEmail: async payload => { emails.push(payload); return { data: { id: 'mock-id' } }; },
  });
  return { result, emails };
}

test('Siteverify succeeds before either email and receives only the secret and token', async () => {
  let verified = false;
  const emails = [];
  const result = await submitContact(body, env, {
    loadSettings: () => ({}),
    fetchImpl: async (url, options) => {
      assert.equal(url, 'https://challenges.cloudflare.com/turnstile/v0/siteverify');
      assert.equal(options.method, 'POST');
      assert.equal(options.redirect, 'error');
      assert.ok(options.signal instanceof AbortSignal);
      assert.deepEqual(JSON.parse(options.body), { secret: env.TURNSTILE_SECRET_KEY, response: body['cf-turnstile-response'] });
      verified = true;
      return Response.json(success);
    },
    sendEmail: async payload => {
      assert.equal(verified, true);
      emails.push(payload);
      return { data: { id: 'mock-id' } };
    },
  });
  assert.equal(result.status, 200);
  assert.equal(emails.length, 2);
  assert.ok(!JSON.stringify(emails).includes(body['cf-turnstile-response']));
  assert.equal(await verifyContactTurnstile('token', env, async () => Response.json({ ...success, hostname: 'www.velocitymarketing.com.au' })), null);
});

test('missing, malformed and oversized tokens cannot send emails or call Cloudflare', async () => {
  let calls = 0;
  for (const token of [undefined, null, '', ' ', 42, ['token'], {}, 'x'.repeat(2049)]) {
    const { result, emails } = await submitWith(async () => { calls++; return Response.json(success); }, { ...body, 'cf-turnstile-response': token, turnstileSuccess: true, preview: true });
    assert.equal(result.status, 403);
    assert.equal(emails.length, 0);
  }
  assert.equal(calls, 0);
});

test('invalid, expired, reused, wrong-action and wrong-host tokens cannot send emails', async () => {
  for (const response of [
    { success: false, 'error-codes': ['invalid-input-response'] },
    { success: false, 'error-codes': ['timeout-or-duplicate'] },
    { ...success, action: 'login' }, { ...success, action: undefined },
    { ...success, hostname: 'attacker.example' },
    { ...success, hostname: 'velocitymarketing.com.au.attacker.example' },
    { ...success, hostname: undefined },
  ]) {
    const { result, emails } = await submitWith(async () => Response.json(response));
    assert.equal(result.status, 403);
    assert.equal(result.body.success, false);
    assert.equal(emails.length, 0);
  }
});

test('Cloudflare outages and malformed responses fail closed without leaking upstream data', async () => {
  for (const fetchImpl of [
    async () => { throw new Error('private upstream failure'); },
    async () => { throw new DOMException('timeout', 'TimeoutError'); },
    async () => new Response('unavailable', { status: 503 }),
    async () => new Response('<html>bad response</html>'),
    async () => Response.json(null),
    async () => Response.json({ success: 'true', hostname: success.hostname, action: 'contact' }),
  ]) {
    const { result, emails } = await submitWith(fetchImpl);
    assert.equal(result.status, 503);
    assert.equal(emails.length, 0);
    assert.ok(!JSON.stringify(result).includes('private upstream'));
  }
});

test('missing configuration and production test keys cannot bypass verification', async () => {
  let calls = 0;
  for (const secret of [undefined, '', ' ', '1x0000000000000000000000000000000AA', '2x0000000000000000000000000000000AA', '3x0000000000000000000000000000000AA']) {
    const { result, emails } = await submitWith(async () => { calls++; return Response.json(success); }, body, { ...env, TURNSTILE_SECRET_KEY: secret });
    assert.equal(result.status, 503);
    assert.equal(emails.length, 0);
  }
  assert.equal(calls, 0);
});

test('preview and disabled contact delivery make no Cloudflare or email requests', async () => {
  let calls = 0;
  for (const config of [{ ...env, VERCEL_ENV: 'preview' }, { ...env, CONTACT_FORM_DISABLED: 'true' }]) {
    const { result, emails } = await submitWith(async () => { calls++; return Response.json(success); }, body, config);
    assert.equal(result.status, 503);
    assert.equal(emails.length, 0);
  }
  assert.equal(calls, 0);
});
