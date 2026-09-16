import test from 'node:test';
import assert from 'node:assert/strict';
import { submitContact } from '../lib/contact.js';
import { contactEmails } from '../lib/contact-email.js';
import { loadContactSettings } from '../lib/contact-settings.js';
import { contactSettings } from '../lib/content/model.js';
import { referralOptions } from '../lib/contact-referral.js';
import { contactFormFields } from '../lib/contact-form.js';
import handler from '../api/contact.js';

const body = { name: 'Alex Smith', email: 'alex@example.com', phone: '', message: 'Hello Mike', website: '', 'cf-turnstile-response': 'mock-token' };
const env = { RESEND_API_KEY_NEW: 'test-new-key-never-used', TURNSTILE_SECRET_KEY: 'test-secret-never-used' };
const verified = async () => Response.json({ success: true, action: 'contact', hostname: 'velocitymarketing.com.au' });
const neverSend = () => { throw new Error('Delivery must not be attempted'); };
const accepted = async () => ({ data: { id: 'mock-id' }, error: null });
const dependencies = (sendEmail = accepted, settings = {}) => ({ sendEmail, loadSettings: () => settings, fetchImpl: verified });

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

test('malformed, empty, oversized, bot and invalid-email submissions cannot send or load settings', async () => {
  for (const invalid of [null, [], {}, { ...body, email: 'bad-email' }, { ...body, email: 'x@example.com\nBcc:evil@example.com' }, { ...body, message: 42 }, { ...body, message: 'x'.repeat(10001) }, { ...body, website: 'spam' }, { ...body, name: 'Alex\nInjected' }, { ...body, name: 'Al\x00ex' }]) {
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
    assert.equal((await submitContact(body, { ...config, TURNSTILE_SECRET_KEY: env.TURNSTILE_SECRET_KEY }, { loadSettings: () => ({}), fetchImpl: verified })).status, 200);
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
  assert.deepEqual(loadContactSettings(), contactSettings(built));
});

test('each referral choice reaches only the enquiry, with escaped Other details', async () => {
  for (const option of referralOptions) {
    const sent = [];
    const detail = '<script>alert(1)</script> & a friend';
    const response = await submitContact({ ...body, referralSource: option.value, referralOther: detail }, env, dependencies(async payload => { sent.push(payload); return accepted(); }));
    assert.equal(response.status, 200);
    const answer = option.value === 'other' ? `Other: ${detail}` : option.label;
    assert.ok(sent[0].text.includes(`How did you hear about us? ${answer}`));
    assert.ok(sent[0].html.includes('How did you hear about us?'));
    assert.ok(!sent[0].html.includes('<script>'));
    if (option.value === 'other') assert.ok(sent[0].html.includes('&lt;script&gt;alert(1)&lt;/script&gt; &amp; a friend'));
    else assert.ok(!sent[0].text.includes(detail), 'Ignore leftover Other text for a different selection');
    assert.ok(!sent[1].text.includes(answer));
    assert.ok(!sent[1].html.includes('How did you hear about us?'));
  }
});

test('published referral requirements reject missing and invalid answers before either email', async () => {
  const required = { 'shared.form.referralRequired': true };
  for (const fields of [{}, { referralSource: ' ' }, { referralSource: 'other', referralOther: ' ' }, { referralSource: 'invented' }]) {
    assert.equal((await submitContact({ ...body, ...fields, referralRequired: false, settings: { 'shared.form.referralRequired': false } }, env, dependencies(neverSend, required))).status, 400);
  }
  for (const fields of [{ referralSource: 'other' }, { referralSource: 'invented' }, { referralSource: ['google-search'] }, { referralOther: 42 }, { referralOther: 'x'.repeat(501) }]) {
    assert.equal((await submitContact({ ...body, ...fields }, env, dependencies(neverSend))).status, 400);
  }
  assert.equal((await submitContact({ ...body, referralSource: 'google-search' }, env, dependencies(accepted, required))).status, 200);
  assert.equal((await submitContact(body, env, dependencies())).status, 200, 'Default question is optional');
});

test('hidden referral questions cannot be required or inject an answer into the enquiry', async () => {
  for (const fields of [{}, { referralSource: 'other', referralOther: 'Forged referral' }]) {
    const sent = [];
    const response = await submitContact({ ...body, ...fields }, env, dependencies(async payload => { sent.push(payload); return accepted(); }, {
      'shared.form.referralEnabled': false,
      'shared.form.referralRequired': true,
    }));
    assert.equal(response.status, 200);
    assert.ok(!sent[0].text.includes('How did you hear about us?'));
    assert.ok(!sent[0].html.includes('Forged referral'));
  }
});

test('optional confirmation reply-to is omitted by the SDK and never changes lead reply routing', async t => {
  const requests = [];
  t.mock.method(globalThis, 'fetch', async (_url, options) => {
    requests.push(JSON.parse(options.body));
    return Response.json({ id: 'mock-sdk-id' });
  });
  for (const replyTo of ['', '   ']) {
    const result = await submitContact(body, env, {fetchImpl: verified, loadSettings: () => ({
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

test('each main field can be optional or required independently of its displayed label', async () => {
  for (const key of ['name', 'email', 'phone', 'message']) {
    const withoutField = { ...body, [key]: '   ' };
    const optional = { [`shared.form.${key}Required`]: false };
    assert.equal((await submitContact(withoutField, env, dependencies(accepted, optional))).status, 200, `${key} may be left blank when optional`);
    for (const showMarker of [true, false]) {
      const required = { [`shared.form.${key}Required`]: true, [`shared.form.${key}ShowMarker`]: showMarker };
      const result = await submitContact({ ...withoutField, settings: optional, [`${key}Required`]: false }, env, dependencies(neverSend, required));
      assert.equal(result.status, 400, `${key} remains required with label ${showMarker}`);
      assert.equal((await submitContact({ ...body, phone: '0400 000 000' }, env, dependencies(accepted, required))).status, 200);
    }
  }
});

test('optional email sends one enquiry without an empty Reply-To or autoresponder', async t => {
  const requests = [];
  t.mock.method(globalThis, 'fetch', async (_url, options) => {
    requests.push(JSON.parse(options.body));
    return Response.json({ id: 'mock-sdk-id' });
  });
  const result = await submitContact({ ...body, email: '', phone: '0400 000 000' }, env, { fetchImpl: verified, loadSettings: () => ({ 'shared.form.emailRequired': false }) });
  assert.equal(result.status, 200);
  assert.equal(requests.length, 1);
  assert.deepEqual(requests[0].to, ['mike@velocitymarketing.com.au']);
  assert.equal(Object.hasOwn(requests[0], 'reply_to'), false);
  assert.match(requests[0].text, /Email: Not provided/);
  assert.match(requests[0].text, /Phone: 0400 000 000/);
});

test('an optional missing name has readable template fallbacks, while invalid provided email is rejected', async () => {
  const sent = [];
  const result = await submitContact({ ...body, name: '' }, env, dependencies(async payload => { sent.push(payload); return accepted(); }, { 'shared.form.nameRequired': false }));
  assert.equal(result.status, 200);
  assert.equal(sent[0].subject, 'New enquiry from a website visitor');
  assert.match(sent[0].text, /Name: Not provided/);
  assert.match(sent[1].text, /^Hi there,/);
  assert.equal((await submitContact({ ...body, email: 'invalid' }, env, dependencies(neverSend, { 'shared.form.emailRequired': false }))).status, 400);
});

test('Other details follow their own requirement and fully empty forms remain blocked', async () => {
  const settings = { 'shared.form.referralOtherRequired': false, 'shared.form.referralOtherShowMarker': false };
  const sent = [];
  assert.equal((await submitContact({ ...body, referralSource: 'other' }, env, dependencies(async payload => { sent.push(payload); return accepted(); }, settings))).status, 200);
  assert.match(sent[0].text, /How did you hear about us\? Other\n/);
  assert.equal((await submitContact({ ...body, referralSource: 'other' }, env, dependencies(neverSend, { ...settings, 'shared.form.referralOtherRequired': true }))).status, 400);
  const allOptional = Object.fromEntries(contactFormFields.map(field => [`shared.form.${field.key}Required`, false]));
  assert.equal((await submitContact({}, env, dependencies(neverSend, allOptional))).status, 400);
  assert.equal((await submitContact({ referralSource: 'other', referralOther: 'Hidden detail' }, env, dependencies(neverSend, { ...allOptional, 'shared.form.referralEnabled': false }))).status, 400);
});
