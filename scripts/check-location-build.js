import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { locations, pages, regions, nearbyLocations } from '../lib/content/locations.js';
import { contentSchema } from '../lib/content/model.js';

const content = contentSchema.parse(JSON.parse(readFileSync('.generated/editor-content.json', 'utf8')));
const escape = text => text.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;').replaceAll("'", '&#39;');
const html = path => readFileSync(`dist${path === '/' ? '' : path}/index.html`, 'utf8');
const areaLinks = source => {
  const section = source.match(/<section\b[^>]*id="areas-we-service"[^>]*>([\s\S]*?)<\/section>/)?.[1];
  assert.ok(section, 'Service areas section exists');
  return [...section.matchAll(/<a\b[^>]*href="([^"]+)"/g)].map(match => match[1]);
};
const home = html('/');
const homepageLinks = areaLinks(home);
assert.equal(homepageLinks.length, 20);
assert.equal(new Set(homepageLinks).size, 17);
assert.ok(home.indexOf('id="about"') < home.indexOf('id="areas-we-service"'));
assert.ok(home.indexOf('id="areas-we-service"') < home.indexOf('id="contact"'));
for (const region of regions) assert.ok(home.includes(region.name));
const sitemap = readFileSync('dist/sitemap-0.xml', 'utf8');
const titles = new Set();
for (const location of locations) {
  const source = html(location.path);
  assert.equal((source.match(/<h1\b/g) || []).length, 1, location.name);
  assert.ok(source.includes(escape(content.values[`${location.page}.hero.heading`])), `${location.name}: selected heading rendered`);
  const title = source.match(/<title>(.*?)<\/title>/)?.[1];
  assert.equal(title, escape(content.values[`${location.page}.seo.title`]));
  titles.add(title);
  assert.ok(source.includes(`rel="canonical" href="https://velocitymarketing.com.au${location.path}"`));
  assert.ok(source.includes(escape(content.values[`${location.page}.seo.description`])));
  assert.ok(source.includes('id="contact-form"') && source.includes('id="services"'));
  assert.ok(!source.includes('velocity-preview-ready'), 'Editor messaging is absent from public pages');
  assert.deepEqual(areaLinks(source), nearbyLocations(location.slug).map(town => town.path));
  assert.ok(sitemap.includes(`https://velocitymarketing.com.au${location.path}`));
}
assert.equal(titles.size, 17);
assert.equal((sitemap.match(/<loc>https:\/\/velocitymarketing.com.au\/paid-ads-/g) || []).length, 17);
assert.ok(!sitemap.includes('/admin') && !sitemap.includes('/google-ads-traralgon') && !sitemap.includes('.au/traralgon'));
for (const page of pages) assert.ok(existsSync(`dist/admin/preview/${page.id}/index.html`));
for (const old of ['/traralgon', '/google-ads-traralgon']) assert.ok(html(old).includes('/paid-ads-traralgon'));
const editor = html('/admin');
assert.match(editor, /<optgroup\b[^>]*label="Location Pages"/);
for (const location of locations) assert.ok(editor.includes(`value="${location.page}"`));
console.log('Build verified: 20 homepage links, 17 location pages, 56 nearby links, 18 CMS previews, canonicals, sitemap and Traralgon redirects.');
