import baseline from './fields.json' with { type: 'json' };
import { locations, locationCopy, locationMap } from './locations.js';

const added = [
  { group: 'home.areas', key: 'home.areas.heading', label: 'Heading', type: 'text', max: 300, initial: 'Areas We Service', added: true },
  { group: 'ads.hero', key: 'ads.hero.localLabel', label: 'Service area label', type: 'text', max: 300, initial: 'Serving Traralgon', added: true },
  { group: 'ads.areas', key: 'ads.areas.heading', label: 'Heading', type: 'text', max: 300, initial: 'Nearby Areas We Service', added: true },
];
const areaGroup = { id: 'ads.areas', label: 'Nearby areas', page: 'ads', description: 'Links show the other towns in this location’s region. Regional headings on Home use the same location catalogue.' };
const baseGroups = baseline.groups.flatMap(group => [
  ...(group.id === 'home.contact' ? [{ id: 'home.areas', label: 'Areas we service', page: 'home', description: 'The five regions link directly to their town pages. Towns shared by two regions use the same page.' }] : []),
  ...(group.id === 'ads.contact' ? [areaGroup] : []),
  group.id === 'shared.reviews' ? { ...group, description: 'These reviews appear on Home and every location page.' } : group,
]);
const templateFields = [...baseline.fields.filter(field => field.group.startsWith('ads.')), ...added.filter(field => field.group.startsWith('ads.'))];
const traralgonCopy = locationCopy(locationMap.traralgon);
export const fields = [
  ...baseline.fields.map(field => field.key.startsWith('ads.') && Object.hasOwn(traralgonCopy, field.key.slice(4))
    ? { ...field, initial: traralgonCopy[field.key.slice(4)] }
    : field.key === 'home.services.0.link' ? { ...field, initial: locationMap.traralgon.path }
    : field),
  ...added,
  ...locations.filter(location => location.page !== 'ads').flatMap(location => {
    const defaults = locationCopy(location);
    return templateFields.map(field => ({
      ...field, key: field.key.replace(/^ads/, location.page), group: field.group.replace(/^ads/, location.page),
      initial: defaults[field.key.slice(4)] ?? structuredClone(field.initial), added: true,
    }));
  }),
];
export const groups = [
  ...baseGroups.filter(group => group.page !== 'shared'),
  ...locations.filter(location => location.page !== 'ads').flatMap(location => baseGroups.filter(group => group.page === 'ads').map(group => ({
    ...group, id: group.id.replace(/^ads/, location.page), page: location.page,
  }))),
  ...baseGroups.filter(group => group.page === 'shared'),
];
