import { z } from 'zod';
import { editorConfig, checkOrigin } from './config.js';
import { callAuth, readSessionCookie, requireEditor, sendCode, sessionCookie, verifyCode } from './auth.js';
import { readBytes, uploadImage, readImage } from './media.js';
import { rateLimit, getPool } from './db.js';
import { startPublication, publicationStatus } from './publish.js';
import { EditorError, insist } from './errors.js';
const emailSchema = z.string().trim().email().max(254).transform(s => s.toLowerCase());
const idSchema = z.string().uuid();
const json = (body, status = 200, headers = {}) => Response.json(body, { status, headers: { 'Cache-Control': 'private, no-store', 'X-Content-Type-Options': 'nosniff', ...headers } });
async function readJson(request, schema) {
  insist(request.headers.get('content-type')?.split(';')[0] === 'application/json', 415, 'Use a JSON request.');
  let body; try { body = JSON.parse((await readBytes(request, 8192)).toString('utf8')); }
  catch (error) { if (error instanceof EditorError) throw error; throw new EditorError(400, 'The request could not be read.'); }
  return schema.parse(body);
}
export async function handleEditor(request, env = process.env) {
  try {
    const config = editorConfig(env);
    const url = new URL(request.url); const action = url.searchParams.get('action');
    insist(['GET', 'POST'].includes(request.method), 405, 'Method not allowed.');
    if (request.method === 'POST') {
      checkOrigin(request, config);
      if (action === 'send-code') {
        const { email } = await readJson(request, z.object({ email: emailSchema }).strict());
        await sendCode(email, request, env);
        return json({ message: 'If your account is enabled, a login code has been sent. During setup, only Sam can receive codes.' });
      }
      if (action === 'verify-code') {
        const { email, otp } = await readJson(request, z.object({ email: emailSchema, otp: z.string().regex(/^\d{6}$/) }).strict());
        const cookie = await verifyCode(email, otp, request, env);
        return json({ success: true }, 200, { 'Set-Cookie': cookie });
      }
      if (action === 'sign-out') {
        const token = readSessionCookie(request);
        if (token) {
          try { await callAuth('/sign-out', config, { token, body: {} }); }
          catch (error) { if (!(error instanceof EditorError) || error.status !== 401) throw error; }
        }
        return json({ success: true }, 200, { 'Set-Cookie': sessionCookie('', request, config, true) });
      }
    }
    const editor = await requireEditor(request, env);
    if (request.method === 'GET') {
      if (action === 'session') return json({ email: editor.email, role: editor.role, environment: 'staging' });
      if (action === 'status') {
        const { rows } = await getPool(env).query('SELECT id, status, error, deployment_url, created_at FROM velocity_editor.integration_publications ORDER BY created_at DESC LIMIT 10');
        return json({ privateUploadsConfigured: Boolean(env.EDITOR_BLOB_PRIVATE_TOKEN), publishingConfigured: env.EDITOR_PUBLISH_ENABLED === 'true', publications: rows });
      }
      if (action === 'image') return await readImage(idSchema.parse(url.searchParams.get('id')), env);
      if (action === 'publish-status') return json(await publicationStatus(idSchema.parse(url.searchParams.get('id')), env));
    } else {
      if (action === 'upload') {
        await rateLimit('upload', editor.email, 15, 3600, env);
        return json(await uploadImage(request, editor, env), 201);
      }
      if (action === 'publish') {
        await rateLimit('publish', editor.email, 10, 3600, env);
        const { key } = await readJson(request, z.object({ key: idSchema }).strict());
        return json(await startPublication(key, editor, env), 202);
      }
    }
    return json({ message: 'Endpoint not found.' }, 404);
  } catch (error) {
    if (error instanceof z.ZodError) return json({ message: 'Check the email, code or request fields and try again.' }, 400);
    if (error instanceof EditorError) return json({ message: error.message }, error.status);
    // Do not leak database connection strings, provider bodies, tokens or private asset URLs.
    console.error('Editor request failed', { name: error?.name, code: /^[A-Z0-9_]+$/.test(error?.code || '') ? error.code : undefined });
    return json({ message: 'The editor service is temporarily unavailable. Please retry or contact Sam.' }, 503);
  }
}
