# Velocity Marketing

Astro marketing site for Mike Nicholas. The existing site is deployed on Vercel; the `main` branch is the production source. The visual refresh is on `codex/visual-refresh` for review before merging.

## Local preview

```sh
npm ci
npm run dev
```

Open http://localhost:4321. Local previews disable analytics and search indexing. The form validates inputs and displays a preview-only message without sending email. The local API also blocks delivery.

```sh
npm run build
node --test tests/contact.test.js
```

The Astro build produces static pages in `dist`. Production mail is handled separately by the Vercel function `api/contact.js`; there is no Astro Vercel adapter. A small development-only Astro integration mounts `src/endpoints/contact.ts` locally; it is excluded from the static production build.

## Review link

Push the review branch to the existing GitHub repository. Its Vercel Git integration can create a preview deployment. Confirm the resulting deployment belongs to `codex/visual-refresh` and is a **preview**, then share that deployment's URL. Do not merge or promote it until the design is approved.

`VERCEL_ENV=preview` disables mail on the server and disables indexing, analytics and form delivery in the built pages. If building a static review outside Vercel, set `PUBLIC_SITE_PREVIEW=true`; that build still needs a separately hosted API to support real mail, and is intended for visual review only. Never use the preview build as production output.

## Contact form

Both editable pages include “How did you hear about us?” with Word of mouth, Google Search, Search Engine (Other), AI Assistant (ChatGPT, etc.), and Other (Please specify). Choosing Other reveals a details field, required by default. The question is visible and optional by default. In **Shared → Contact form**, editors can hide the referral question and configure **Required** and **Show status label** independently for all six form fields. Labels switch between `*` and `(optional)`; hiding a label never changes validation. Name, Email, Message and Other details default to required; Phone and referral source default to optional. These settings update the CMS preview, follow the immutable content snapshot, and are enforced by the server. Hidden questions ignore submitted referral answers. The selected answer appears only in the internal enquiry, in escaped HTML and plain text. Optional missing email skips the autoresponder and omits the enquiry Reply-To. Optional missing name uses “there” for `{firstName}` and “a website visitor” for `{name}`. Empty submissions are rejected even if all fields are optional.

## Contact protection

The public contact form uses a Cloudflare Turnstile **Managed** widget, restricted to `velocitymarketing.com.au` (including `www`). Set `PUBLIC_TURNSTILE_SITE_KEY` and the server-only `TURNSTILE_SECRET_KEY` in the Vercel production environment, then rebuild: the site key is embedded in the static pages. Production builds reject missing keys and Cloudflare's public test keys. Never commit the secret or expose it in the browser.

