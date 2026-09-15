import test from 'node:test';
import assert from 'node:assert/strict';
import { submitContact } from '../lib/contact.js';
import { contactEmails } from '../lib/contact-email.js';
import { loadContactSettings } from '../lib/contact-settings.js';
import handler from '../api/contact.js';

const body = { name: 'Alex Smith', email: 'alex@example.com', phone: '', message: 'Hello Mike', website: '' };
const env = { RESEND_API_KEY_NEW: 'test-new-key-never-used' };
const neverSend = () => { throw new Error('Delivery must not be attempted'); };
const accepted = async () => ({ data: { id: 'mock-id' }, error: null });
const dependencies = (sendEmail = accepted, settings = {}) => ({ sendEmail, loadSettings: () => settings });

test('sends the enquiry then a personalised confirmation with separate recipients and reply addresses', async () => {
  const payloads = [];
  const result = await submitContact({ ...body, name: ' Alex Smith ', phone: '+61 400 000 000', message: '<img src=x onerror=alert(1)>\nA & B' }, env, dependencies(async email => { payloads.push(email); return accepted(); }));
  assert.equal(result.status, 200);
  assert.equal(payloads.length, 2);
  const [enquiry, confirmation] = payloads;
  for (const payload of payloads) assert.equal(payload.from, 'Velocity Marketing <website@velocitymarketing.com.au>');
  assert.deepEqual(enquiry.to, ['mike@velocitymarketing.com.au']);
  assert.equal(enquiry.replyTo, body.email);
  assert.equal(enquiry.subject, 'New enquiry from Alex Smith');
  assert.ok(enquiry.html.includes('&lt;img src=x onerror=alert(1)&gt;<br>A &amp; B'));
  assert.ok(enquiry.text.includes('<img src=x onerror=alert(1)>'));
  assert.deepEqual(confirmation.to, [body.email]);
  assert.equal(confirmation.replyTo, 'mike@velocitymarketing.com.au');
  assert.equal(confirmation.subject, 'Thanks for contacting Velocity Marketing');
  assert.match(confirmation.text, /^Hi Alex,\n\nThanks for your email\. We’ll get back to you as soon as possible\./);
  assert.ok(!confirmation.text.includes('<img'), 'Do not reflect a submitted message into the receipt');
});

test('malformed, blank, oversized, bot and invalid-email submissions cannot send or load settings', async () => {
  for (const invalid of [null, [], {}, { ...body, name: ' ' }, { ...body, email: 'bad-email' }, { ...body, email: 'x@example.com\nBcc:evil@example.com' }, { ...body, message: 42 }, { ...body, message: 'x'.repeat(10001) }, { ...body, website: 'spam' }, { ...body, name: 'Alex\nInjected' }, { ...body, name: 'Al\x00ex' }]) {
    assert.equal((await submitContact(invalid, env, { sendEmail: neverSend, loadSettings: neverSend })).status, 400);
  }
});

test('preview, disabled delivery and missing keys block both emails before reading settings', async () => {
  for (const config of [{ ...env, VERCEL_ENV: 'preview' }, { ...env, CONTACT_FORM_DISABLED: 'true' }, {}, { RESEND_API_KEY_NEW: ' ' }, { SEND_EMAIL_FROM: 'website@velocitymarketing.com.au' }]) {
    assert.equal((await submitContact(body, config, { sendEmail: neverSend, loadSettings: neverSend })).status, 503);
  }
});

test('enquiry provider rejection, malformed responses and network failure skip confirmation and never report success', async () => {
  for (const send of [async () => ({ error: { message: 'rejected' }, data: null }), async () => ({ data: {} }), async () => undefined, async () => { throw new Error('offline'); }]) {
    let calls = 0;
    const result = await submitContact(body, env, dependencies(async payload => { calls++; return send(payload); }));
    assert.equal(result.status, 502);
    assert.equal(calls, 1);
  }
});

test('a rejected or failed confirmation preserves the accepted enquiry and logs no lead details', async () => {
  for (const fail of [async () => ({ error: { message: 'rejected' } }), async () => { throw new Error('offline'); }]) {
    let calls = 0;
    const logs = [];
    const result = await submitContact(body, env, {
      ...dependencies(async () => ++calls === 1 ? accepted() : fail()),
      logger: { error: message => logs.push(message) },
    });
    assert.equal(result.status, 200);
    assert.equal(result.body.success, true);
    assert.equal(calls, 2);
    assert.equal(logs.length, 1);
    assert.ok(!logs[0].includes(body.email));
  }
});

