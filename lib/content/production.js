import { z } from 'zod';
import { contentSchema, fields } from './model.js';

// Validated fallback for releases before the first CMS publication.
// Subsequent builds retain the last confirmed live revision through a read-only connection.
export function productionRelease(value) {
  const release = z.object({
    revisionId: z.string().uuid(),
    sourceSha: z.string().regex(/^[a-f0-9]{40}$/),
    content: contentSchema,
  }).strict().parse(value);
  for (const field of fields.filter(field => field.type === 'image')) {
    if (release.content.values[field.key].src.startsWith('/api/')) {
      throw new Error('Production content cannot reference private editor media.');
    }
  }
  return release;
}
