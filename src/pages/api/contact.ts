import type { APIRoute } from 'astro';
import { Resend } from 'resend';

const resend = new Resend(import.meta.env.RESEND_API_KEY);

export const POST: APIRoute = async ({ request }) => {
  try {
    const body = await request.json();
    const { name, email, phone, message, website } = body;

    // Honeypot check - if website field is filled, it's likely a bot
    if (website && website.trim() !== '') {
      return new Response(JSON.stringify({ 
        success: false, 
        message: 'Submission blocked' 
      }), { status: 400 });
    }

    // Validate required fields
    if (!name || !email || !message) {
      return new Response(JSON.stringify({ 
        success: false, 
        message: 'Missing required fields' 
      }), { status: 400 });
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return new Response(JSON.stringify({ 
        success: false, 
        message: 'Invalid email format' 
      }), { status: 400 });
    }

    // Send email using Resend
    const { data, error } = await resend.emails.send({
      from: import.meta.env.SEND_EMAIL_FROM || 'noreply@velocitymarketing.com.au',
      to: [import.meta.env.SEND_EMAIL_FROM || 'noreply@velocitymarketing.com.au'], // Send to the same email as FROM
      subject: `New Contact Form Submission from ${name}`,
      html: `
        <h2>New Contact Form Submission</h2>
        <p><strong>Name:</strong> ${name}</p>
        <p><strong>Email:</strong> ${email}</p>
        ${phone ? `<p><strong>Phone:</strong> ${phone}</p>` : ''}
        <p><strong>Message:</strong></p>
        <p>${message.replace(/\n/g, '<br>')}</p>
        <hr>
        <p><em>This message was sent from the Velocity Marketing contact form.</em></p>
      `,
      text: `
New Contact Form Submission

Name: ${name}
Email: ${email}
${phone ? `Phone: ${phone}` : ''}
Message:
${message}

---
This message was sent from the Velocity Marketing contact form.
      `,
    });

    if (error) {
      console.error('Resend error:', error);
      return new Response(JSON.stringify({ 
        success: false, 
        message: 'Failed to send email' 
      }), { status: 500 });
    }

    return new Response(JSON.stringify({ 
      success: true, 
      message: 'Email sent successfully',
      data 
    }), { status: 200 });

  } catch (error) {
    console.error('Contact form error:', error);
    return new Response(JSON.stringify({ 
      success: false, 
      message: 'Internal server error' 
    }), { status: 500 });
  }
};
