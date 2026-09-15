export const CONTACT_MEASUREMENT_ID = 'G-H543PNDES1';

// Keep the existing GA4 event name, but emit it only after email acceptance.
// No submitted values are passed to analytics. GTM already loads this GA4 tag.
export function trackAcceptedContact(target) {
  try {
    target.dataLayer = target.dataLayer || [];
    function gtag() { target.dataLayer.push(arguments); }
    gtag('event', 'contact_form_submission', {
      send_to: CONTACT_MEASUREMENT_ID,
      form_id: 'contact-form',
    });
  } catch {
    // Blocked or unavailable analytics must never turn an accepted lead into an error.
  }
}
