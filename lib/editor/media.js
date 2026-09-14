import sharp from 'sharp';
import { put, get } from '@vercel/blob';
import { randomUUID } from 'node:crypto';
import { getPool } from './db.js';
import { insist, EditorError } from './errors.js';
export const MAX_UPLOAD_BYTES = 3 * 1024 * 1024;
export async function readBytes(request, maximum) {
  const declared = Number(request.headers.get('content-length'));
  insist(!declared || declared <= maximum, 413, `The file or request is too large. Images must be 3 MB or smaller.`);
  insist(request.body, 400, 'The request is empty.');
  const reader = request.body.getReader(); const chunks = []; let length = 0;
  try {
    for (;;) {
      const { done, value } = await reader.read(); if (done) break;
      length += value.byteLength;
      if (length > maximum) { await reader.cancel(); throw new EditorError(413, 'The file or request is too large. Images must be 3 MB or smaller.'); }
      chunks.push(value);
    }
  } finally { reader.releaseLock(); }
  return Buffer.concat(chunks, length);
}
export async function normalizeImage(bytes, contentType) {
  insist(bytes.length > 0 && bytes.length <= MAX_UPLOAD_BYTES, 413, 'Choose an image up to 3 MB.');
  const expected = { 'image/jpeg': 'jpeg', 'image/png': 'png', 'image/webp': 'webp' }[contentType];
  insist(expected, 415, 'Choose a JPEG, PNG or WebP image.');
  try {
    const image = sharp(bytes, { limitInputPixels: 16000000, animated: false, failOn: 'warning' });
    const metadata = await image.metadata();
    insist(metadata.format === expected && (metadata.pages || 1) === 1, 415, 'The file contents must match a still JPEG, PNG or WebP image.');
    const { data, info } = await image.rotate().resize({ width: 2048, height: 2048, fit: 'inside', withoutEnlargement: true }).webp({ quality: 86 }).toBuffer({ resolveWithObject: true });
    return { data, width: info.width, height: info.height, contentType: 'image/webp' };
  } catch (error) { if (error instanceof EditorError) throw error; throw new EditorError(415, 'This image could not be read. Use a valid JPEG, PNG or WebP under 16 megapixels.'); }
}
export async function uploadImage(request, editor, env) {
  insist(env.EDITOR_BLOB_PRIVATE_TOKEN, 503, 'Private image storage is awaiting configuration.');
  const description = request.headers.get('x-image-description') || '';
  const filename = request.headers.get('x-image-name') || 'image';
  let alt, name;
  try { alt = decodeURIComponent(description).trim(); name = decodeURIComponent(filename).trim(); } catch { throw new EditorError(400, 'The image name or description is invalid.'); }
  insist(alt.length > 0 && alt.length <= 500 && name.length <= 255, 400, 'Add an image description of 1–500 characters.');
  const image = await normalizeImage(await readBytes(request, MAX_UPLOAD_BYTES), request.headers.get('content-type'));
  const id = randomUUID();
  const blob = await put(`staging/${id}.webp`, image.data, { access: 'private', token: env.EDITOR_BLOB_PRIVATE_TOKEN, contentType: image.contentType, addRandomSuffix: true });
  await getPool(env).query(`INSERT INTO velocity_editor.media (id, author, private_url, pathname, filename, content_type, width, height, bytes, description)
    VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`, [id, editor.email, blob.url, blob.pathname, name, image.contentType, image.width, image.height, image.data.length, alt]);
  return { id, url: `/api/editor?action=image&id=${id}`, width: image.width, height: image.height, description: alt };
}
export async function readImage(id, env) {
  const { rows } = await getPool(env).query('SELECT private_url, content_type FROM velocity_editor.media WHERE id = $1', [id]);
  insist(rows[0], 404, 'Image not found.');
  const blob = await get(rows[0].private_url, { access: 'private', token: env.EDITOR_BLOB_PRIVATE_TOKEN });
  insist(blob?.statusCode === 200 && blob.stream, 404, 'The image could not be loaded. Please upload it again.');
  return new Response(blob.stream, { headers: { 'Content-Type': rows[0].content_type, 'Cache-Control': 'private, no-store', 'X-Content-Type-Options': 'nosniff' } });
}
