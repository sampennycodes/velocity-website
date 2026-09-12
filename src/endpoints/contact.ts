import type { APIRoute } from 'astro';
import { submitContact } from '../../lib/contact.js';

// Local Astro route. Production uses the root api/contact.js Vercel function.
export const POST: APIRoute = async ({ request }) => {
  let body;
  try { body = await request.json(); }
  catch { return Response.json({ success: false, message: 'Invalid form submission.' }, { status: 400 }); }
  const result = await submitContact(body, { ...import.meta.env, CONTACT_FORM_DISABLED: import.meta.env.DEV ? 'true' : import.meta.env.CONTACT_FORM_DISABLED });
  return Response.json(result.body, { status: result.status, headers: { 'Cache-Control': 'no-store' } });
};