test('CMS settings control both emails and cannot be overridden by public form fields or obsolete environment addresses', async () => {
  const settings = {
    'shared.emails.senderName': 'Velocity enquiries',
    'shared.emails.senderEmail': 'contact@velocitymarketing.com.au',
    'shared.emails.recipientEmail': 'inbox@example.com',
    'shared.emails.replyToEmail': 'replies@example.com',
    'shared.emails.notificationSubject': 'Hello from {name}',
    'shared.emails.notificationMessage': 'A new lead: {firstName}',
    'shared.emails.confirmationSubject': 'Thanks, {firstName}',
    'shared.emails.confirmationMessage': 'Hi {name},\n\nWe have your enquiry.\nA & B <script>alert(1)</script>',
  };
  const payloads = [];
  await submitContact({ ...body, to: 'attacker@example.com', from: 'evil@example.com', settings: {} }, { ...env, SEND_EMAIL_FROM: 'old@example.com', SEND_EMAIL_TO: 'old@example.com' }, dependencies(async payload => { payloads.push(payload); return accepted(); }, settings));
  assert.equal(payloads.length, 2);
  assert.equal(payloads[0].from, 'Velocity enquiries <contact@velocitymarketing.com.au>');
  assert.deepEqual(payloads[0].to, ['inbox@example.com']);
  assert.equal(payloads[0].subject, 'Hello from Alex Smith');
  assert.match(payloads[0].text, /^A new lead: Alex\n\nName: Alex Smith/);
  assert.equal(payloads[1].subject, 'Thanks, Alex');
  assert.equal(payloads[1].replyTo, 'replies@example.com');
  assert.deepEqual(payloads[1].to, [body.email]);
  assert.match(payloads[1].html, /A &amp; B &lt;script&gt;alert\(1\)&lt;\/script&gt;/);
  assert.ok(!payloads[1].html.includes('<script>'));
});

test('confirmation substitutes names literally and escapes HTML', () => {
  const [, confirmation] = contactEmails({ ...body, name: '<Alex> $& {name}' });
  assert.match(confirmation.html, /Hi &lt;Alex&gt;,/);
  assert.ok(!confirmation.html.includes('<Alex>'));
  const [enquiry] = contactEmails({ ...body, name: 'Alex $& {name}' });
  assert.equal(enquiry.subject, 'New enquiry from Alex $& {name}');
});

test('invalid or unavailable published settings fail without sending', async () => {
  for (const loadSettings of [() => { throw new Error('Missing snapshot'); }, () => ({ 'shared.emails.recipientEmail': 'invalid' }), () => ({ 'shared.emails.senderEmail': 'not-an-email' })]) {
    const result = await submitContact(body, env, { sendEmail: neverSend, loadSettings, logger: { error() {} } });
    assert.equal(result.status, 503);
  }
});

test('real SDK selects the new key first with legacy key fallback (network mocked)', async t => {
  const requests = [];
  t.mock.method(globalThis, 'fetch', async (url, options) => {
    assert.equal(String(url), 'https://api.resend.com/emails');
    requests.push({ key: new Headers(options.headers).get('authorization'), payload: JSON.parse(options.body) });
    return Response.json({ id: 'mock-sdk-id' });
  });
  for (const [config, key] of [
    [{ RESEND_API_KEY_NEW: 'new-key', RESEND_API_KEY: 'old-key' }, 'new-key'],
    [{ RESEND_API_KEY: 'old-key' }, 'old-key'],
    [{ RESEND_API_KEY_NEW: ' ', RESEND_API_KEY: 'old-key' }, 'old-key'],
  ]) {
    assert.equal((await submitContact(body, config, { loadSettings: () => ({}) })).status, 200);
    assert.equal(requests.at(-1).key, `Bearer ${key}`);
    assert.equal(requests.at(-2).key, `Bearer ${key}`);
    assert.equal(requests.at(-1).payload.reply_to, 'mike@velocitymarketing.com.au');
  }
});

test('Vercel adapter rejects non-POST and malformed bodies', async () => {
  let status; let output; const headers = {};
  const res = { setHeader(key, value) { headers[key] = value; }, status(value) { status = value; return this; }, json(value) { output = value; return this; } };
  await handler({ method: 'GET' }, res);
  assert.equal(status, 405); assert.equal(headers.Allow, 'POST'); assert.equal(headers['Cache-Control'], 'no-store');
  await handler({ method: 'POST', body: null }, res);
  assert.equal(status, 400); assert.equal(output.success, false);
});

test('packaged contact settings follow the build snapshot', async t => {
  // This check is exercised after the build, without needing email or database access.
  const { existsSync, readFileSync } = await import('node:fs');
  if (!existsSync('.generated/contact-email-settings.json')) return t.skip('Run npm run build to verify the packaged snapshot.');
  const built = JSON.parse(readFileSync('.generated/editor-content.json', 'utf8'));
  assert.deepEqual(loadContactSettings(), Object.fromEntries(Object.entries(built.values).filter(([key]) => key.startsWith('shared.emails.'))));
});

test('optional confirmation reply-to is omitted by the SDK and never changes lead reply routing', async t => {
  const requests = [];
  t.mock.method(globalThis, 'fetch', async (_url, options) => {
    requests.push(JSON.parse(options.body));
    return Response.json({ id: 'mock-sdk-id' });
  });
  for (const replyTo of ['', '   ']) {
    const result = await submitContact(body, env, {loadSettings: () => ({
      'shared.emails.senderEmail': 'hello@another-verified-domain.example',
      'shared.emails.replyToEmail': replyTo,
    })});
    assert.equal(result.status, 200);
    assert.equal(requests.at(-2).reply_to, body.email);
    assert.equal(Object.hasOwn(requests.at(-1), 'reply_to'), false);
    assert.equal(requests.at(-1).from, 'Velocity Marketing <hello@another-verified-domain.example>');
    assert.match(requests.at(-1).html, /Thanks for your email/);
    assert.match(requests.at(-1).text, /Thanks for your email/);
  }
});
