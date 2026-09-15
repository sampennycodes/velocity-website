import test from 'node:test';
import assert from 'node:assert/strict';
import baseline from '../lib/content/fields.json' with { type: 'json' };
import { locations, locationMap, locationPages, regions, pages, nearbyLocations } from '../lib/content/locations.js';
import { initialContent, contentSchema, fields, groups, contentRequestByteLimit } from '../lib/content/model.js';
import { applyLocationRollout } from '../lib/content/location-rollout.js';
import { saveDraft, restoreDraft } from '../lib/editor/content.js';
import { readBytes } from '../lib/editor/media.js';

const oldSnapshot = () => ({ schemaVersion: 1, values: Object.fromEntries(baseline.fields.map(field => [field.key, structuredClone(field.initial)])) });
test('homepage groups contain the approved 20 links to 17 town routes', () => {
  assert.equal(locations.length, 17);
  assert.equal(regions.length, 5);
  const slugs = regions.flatMap(region => region.slugs);
  assert.equal(slugs.length, 20);
  assert.equal(new Set(slugs).size, 17);
  assert.deepEqual(regions[0].slugs, ['warragul', 'drouin', 'trafalgar', 'yarragon', 'neerim-south']);
  assert.deepEqual(regions[4].slugs, ['moe', 'morwell', 'traralgon']);
  for (const slug of slugs) assert.equal(locationMap[slug].path, `/paid-ads-${slug}`);
  assert.equal(new Set(locations.map(location => location.path)).size, 17);
  assert.equal(pages[0].id, 'home');
  assert.equal(locationPages[0].name, 'Bairnsdale');
  assert.equal(locationPages.at(-1).name, 'Yarragon');
  assert.equal(locationMap.traralgon.page, 'ads');
});
test('nearby areas stay in-region and deduplicate Central Gippsland and Latrobe Valley', () => {
  assert.deepEqual(nearbyLocations('traralgon').map(location => location.slug), ['moe', 'morwell', 'sale']);
  assert.deepEqual(nearbyLocations('sale').map(location => location.slug), ['moe', 'morwell', 'traralgon']);
  assert.deepEqual(nearbyLocations('warragul').map(location => location.slug), ['drouin', 'trafalgar', 'yarragon', 'neerim-south']);
  assert.deepEqual(nearbyLocations('mallacoota').map(location => location.slug), ['bairnsdale', 'lakes-entrance', 'orbost']);
  for (const location of locations) {
    const nearby = nearbyLocations(location.slug);
    assert.ok(nearby.length >= 3 && nearby.length <= 4);
    assert.equal(new Set(nearby.map(town => town.slug)).size, nearby.length);
    assert.ok(!nearby.includes(location));
  }
});
test('each location has distinct editable content and the complete template field set', () => {
  for (const suffix of ['hero.heading', 'hero.intro', 'services.0.description', 'services.1.description', 'services.2.description', 'about.intro', 'contact.intro', 'seo.title', 'seo.description']) {
    assert.equal(new Set(locations.map(location => initialContent.values[`${location.page}.${suffix}`])).size, 17, suffix);
  }
  for (const location of locations) {
    assert.equal(initialContent.values[`${location.page}.hero.heading`], `Paid Ads Specialist ${location.name} – Google, Meta, & LinkedIn`);
    assert.deepEqual(groups.filter(group => group.page === location.page).map(group => group.id.slice(location.page.length + 1)), ['hero', 'services', 'about', 'areas', 'contact', 'seo']);
    assert.equal(fields.filter(field => field.group.startsWith(`${location.page}.`)).length, 27);
    if (location.slug !== 'traralgon') assert.doesNotMatch(initialContent.values[`${location.page}.hero.intro`], /Traralgon-based|based in/i);
  }
});
test('old snapshots receive new fields without changing legacy copy or rewriting their history', () => {
  const old = oldSnapshot();
  old.values['ads.hero.heading'] = 'A saved Traralgon heading';
  old.values['shared.reviews.heading'] = 'Client-selected reviews';
  const original = JSON.stringify(old);
  const parsed = contentSchema.parse(old);
  assert.equal(parsed.values['ads.hero.heading'], old.values['ads.hero.heading']);
  assert.equal(parsed.values['shared.reviews.heading'], 'Client-selected reviews');
  assert.ok(parsed.values['location-warragul.hero.heading']);
  assert.equal(JSON.stringify(old), original);
  delete old.values['ads.hero.heading'];
  assert.equal(contentSchema.safeParse(old).success, false, 'Legacy required fields remain required');
});
test('explicit rollout changes requested copy and links while preserving other edits and cloning existing template settings', () => {
  const old = oldSnapshot();
  old.values['ads.hero.primaryLabel'] = 'Discuss my campaign';
  old.values['ads.seo.image'].description = 'Existing client social image';
  old.values['shared.reviews.heading'] = 'Custom reviews';
  const original = JSON.stringify(old);
  const updated = applyLocationRollout(old);
  assert.equal(updated.values['home.services.0.link'], '/paid-ads-traralgon');
  assert.equal(updated.values['ads.hero.heading'], initialContent.values['ads.hero.heading']);
  assert.equal(updated.values['ads.hero.primaryLabel'], 'Discuss my campaign');
  assert.equal(updated.values['location-moe.hero.primaryLabel'], 'Discuss my campaign');
  assert.deepEqual(updated.values['location-moe.seo.image'], old.values['ads.seo.image']);
  assert.equal(updated.values['shared.reviews.heading'], 'Custom reviews');
  assert.equal(JSON.stringify(old), original);
  assert.deepEqual(applyLocationRollout(updated), updated);
  updated.values['location-moe.hero.heading'] = 'Independent edit';
  assert.equal(applyLocationRollout(updated).values['location-moe.hero.heading'], 'Independent edit');
});
test('normal save and history restoration round-trip per-town edits without changing other towns', async () => {
  let version = 1;
  const revisions = new Map();
  const query = async (sql, args = []) => {
    if (sql.startsWith('SELECT snapshot')) return { rows: [{ snapshot: revisions.get(args[0]) }] };
    if (sql.startsWith('SELECT version')) return { rows: [{ version }] };
    if (sql.startsWith('INSERT INTO velocity_editor.content_revisions')) revisions.set(args[0], structuredClone(args[2]));
    if (sql.startsWith('UPDATE velocity_editor.drafts')) return { rows: [{ snapshot: args[0], revision_id: args[1], version: ++version }] };
    return { rows: [] };
  };
  const pool = { query, connect: async () => ({ query, release() {} }) };
  const editor = { email: 'owner@example.com', role: 'owner' };
  const content = structuredClone(initialContent);
  content.values['location-drouin.hero.heading'] = 'Drouin campaign consultation';
  const saved = await saveDraft(content, version, editor, {}, null, { pool });
  assert.equal(saved.content.values['location-drouin.hero.heading'], 'Drouin campaign consultation');
  assert.equal(saved.content.values['location-warragul.hero.heading'], initialContent.values['location-warragul.hero.heading']);
  const old = oldSnapshot();
  old.values['ads.hero.heading'] = 'Historical Traralgon copy';
  revisions.set('history', old);
  const restored = await restoreDraft('history', saved.version, editor, {}, { pool });
  assert.equal(restored.content.values['ads.hero.heading'], 'Historical Traralgon copy');
  assert.equal(restored.content.values['location-drouin.hero.heading'], initialContent.values['location-drouin.hero.heading']);
  assert.equal(revisions.get(saved.revisionId).values['location-drouin.hero.heading'], 'Drouin campaign consultation');
});
test('full-site saves fit the bounded request reader, including maximum-length escaped copy', async () => {
  const content = structuredClone(initialContent);
  for (const field of fields.filter(field => ['text', 'textarea'].includes(field.type) && field.group !== 'shared.emails')) {
    content.values[field.key] = '\u0000'.repeat(field.max);
  }
  assert.equal(contentSchema.safeParse(content).success, true);
  const body = JSON.stringify({ content, version: 1, key: '00000000-0000-4000-8000-000000000001' });
  assert.ok(Buffer.byteLength(body) > 256000, 'Full valid drafts can exceed the former cap');
  const bytes = await readBytes(new Request('https://example.test', { method: 'POST', body }), contentRequestByteLimit);
  assert.equal(bytes.length, Buffer.byteLength(body));
  await assert.rejects(readBytes(new Request('https://example.test', { method: 'POST', body: 'x'.repeat(contentRequestByteLimit + 1) }), contentRequestByteLimit), { status: 413 });
});
