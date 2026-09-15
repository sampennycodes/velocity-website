import { Resend } from 'resend';
import { contactEmails } from './contact-email.js';
import { loadContactSettings } from './contact-settings.js';

const EMAIL_PATTERN = /^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/;
const fail = (status, message) => ({ status, body: { success: false, message } });

// Shared by the Vercel function and the Astro development endpoint.
export async function submitContact(body, env, { sendEmail, loadSettings = loadContactSettings, logger = console } = {}) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) return fail(400, 'Invalid form submission.');
  if (body.website != null && (typeof body.website !== 'string' || body.website.trim())) return fail(400, 'Submission blocked.');
  const limits = { name: 120, email: 254, phone: 50, message: 10000 };
  const fields = {};
  for (const [key, limit] of Object.entries(limits)) {
    const value = body[key] ?? '';
    if (typeof value !== 'string' || value.length > limit) return fail(400, 'Please check your form details.');
    fields[key] = value.trim();
  }
  const { name, email, phone, message } = fields;
  if (!name || !email || !message) return fail(400, 'Name, email and message are required.');
  if (!EMAIL_PATTERN.test(email) || /[\u0000-\u001f\u007f]/.test(name + email)) return fail(400, 'Please enter a valid name and email address.');
  if (env.VERCEL_ENV === 'preview' || env.CONTACT_FORM_DISABLED === 'true') return fail(503, 'Preview only — no email has been sent.');
  const apiKey = env.RESEND_API_KEY_NEW?.trim() || env.RESEND_API_KEY?.trim();
  if (!apiKey) return fail(503, 'The form is temporarily unavailable. Please email Mike directly.');

  let emails;
  try { emails = contactEmails(fields, await loadSettings()); }
  catch {
    logger.error('Contact email settings could not be loaded.');
    return fail(503, 'The form is temporarily unavailable. Please email Mike directly.');
  }
  const send = sendEmail || (payload => new Resend(apiKey).emails.send(payload));
  try {
    const result = await send(emails[0]);
    if (result?.error || !result?.data?.id) throw new Error('Enquiry rejected');
  } catch {
    return fail(502, 'Your message could not be sent. Please try again or email Mike directly.');
  }
  // The enquiry has been accepted. A failed receipt must not prompt the visitor
  // to submit the same lead again. Await delivery so serverless execution lasts.
  try {
    const result = await send(emails[1]);
    if (result?.error || !result?.data?.id) throw new Error('Confirmation rejected');
  } catch {
    logger.error('Contact confirmation email could not be sent; the enquiry was accepted.');
  }
  return { status: 200, body: { success: true, message: 'Thanks! I’ll be in touch shortly.' } };
}
