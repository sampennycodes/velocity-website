import test from 'node:test';
import assert from 'node:assert/strict';
import { submitContact } from '../lib/contact.js';
import handler from '../api/contact.js';

const body = { name: 'Alex Smith', email: 'alex@example.com', phone: '', message: 'Hello Mike', website: '' };
const env = { RESEND_API_KEY: 'test-key-never-used', SEND_EMAIL_FROM: 'Velocity Marketing <mike@velocitymarketing.com.au>' };
const neverSend = () => { throw new Error('Delivery must not be attempted'); };

test('new account sender, Mike recipient and visitor reply-to are correctly separated', async () => {
  let payload;
  const result = await submitContact({ ...body, name: ' Alex Smith ', phone: '+61 400 000 000', message: '<img src=x onerror=alert(1)>\nA & B' }, env, async email => { payload = email; return { data: { id: 'mock-id' }, error: null }; });
  assert.equal(result.status, 200);
  assert.equal(payload.from, env.SEND_EMAIL_FROM);
  assert.deepEqual(payload.to, ['mike@velocitymarketing.com.au']);
  assert.equal(payload.replyTo, body.email);
  assert.equal(payload.subject, 'New enquiry from Alex Smith');
  assert.ok(payload.html.includes('&lt;img src=x onerror=alert(1)&gt;<br>A &amp; B'));
  assert.ok(payload.text.includes('<img src=x onerror=alert(1)>'));
});
test('malformed, blank, oversized, bot and invalid-email submissions cannot send', async () => {
  for (const invalid of [null, [], {}, { ...body, name: ' ' }, { ...body, email: 'bad-email' }, { ...body, email: 'x@example.com\nBcc:evil@example.com' }, { ...body, message: 42 }, { ...body, message: 'x'.repeat(10001) }, { ...body, website: 'spam' }, { ...body, name: 'Alex\nInjected' }]) {
    assert.equal((await submitContact(invalid, env, neverSend)).status, 400);
  }
});
test('review environments and missing account configuration fail closed', async () => {
  for (const config of [{ ...env, VERCEL_ENV: 'preview' }, { ...env, CONTACT_FORM_DISABLED: 'true' }, { RESEND_API_KEY: 'test' }, { SEND_EMAIL_FROM: env.SEND_EMAIL_FROM }]) {
    assert.equal((await submitContact(body, config, neverSend)).status, 503);
  }
});
test('provider rejection and network failure never report success', async () => {
  for (const send of [async () => ({ error: { message: 'rejected' }, data: null }), async () => ({ data: {} }), async () => { throw new Error('offline'); }]) {
    assert.equal((await submitContact(body, env, send)).status, 502);
  }
});
test('explicit recipient override works', async () => {
  await submitContact(body, { ...env, SEND_EMAIL_TO: 'review@example.com' }, async payload => { assert.deepEqual(payload.to, ['review@example.com']); return { data: { id: 'mock' } }; });
});
test('Vercel adapter rejects non-POST and malformed bodies', async () => {
  let status; let output; const headers = {};
  const res = { setHeader(key, value) { headers[key] = value; }, status(value) { status = value; return this; }, json(value) { output = value; return this; } };
  await handler({ method: 'GET' }, res);
  assert.equal(status, 405); assert.equal(headers.Allow, 'POST'); assert.equal(headers['Cache-Control'], 'no-store');
  await handler({ method: 'POST', body: null }, res);
  assert.equal(status, 400); assert.equal(output.success, false);
});
