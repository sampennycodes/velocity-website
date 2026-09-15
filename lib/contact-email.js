import { emailSettingsSchema } from './content/model.js';

const escapeHtml = value => value.replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));
const htmlText = value => `<p>${escapeHtml(value).replace(/\r\n?/g, '\n').replace(/\n/g, '<br>')}</p>`;

// Shared by delivery and the CMS preview. Editor text is always rendered as text.
export function contactEmails(fields, settings = {}) {
  const values = emailSettingsSchema.parse(settings);
  const get = key => values[`shared.emails.${key}`];
  const { name, email, phone, message } = fields;
  const tokens = { name, firstName: name.split(/\s+/)[0] };
  const render = template => template.replace(/\{(name|firstName)\}/g, (_, key) => tokens[key]);
  const from = `${get('senderName')} <${get('senderEmail')}>`;
  const intro = render(get('notificationMessage'));
  const confirmation = render(get('confirmationMessage'));
  return [
    {
      from,
      to: [get('recipientEmail')],
      replyTo: email,
      subject: render(get('notificationSubject')),
      html: `${htmlText(intro)}<p><strong>Name:</strong> ${escapeHtml(name)}</p><p><strong>Email:</strong> ${escapeHtml(email)}</p>${phone ? `<p><strong>Phone:</strong> ${escapeHtml(phone)}</p>` : ''}<p><strong>Message:</strong></p>${htmlText(message)}`,
      text: `${intro}\n\nName: ${name}\nEmail: ${email}${phone ? `\nPhone: ${phone}` : ''}\n\nMessage:\n${message}`,
    },
    {
      from,
      to: [email],
      replyTo: get('replyToEmail'),
      subject: render(get('confirmationSubject')),
      html: htmlText(confirmation),
      text: confirmation,
    },
  ];
}
