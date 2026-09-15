import { emailSettingsSchema } from './content/model.js';
import { referralAnswer } from './contact-referral.js';

export const contactEmailVariables = [
  { key: 'firstName', label: 'First name', example: 'Alex' },
  { key: 'name', label: 'Full name', example: 'Alex Smith' },
];
const variablePattern = new RegExp(`\\{(${contactEmailVariables.map(variable => variable.key).join('|')})\\}`, 'g');

const escapeHtml = value => value.replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));
const htmlText = value => value.replace(/\r\n?/g, '\n').split(/\n{2,}/).map(paragraph =>
  `<p style="margin:0 0 18px;font-size:16px;line-height:1.7;color:#36323c;overflow-wrap:anywhere;word-break:break-word;">${escapeHtml(paragraph).replace(/\n/g, '<br>')}</p>`,
).join('');

// Inline styles and presentation tables also work in email clients without CSS support.
function emailLayout(title, content) {
  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>${escapeHtml(title)}</title>
<style>body{margin:0;padding:0}table{border-collapse:collapse}a{color:#6d3e9f}@media(max-width:480px){.email-outer{padding:16px 8px!important}.email-content{padding:26px 22px!important}.email-header{padding:24px 22px!important}}</style>
</head><body style="margin:0;padding:0;background-color:#f4f2f6;font-family:Arial,Helvetica,sans-serif;-webkit-text-size-adjust:100%;">
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" bgcolor="#f4f2f6"><tr><td class="email-outer" align="center" style="padding:32px 16px;">
<!--[if mso]><table role="presentation" width="600"><tr><td><![endif]-->
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="max-width:600px;table-layout:fixed;background-color:#ffffff;border:1px solid #e6e0ed;">
<tr><td class="email-header" bgcolor="#171519" style="padding:28px 32px;border-top:4px solid #bb9bef;">
<p style="margin:0;color:#ffffff;font-size:22px;line-height:1.25;font-weight:700;letter-spacing:1px;">VELOCITY<span style="color:#bb9bef;">.</span></p>
<p style="margin:5px 0 0;color:#d5c8e1;font-size:10px;line-height:1.5;letter-spacing:3px;">MARKETING</p>
</td></tr>
<tr><td class="email-content" style="padding:32px;">
<h1 style="margin:0 0 24px;color:#211b2a;font-size:26px;line-height:1.3;font-weight:700;">${escapeHtml(title)}</h1>
${content}
</td></tr>
<tr><td style="padding:20px 24px;border-top:1px solid #e6e0ed;background-color:#faf8fc;text-align:center;">
<p style="margin:0 0 6px;color:#766c80;font-size:12px;line-height:1.6;">Velocity Marketing &middot; Traralgon, VIC</p>
<a href="https://velocitymarketing.com.au" style="color:#6d3e9f;font-size:12px;line-height:1.6;text-decoration:underline;">velocitymarketing.com.au</a>
</td></tr></table>
<!--[if mso]></td></tr></table><![endif]-->
</td></tr></table></body></html>`;
}

function leadDetails(fields) {
  const { name, email, phone } = fields;
  const referral = referralAnswer(fields);
  return `<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="margin:6px 0 24px;table-layout:fixed;background-color:#f7f3fb;">${[
    ['Name', name || 'Not provided'], ['Email', email || 'Not provided'], ...(phone ? [['Phone', phone]] : []),
  ].map(([label, value]) => `<tr><td width="60" valign="top" style="padding:12px 14px;border-bottom:1px solid #eae3f1;color:#746380;font-size:12px;line-height:1.6;font-weight:700;">${label}</td><td style="padding:12px 14px;border-bottom:1px solid #eae3f1;color:#302438;font-size:14px;line-height:1.6;overflow-wrap:anywhere;word-break:break-word;">${escapeHtml(value)}</td></tr>`).join('')}${referral ? `<tr><td colspan="2" style="padding:12px 14px;color:#302438;font-size:14px;line-height:1.6;overflow-wrap:anywhere;word-break:break-word;"><p style="margin:0 0 4px;color:#746380;font-size:12px;font-weight:700;">How did you hear about us?</p>${escapeHtml(referral)}</td></tr>` : ''}</table>`;
}

// Shared by delivery and the CMS preview. Editor text is always rendered as text.
export function contactEmails(fields, settings = {}) {
  const values = emailSettingsSchema.parse(settings);
  const get = key => values[`shared.emails.${key}`];
  const { name = '', email = '', phone = '', message = '' } = fields;
  const referral = referralAnswer(fields);
  const tokens = { name: name || 'a website visitor', firstName: name ? name.split(/\s+/)[0] : 'there' };
  const render = template => template.replace(variablePattern, (_, key) => tokens[key]);
  const from = `${get('senderName')} <${get('senderEmail')}>`;
  const intro = render(get('notificationMessage'));
  const confirmation = render(get('confirmationMessage'));
  return [
    {
      from,
      to: [get('recipientEmail')],
      ...(email ? { replyTo: email } : {}),
      subject: render(get('notificationSubject')),
      html: emailLayout('New website enquiry', `${htmlText(intro)}${leadDetails(fields)}<h2 style="margin:0 0 12px;color:#746380;font-size:12px;line-height:1.6;letter-spacing:1px;text-transform:uppercase;">Message</h2>${htmlText(message || 'Not provided')}`),
      text: `${intro}\n\nName: ${name || 'Not provided'}\nEmail: ${email || 'Not provided'}${phone ? `\nPhone: ${phone}` : ''}${referral ? `\nHow did you hear about us? ${referral}` : ''}\n\nMessage:\n${message || 'Not provided'}`,
    },
    ...(email ? [{
      from,
      to: [email],
      ...(get('replyToEmail') ? { replyTo: get('replyToEmail') } : {}),
      subject: render(get('confirmationSubject')),
      html: emailLayout('Thanks for getting in touch.', htmlText(confirmation)),
      text: confirmation,
    }] : []),
  ];
}