Before either email is sent, `/api/contact` verifies `cf-turnstile-response` with Cloudflare Siteverify and requires `success: true`, action `contact`, and the exact apex or `www` hostname. Missing, invalid, expired and reused tokens are rejected. Verification outages fail closed with a retry message. Only the token and secret are sent to Siteverify; enquiry details stay out of that request. The browser refreshes expired checks and resets the widget after every submission attempt, preserving typed fields on failure. Local, Vercel preview and CMS preview forms skip the widget and remain unable to send email. See [Cloudflare's verification documentation](https://developers.cloudflare.com/turnstile/get-started/server-side-validation/).

## Contact emails

The V2 handler uses `RESEND_API_KEY_NEW`, falling back to `RESEND_API_KEY` only when the new variable is empty. Keep both server-only. The user has verified `velocitymarketing.com.au` in Resend.

Every accepted enquiry sends:

1. An enquiry from **Velocity Marketing <website@velocitymarketing.com.au>** to **mike@velocitymarketing.com.au**. Reply addresses the lead. Their name, email, optional phone and message are always included.
2. A confirmation to the lead, from the same sender, with replies directed to Mike by default: “Hi {firstName}, Thanks for your email. We’ll get back to you as soon as possible. Thanks, Velocity Marketing.”

In `/admin`, choose **Shared → Contact emails** to edit the sender name and address, enquiry inbox, confirmation reply address, and both email subjects and messages. The **From email** may be changed to any valid address on a domain verified in the selected Resend account. Resend enforces domain verification when sending. **Reply-to email (optional)** controls confirmation replies: leave it blank to omit the override and use the From address. Enquiry notifications always reply to the lead. The templates accept `{name}` and `{firstName}` and render as escaped plain text in HTML and text emails. Both emails have a responsive dark header, lilac accent, readable white body and branded footer, with plain-text alternatives. The editor has Contact Form and Autoresponder tabs, each showing its own settings and actual styled preview, with Desktop/Mobile widths and no email delivery. Sender fields are shared, and switching tabs preserves unsaved edits. The public contact-details fields remain separate. Legacy `SEND_EMAIL_FROM` / `SEND_EMAIL_TO` variables no longer override the CMS.

Email settings follow the normal versioned save, restore and staging-publication workflow. Old snapshots receive the new default fields on read without rewriting history. The build writes the selected immutable revision’s form and email settings to `.generated/contact-email-settings.json`, explicitly packaged with the Vercel contact function. Requests never read a moving draft. Missing or invalid packaged settings fail closed.

The CMS publishes to staging. Preview/local contact forms remain disabled. Production builds use the approved, version-controlled snapshot in `content/production.json`, including its email settings. They never read the live draft or need editor database credentials. The build rejects preview mode, disabled contact delivery, invalid snapshots, and private editor media. Set `RESEND_API_KEY_NEW` in production and leave `CONTACT_FORM_DISABLED` unset or `false`. Never promote a preview artifact to production. The production `/admin` address redirects to the existing staging editor; saving there continues to update the review site.

## Production content and tracking

`content/production.json` holds the exact published revision selected for release, its original source SHA, and its public content snapshot. For a later release, export an already-published staging revision, validate it with `productionRelease`, review its diff, commit it, and rebuild in the production environment. Do not copy an unpublished draft. Keep the old production deployment for rollback.

GTM container `GTM-5T5JZMW` loads the existing GA4 property `G-H543PNDES1`, phone/email click tags, and the existing advertising pixels. The published container's legacy contact trigger matches any click whose element classes contain `btn primary`. Public buttons now use `btn btn--primary` so navigation clicks and invalid submissions cannot trigger that legacy conversion. After the API accepts an enquiry, `trackAcceptedContact` queues the existing `contact_form_submission` GA4 event once, without any form values. If GTM is later updated to use a custom success trigger, coordinate that change with this direct event to avoid double counting. Analytics failure never changes form success.

The confirmation is sent only after Resend accepts the enquiry. If the enquiry fails, the form reports an error and no confirmation is sent. If only the confirmation fails, the form still acknowledges the accepted enquiry and the server logs the receipt failure without lead details; there is no automatic receipt retry. This avoids prompting duplicate submissions. Resend acceptance does not itself prove inbox delivery.

See the [Resend sending API](https://resend.com/docs/api-reference/emails/send-email). Automated tests mock delivery; a real inbox delivery check is a separate release check.

## Files

- `src/pages/index.astro`: refreshed homepage.
- `src/styles/global.css`: shared responsive visual theme.
- `src/components/ContactForm.astro`: shared accessible form and preview behavior.
- `lib/contact.js`: shared validation, email content, configuration and sending logic.
- `api/contact.js`: live Vercel function.
- `src/endpoints/contact.ts`: local development API.
- `.env.example`: configuration names only; never add live credentials to Git.

Location pages use `/paid-ads-{town}` URLs and the shared navigation, form and visual theme. The legacy `/google-ads-traralgon` and `/traralgon` routes permanently redirect to `/paid-ads-traralgon`. Existing social images and the simulator remain in place.

## Font loading

Manrope and Space Grotesk are bundled as Latin variable WOFF2 files, covering all weights used by the site (about 46 KB combined). Vite fingerprints their URLs; the shared layout preloads the exact same assets referenced by the stylesheet. There is no Google Fonts stylesheet or font request at runtime.

Keep `font-display: optional`: the browser uses the custom font if it is ready for the initial render, otherwise it keeps the fallback for that page view instead of swapping fonts later and rewrapping the text. Preloading makes the bundled fonts available early on normal connections. Source URLs are recorded in `src/assets/fonts/SOURCES.json`, and the SIL Open Font Licenses are included in `public/fonts`.
