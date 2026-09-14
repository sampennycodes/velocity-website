import { z } from 'zod';
import { editorConfig, checkOrigin } from './config.js';
import { callAuth, readSessionCookie, requireEditor, sendCode, sessionCookie, verifyCode } from './auth.js';
import { readBytes, uploadImage, readImage } from './media.js';
import { rateLimit, getPool } from './db.js';
import { startContentPublication, contentPublicationStatus } from './content-publish.js';
import { EditorError, insist } from './errors.js';
import { contentSchema } from '../content/model.js';
import { loadDraft, saveDraft, restoreDraft, history } from './content.js';
const emailSchema = z.string().trim().email().max(254).transform(s => s.toLowerCase());
const idSchema = z.string().uuid();
const json = (body, status = 200, headers = {}) => Response.json(body, { status, headers: { 'Cache-Control': 'private, no-store', 'X-Content-Type-Options': 'nosniff', ...headers } });
async function readJson(request, schema, maximum = 8192) {
  insist(request.headers.get('content-type')?.split(';')[0] === 'application/json', 415, 'Use a JSON request.');
  let body; try { body = JSON.parse((await readBytes(request, maximum)).toString('utf8')); }
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
      if (action === 'draft') return json(await loadDraft(editor, env));
      if (action === 'history') return json(await history(env, z.string().datetime({ offset: true }).nullable().parse(url.searchParams.get('before'))));
      if (action === 'status') {
        const { rows } = await getPool(env).query('SELECT id, status, error, deployment_url, created_at FROM velocity_editor.content_publications ORDER BY created_at DESC LIMIT 10');
        return json({ privateUploadsConfigured: Boolean(env.EDITOR_BLOB_PRIVATE_TOKEN), publishingConfigured: env.EDITOR_PUBLISH_ENABLED === 'true', publications: rows });
      }
      if (action === 'image') return await readImage(idSchema.parse(url.searchParams.get('id')), env);
      if (action === 'publish-status') return json(await contentPublicationStatus(idSchema.parse(url.searchParams.get('id')), env));
    } else {
      if (action === 'save') {
        await rateLimit('draft-save', editor.email, 100, 3600, env);
        const body = await readJson(request, z.object({ content: contentSchema, version: z.number().int().positive() }).strict(), 256000);
        return json(await saveDraft(body.content, body.version, editor, env));
      }
      if (action === 'restore') {
        const body = await readJson(request, z.object({ revisionId: idSchema, version: z.number().int().positive() }).strict());
        return json(await restoreDraft(body.revisionId, body.version, editor, env));
      }
      if (action === 'upload') {
        await rateLimit('upload', editor.email, 15, 3600, env);
        return json(await uploadImage(request, editor, env), 201);
      }
      if (action === 'publish') {
        await rateLimit('publish', editor.email, 10, 3600, env);
        const { key, version } = await readJson(request, z.object({ key: idSchema, version: z.number().int().positive() }).strict());
        return json(await startContentPublication(key, version, editor, env), 202);
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
