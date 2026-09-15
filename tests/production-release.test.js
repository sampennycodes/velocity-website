import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { productionRelease } from '../lib/content/production.js';
import { contactSettings } from '../lib/content/model.js';
import { trackAcceptedContact } from '../lib/contact-tracking.js';

const manifest = JSON.parse(readFileSync(new URL('../content/production.json', import.meta.url), 'utf8'));
test('production release preserves the published content and contact configuration', () => {
  const release = productionRelease(manifest);
  assert.equal(release.content.values['shared.reviews.ratingLabel'], 'Highly Rated');
  const settings = contactSettings(release.content);
  assert.equal(settings['shared.emails.senderEmail'], 'website@velocitymarketing.com.au');
  assert.equal(settings['shared.emails.recipientEmail'], 'mike@velocitymarketing.com.au');
  assert.equal(settings['shared.form.emailRequired'], true);
});
test('production release rejects private media, missing provenance and invalid content', () => {
  const privateMedia = structuredClone(manifest);
  const id = '00000000-0000-4000-8000-000000000001';
  privateMedia.content.values['shared.profile.image'].assetId = id;
  privateMedia.content.values['shared.profile.image'].src = `/api/editor?action=image&id=${id}`;
  assert.throws(() => productionRelease(privateMedia), /private editor media/);
  const missing = structuredClone(manifest);
  delete missing.revisionId;
  assert.throws(() => productionRelease(missing));
  const invalid = structuredClone(manifest);
  invalid.content.values['shared.emails.recipientEmail'] = 'invalid';
  assert.throws(() => productionRelease(invalid));
});
test('accepted enquiry tracking queues the existing GA4 event without visitor details', () => {
  const target = { dataLayer: [{ event: 'gtm.js' }] };
  trackAcceptedContact(target);
  assert.deepEqual(Array.from(target.dataLayer[1]), ['event', 'contact_form_submission', {
    send_to: 'G-H543PNDES1', form_id: 'contact-form',
  }]);
  assert.doesNotThrow(() => trackAcceptedContact({ dataLayer: Object.freeze([]) }));
});
