import { Resend } from 'resend';
export { renderers } from '../../renderers.mjs';

const resend = new Resend("re_YGV6K5Ku_Q6kiTpYzt47XoykjSurjTfat");
const POST = async ({ request }) => {
  try {
    const body = await request.json();
    const { name, email, phone, message, website } = body;
    if (website && website.trim() !== "") {
      return new Response(JSON.stringify({
        success: false,
        message: "Submission blocked"
      }), { status: 400 });
    }
    if (!name || !email || !message) {
      return new Response(JSON.stringify({
        success: false,
        message: "Missing required fields"
      }), { status: 400 });
    }
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return new Response(JSON.stringify({
        success: false,
        message: "Invalid email format"
      }), { status: 400 });
    }
    const { data, error } = await resend.emails.send({
      from: "sam@sampenny.io",
      to: ["sam@sampenny.io"],
      // Send to the same email as FROM
      subject: `New Contact Form Submission from ${name}`,
      html: `
        <h2>New Contact Form Submission</h2>
        <p><strong>Name:</strong> ${name}</p>
        <p><strong>Email:</strong> ${email}</p>
        ${phone ? `<p><strong>Phone:</strong> ${phone}</p>` : ""}
        <p><strong>Message:</strong></p>
        <p>${message.replace(/\n/g, "<br>")}</p>
        <hr>
        <p><em>This message was sent from the Velocity Marketing contact form.</em></p>
      `,
      text: `
New Contact Form Submission

Name: ${name}
Email: ${email}
${phone ? `Phone: ${phone}` : ""}
Message:
${message}

---
This message was sent from the Velocity Marketing contact form.
      `
    });
    if (error) {
      console.error("Resend error:", error);
      return new Response(JSON.stringify({
        success: false,
        message: "Failed to send email"
      }), { status: 500 });
    }
    return new Response(JSON.stringify({
      success: true,
      message: "Email sent successfully",
      data
    }), { status: 200 });
  } catch (error) {
    console.error("Contact form error:", error);
    return new Response(JSON.stringify({
      success: false,
      message: "Internal server error"
    }), { status: 500 });
  }
};

const _page = /*#__PURE__*/Object.freeze(/*#__PURE__*/Object.defineProperty({
  __proto__: null,
  POST
}, Symbol.toStringTag, { value: 'Module' }));

const page = () => _page;

export { page };
