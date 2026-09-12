import { Resend } from 'resend';

const EMAIL_PATTERN = /^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/;
const fail = (status, message) => ({ status, body: { success: false, message } });
const escapeHtml = value => value.replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));

// Shared by the Vercel function and the Astro development endpoint.
export async function submitContact(body, env, sendEmail) {
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
  if (!EMAIL_PATTERN.test(email) || /[\r\n]/.test(name)) return fail(400, 'Please enter a valid name and email address.');
  if (env.VERCEL_ENV === 'preview' || env.CONTACT_FORM_DISABLED === 'true') return fail(503, 'Preview only — no email has been sent.');
  if (!env.RESEND_API_KEY || !env.SEND_EMAIL_FROM) return fail(503, 'The form is temporarily unavailable. Please email Mike directly.');

  const payload = {
    from: env.SEND_EMAIL_FROM,
    to: [env.SEND_EMAIL_TO || 'mike@velocitymarketing.com.au'],
    replyTo: email,
    subject: `New enquiry from ${name}`,
    html: `<h2>New Velocity Marketing enquiry</h2><p><strong>Name:</strong> ${escapeHtml(name)}</p><p><strong>Email:</strong> ${escapeHtml(email)}</p>${phone ? `<p><strong>Phone:</strong> ${escapeHtml(phone)}</p>` : ''}<p><strong>Message:</strong></p><p>${escapeHtml(message).replace(/\n/g, '<br>')}</p>`,
    text: `New Velocity Marketing enquiry\n\nName: ${name}\nEmail: ${email}${phone ? `\nPhone: ${phone}` : ''}\n\nMessage:\n${message}`,
  };
  try {
    const send = sendEmail || (payload => new Resend(env.RESEND_API_KEY).emails.send(payload));
    const result = await send(payload);
    if (result.error || !result.data?.id) return fail(502, 'Your message could not be sent. Please try again or email Mike directly.');
    return { status: 200, body: { success: true, message: 'Thanks! I’ll be in touch shortly.' } };
  } catch {
    return fail(502, 'Your message could not be sent. Please try again or email Mike directly.');
  }
}
