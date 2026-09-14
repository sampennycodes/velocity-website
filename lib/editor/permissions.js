import { insist } from './errors.js';

export const canSaveContent = editor => ['owner', 'editor'].includes(editor.role);
export function requireContentWrite(editor) {
  insist(canSaveContent(editor), 403, 'Preview-only access: you can try edits in your browser, but cannot save, restore, upload or publish.');
}
