import { Readable } from 'node:stream';
import { handleEditor } from '../lib/editor/handler.js';
export const config = { api: { bodyParser: false } };
export default async function handler(req, res) {
  // The fixed base is used only to parse path/query; trust comes from EDITOR_ORIGINS.
  const request = new Request(new URL(req.url, 'https://editor.invalid'), {
    method: req.method, headers: req.headers,
    ...(!['GET', 'HEAD'].includes(req.method) ? { body: req.body !== undefined ? (Buffer.isBuffer(req.body) || typeof req.body === 'string' ? req.body : JSON.stringify(req.body)) : Readable.toWeb(req), duplex: 'half' } : {}),
  });
  const response = await handleEditor(request, process.env);
  res.statusCode = response.status;
  response.headers.forEach((value, name) => res.setHeader(name, value));
  if (!response.body) return res.end();
  Readable.fromWeb(response.body).pipe(res);
}
