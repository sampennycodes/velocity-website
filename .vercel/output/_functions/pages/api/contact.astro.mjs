import { Resend } from 'resend';
export { renderers } from '../../renderers.mjs';

const prerender = false;
const POST = async ({ request }) => {
  try {
    const contentType = request.headers.get("content-type") || "";
    let name = "";
    let email = "";
    let phone = "";
    let message = "";
    if (contentType.includes("multipart/form-data") || contentType.includes("application/x-www-form-urlencoded")) {
      const formData = await request.formData();
      name = String(formData.get("name") || "");
      email = String(formData.get("email") || "");
      phone = String(formData.get("phone") || "");
      message = String(formData.get("message") || "");
      const website = String(formData.get("website") || "");
      if (website.trim() !== "") {
        console.log("Bot detected via honeypot field on server");
        return new Response(JSON.stringify({ error: "Submission blocked." }), { status: 403 });
      }
    } else if (contentType.includes("application/json")) {
      const body = await request.json();
      name = body?.name || "";
      email = body?.email || "";
      phone = body?.phone || "";
      message = body?.message || "";
      const website = body?.website || "";
      if (website.trim() !== "") {
        console.log("Bot detected via honeypot field on server (JSON)");
        return new Response(JSON.stringify({ error: "Submission blocked." }), { status: 403 });
      }
    }
    if (!name || !email || !message) {
      return new Response(JSON.stringify({ error: "Missing required fields." }), { status: 400 });
    }
    const resend = new Resend("re_YGV6K5Ku_Q6kiTpYzt47XoykjSurjTfat");
    try {
      const { data, error } = await resend.emails.send({
        from: `Velocity Website <${"sam@sampenny.io"}>`,
        to: "sam@sampenny.io",
        subject: `New enquiry from ${name}`,
        replyTo: email,
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h2 style="color: #333;">New Contact Form Submission</h2>
            <p><strong>Name:</strong> ${name}</p>
            <p><strong>Email:</strong> ${email}</p>
            <p><strong>Phone:</strong> ${phone || "Not provided"}</p>
            <h3 style="color: #555;">Message:</h3>
            <p style="background-color: #f5f5f5; padding: 15px; border-radius: 5px;">${message}</p>
          </div>
        `
      });
      if (error) {
        console.error("Resend API error:", error);
        return new Response(JSON.stringify({ error: "Failed to send email." }), { status: 500 });
      }
    } catch (emailErr) {
      console.error("Email sending error:", emailErr);
      return new Response(JSON.stringify({ error: "Failed to send email." }), { status: 500 });
    }
    return new Response(JSON.stringify({ ok: true }), { status: 200 });
  } catch (err) {
    return new Response(JSON.stringify({ error: "Unexpected error." }), { status: 500 });
  }
};

const _page = /*#__PURE__*/Object.freeze(/*#__PURE__*/Object.defineProperty({
  __proto__: null,
  POST,
  prerender
}, Symbol.toStringTag, { value: 'Module' }));

const page = () => _page;

export { page };
