import type { APIRoute } from 'astro';

// Minimal handler to integrate with Resend on deploy.
// Reads fields from a FormData POST and returns JSON.
export const POST: APIRoute = async ({ request }) => {
  try {
    const contentType = request.headers.get('content-type') || '';
    let name = '';
    let email = '';
    let phone = '';
    let message = '';

    if (contentType.includes('multipart/form-data') || contentType.includes('application/x-www-form-urlencoded')) {
      const formData = await request.formData();
      name = String(formData.get('name') || '');
      email = String(formData.get('email') || '');
      phone = String(formData.get('phone') || '');
      message = String(formData.get('message') || '');
    } else if (contentType.includes('application/json')) {
      const body = await request.json();
      name = body?.name || '';
      email = body?.email || '';
      phone = body?.phone || '';
      message = body?.message || '';
    }

    if (!name || !email || !message) {
      return new Response(JSON.stringify({ error: 'Missing required fields.' }), { status: 400 });
    }

    // Placeholder for Resend integration. We'll wire it once ENV is present.
    // Example sketch:
    // const resend = new Resend(import.meta.env.RESEND_API_KEY);
    // await resend.emails.send({
    //   from: 'Velocity Website <noreply@yourdomain>',
    //   to: 'mike@velocitymarketing.com.au',
    //   subject: `New enquiry from ${name}`,
    //   reply_to: email,
    //   text: `Name: ${name}\nEmail: ${email}\nPhone: ${phone}\n\n${message}`,
    // });

    return new Response(JSON.stringify({ ok: true }), { status: 200 });
  } catch (err) {
    return new Response(JSON.stringify({ error: 'Unexpected error.' }), { status: 500 });
  }
};


