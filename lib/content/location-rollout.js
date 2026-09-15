import { contentSchema, fields } from './model.js';
import { locations, locationCopy, locationMap } from './locations.js';

// Explicit one-time editorial update, saved through the normal revision workflow.
// Never run on reads or restores: existing and future client edits stay authoritative.
export function applyLocationRollout(snapshot) {
  const content = contentSchema.parse(structuredClone(snapshot));
  for (const location of locations.filter(location => location.page !== 'ads')) {
    const localCopy = locationCopy(location);
    for (const field of fields.filter(field => field.group.startsWith(`${location.page}.`))) {
      const suffix = field.key.slice(location.page.length + 1);
      if (!Object.hasOwn(snapshot.values, field.key) && !Object.hasOwn(localCopy, suffix) && Object.hasOwn(snapshot.values, `ads.${suffix}`)) {
        content.values[field.key] = structuredClone(snapshot.values[`ads.${suffix}`]);
      }
    }
  }
  for (const [suffix, text] of Object.entries(locationCopy(locationMap.traralgon))) {
    content.values[`ads.${suffix}`] = text;
  }
  if (['/google-ads-traralgon', '/traralgon'].includes(content.values['home.services.0.link'])) {
    content.values['home.services.0.link'] = locationMap.traralgon.path;
  }
  content.values['home.services.0.description'] = content.values['home.services.0.description'].replace(
    'Explore our local Traralgon campaigns.', 'Explore our paid media services in Traralgon.',
  );
  return contentSchema.parse(content);
}
