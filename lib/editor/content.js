import { randomUUID } from "node:crypto";
import { getPool } from "./db.js";
import { contentSchema, initialContent, fields } from "../content/model.js";
import { insist } from "./errors.js";
import { canSaveContent, requireContentWrite } from "./permissions.js";
export const draftResult = (row) => ({
  content: contentSchema.parse(row.snapshot),
  version: row.version,
  revisionId: row.revision_id,
  updatedAt: row.updated_at,
  updatedBy: row.updated_by,
});
export async function validateAssets(content, db) {
  const result = contentSchema.parse(structuredClone(content));
  for (const field of fields.filter((f) => f.type === "image")) {
    const image = result.values[field.key];
    if (!image.assetId) continue;
    const { rows } = await db.query(
      "SELECT id, width, height FROM velocity_editor.media WHERE id = $1",
      [image.assetId],
    );
    insist(
      rows[0],
      400,
      "An image is no longer available. Upload it again before saving.",
    );
    image.src = `/api/editor?action=image&id=${image.assetId}`;
    image.width = rows[0].width;
    image.height = rows[0].height;
  }
  return result;
}
export async function loadDraft(editor, env, dependencies = {}) {
  const pool = dependencies.pool || getPool(env);
  const found = await pool.query(
    "SELECT * FROM velocity_editor.drafts WHERE id = 'site'",
  );
  if (found.rows[0]) return draftResult(found.rows[0]);
  // Preview visitors must never seed a persistent draft or revision.
  if (!canSaveContent(editor)) return {
    content: structuredClone(initialContent), version: 0, revisionId: null,
    updatedAt: null, updatedBy: null,
  };
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await client.query(
      "SELECT pg_advisory_xact_lock(hashtext('velocity-content-seed'))",
    );
    const exists = await client.query(
      "SELECT * FROM velocity_editor.drafts WHERE id = 'site'",
    );
    if (exists.rows[0]) {
      await client.query("COMMIT");
      return draftResult(exists.rows[0]);
    }
    const id = randomUUID();
    await client.query(
      "INSERT INTO velocity_editor.content_revisions (id,author,snapshot) VALUES ($1,$2,$3)",
      [id, editor.email, initialContent],
    );
    const { rows } = await client.query(
      "INSERT INTO velocity_editor.drafts (id,version,snapshot,revision_id,updated_by) VALUES ('site',1,$1,$2,$3) RETURNING *",
      [initialContent, id, editor.email],
    );
    await client.query("COMMIT");
    return draftResult(rows[0]);
  } catch (e) {
    await client.query("ROLLBACK");
    throw e;
  } finally {
    client.release();
  }
}
export function checkVersion(actual, expected) {
  insist(
    actual === expected,
    409,
    "This draft changed in another browser. Download your edits, then load the latest saved draft before saving again.",
  );
}
export async function saveDraft(
  content,
  version,
  editor,
  env,
  restoredFrom = null,
  dependencies = {},
) {
  requireContentWrite(editor);
  const pool = dependencies.pool || getPool(env);
  const snapshot = await validateAssets(content, pool);
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const { rows } = await client.query(
      "SELECT version FROM velocity_editor.drafts WHERE id = 'site' FOR UPDATE",
    );
    insist(rows[0], 409, "Load the current draft before saving.");
    checkVersion(rows[0].version, version);
    const id = randomUUID();
    await client.query(
      "INSERT INTO velocity_editor.content_revisions (id,author,snapshot,kind,restored_from) VALUES ($1,$2,$3,$4,$5)",
      [
        id,
        editor.email,
        snapshot,
        restoredFrom ? "restore" : "save",
        restoredFrom,
      ],
    );
    const result = await client.query(
      "UPDATE velocity_editor.drafts SET version = version + 1, snapshot = $1, revision_id = $2, updated_by = $3, updated_at = now() WHERE id = 'site' RETURNING *",
      [snapshot, id, editor.email],
    );
    await client.query("COMMIT");
    return draftResult(result.rows[0]);
  } catch (e) {
    await client.query("ROLLBACK");
    throw e;
  } finally {
    client.release();
  }
}
export async function restoreDraft(
  id,
  version,
  editor,
  env,
  dependencies = {},
) {
  requireContentWrite(editor);
  const { rows } = await (dependencies.pool || getPool(env)).query(
    "SELECT snapshot FROM velocity_editor.content_revisions WHERE id = $1",
    [id],
  );
  insist(rows[0], 404, "Revision not found.");
  return saveDraft(rows[0].snapshot, version, editor, env, id, dependencies);
}
export async function history(env, before) {
  const { rows } = await getPool(env).query(
    `SELECT id,author,kind,restored_from,created_at FROM velocity_editor.content_revisions WHERE ($1::timestamptz IS NULL OR created_at < $1) ORDER BY created_at DESC LIMIT 51`,
    [before || null],
  );
  const items = rows.slice(0, 50);
  return { items, next: rows.length > 50 ? items.at(-1).created_at : null };
}
