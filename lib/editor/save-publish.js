import { saveDraft } from './content.js';
import { publishConfig } from './config.js';
import { startContentPublication, contentPublicationStatus } from './content-publish.js';
import { requireContentWrite } from './permissions.js';
import { EditorError } from './errors.js';

// Once the draft is committed, publishing failure must not hide that successful save.
export async function saveAndPublish(body, editor, env, dependencies = {}) {
  requireContentWrite(editor);
  publishConfig(env);
  const draft = await (dependencies.saveDraft || saveDraft)(body.content, body.version, editor, env);
  try {
    const publication = await (dependencies.startPublication || startContentPublication)(body.key, draft.version, editor, env);
    return { draft, publication, publishError: null };
  } catch (error) {
    return { draft, publication: null, publishError: error instanceof EditorError ? error.message : 'Your draft was saved, but staging could not be updated. Please retry the update.' };
  }
}

// Complete normal builds even if the editor tab is closed. Interrupted/slow jobs
// remain persisted and can also be reconciled by the editor's status checks.
export async function monitorPublication(id, env, dependencies = {}) {
  const status = dependencies.status || contentPublicationStatus;
  const pause = dependencies.pause || (ms => new Promise(resolve => setTimeout(resolve, ms)));
  const now = dependencies.now || Date.now;
  const deadline = now() + 210000;
  while (now() < deadline) {
    try {
      const job = await status(id, env);
      if (['ready', 'failed'].includes(job.status)) return;
    } catch {
      // Provider errors are retried without logging credentials or response bodies.
    }
    await pause(5000);
  }
}
