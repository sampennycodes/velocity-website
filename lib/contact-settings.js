import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { contactSettingsSchema } from './content/model.js';

// Packaged with the function from the same immutable snapshot as the site build.
// Never read the editor's moving draft while handling a lead's submission.
export function loadContactSettings() {
  return contactSettingsSchema.parse(JSON.parse(readFileSync(
    resolve('.generated/contact-email-settings.json'), 'utf8',
  )));
}
