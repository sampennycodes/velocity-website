import type { APIRoute } from 'astro';

// Fallback contact handler that logs submissions instead of sending emails
// This allows the site to function while Resend is being configured
export const prerender = false;

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
      
      // Honeypot check
      const website = String(formData.get('website') || '');
      if (website.trim() !== '') {
        console.log('Bot detected via honeypot field on server');
        return new Response(JSON.stringify({ error: 'Submission blocked.' }), { status: 403 });
      }
    } else if (contentType.includes('application/json')) {
      const body = await request.json();
      name = body?.name || '';
      email = body?.email || '';
      phone = body?.phone || '';
      message = body?.message || '';
      
      const website = body?.website || '';
      if (website.trim() !== '') {
        console.log('Bot detected via honeypot field on server (JSON)');
        return new Response(JSON.stringify({ error: 'Submission blocked.' }), { status: 403 });
      }
    }

    if (!name || !email || !message) {
      return new Response(JSON.stringify({ error: 'Missing required fields.' }), { status: 400 });
    }

    // Log the submission instead of sending email
    console.log('=== CONTACT FORM SUBMISSION ===');
    console.log('Name:', name);
    console.log('Email:', email);
    console.log('Phone:', phone || 'Not provided');
    console.log('Message:', message);
    console.log('==============================');

    // Return success response
    return new Response(JSON.stringify({ 
      ok: true, 
      message: 'Thank you for your message! We will get back to you soon.' 
    }), { status: 200 });

  } catch (err) {
    console.error('Error in fallback contact API:', err);
    return new Response(JSON.stringify({ error: 'Unexpected error.' }), { status: 500 });
  }
};
