import { isDeepStrictEqual } from 'node:util';
import { loadEnvFile } from 'node:process';
import { writeFile } from 'node:fs/promises';
import { editorConfig } from '../lib/editor/config.js';
import { approvedEditor, getPool } from '../lib/editor/db.js';
import { saveDraft } from '../lib/editor/content.js';
import { applyLocationRollout } from '../lib/content/location-rollout.js';

try { loadEnvFile('.env'); } catch (error) { if (error.code !== 'ENOENT') throw error; }
editorConfig(process.env);
const email = process.argv.find(arg => arg.startsWith('--author='))?.slice(9);
if (!email) throw new Error('Pass --author=<existing editor email>. Dry run is the default; --save writes a normal draft revision.');
const pool = getPool(process.env);
try {
  const editor = await approvedEditor(email, null, process.env);
  if (editor.role !== 'owner') throw new Error('The one-time location rollout requires an existing owner.');
  const { rows } = await pool.query("SELECT snapshot, version, revision_id FROM velocity_editor.drafts WHERE id = 'site'");
  if (!rows[0]) throw new Error('Load the existing CMS draft first.');
  const before = rows[0];
  const content = applyLocationRollout(before.snapshot);
  const changed = Object.keys(content.values).filter(key => !isDeepStrictEqual(content.values[key], before.snapshot.values[key]));
  console.log(JSON.stringify({ version: before.version, revisionId: before.revision_id, addedFields: changed.filter(key => !Object.hasOwn(before.snapshot.values, key)).length, updatedFields: changed.filter(key => Object.hasOwn(before.snapshot.values, key)), bytes: Buffer.byteLength(JSON.stringify(content)) }));
  if (process.argv.includes('--save') && changed.length) {
    const draft = await saveDraft(content, before.version, editor, process.env);
    console.log(JSON.stringify({ saved: true, version: draft.version, revisionId: draft.revisionId }));
  } else if (process.argv.includes('--local-preview')) {
    // Private, ignored build input for local QA. Never writes to a public directory.
    await writeFile('.generated/editor-content.json', JSON.stringify(content));
    console.log('Local preview now uses the proposed update to the latest saved draft.');
  }
} finally { await pool.end(); }
