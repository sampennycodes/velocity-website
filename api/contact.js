import { submitContact } from '../lib/contact.js';

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ success: false, message: 'Method not allowed' });
  }
  const result = await submitContact(req.body, process.env);
  return res.status(result.status).json(result.body);
}
