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

## Move email sending to Mike's Resend account

The switch is prepared, not activated. Existing production settings have not been changed.

1. In Mike's Resend account, verify `velocitymarketing.com.au` using the DNS records Resend provides. If it is already attached to a different Resend account, complete Resend's domain transfer/claim process first. Keep existing mailbox/MX settings unless Resend's instructions for the selected sending subdomain explicitly require a record change.
2. Create a sending API key in Mike's account, scoped to that verified domain where available.
3. Set these **production** variables in the existing Velocity Marketing Vercel project:

   | Variable | Value |
   | --- | --- |
   | `RESEND_API_KEY` | Key from Mike's account |
   | `SEND_EMAIL_FROM` | `Velocity Marketing <mike@velocitymarketing.com.au>` |
   | `SEND_EMAIL_TO` | `mike@velocitymarketing.com.au` (also the default) |
   | `CONTACT_FORM_DISABLED` | `false` or unset |

4. Redeploy the approved production source for the new settings to take effect. The environment-variable switch can also be deployed separately from the visual refresh.
5. With permission to send a real test enquiry, verify delivery in Mike's inbox and Resend logs, and verify that Reply addresses the visitor. Only then retire the old key if nothing else uses it.

The sender must belong to a domain verified in the account owning the API key. The visitor's email is `replyTo`, not `from`. Missing keys or sender settings return an explicit error. The code does not use a fabricated fallback sender.

See [Resend domain verification](https://resend.com/docs/dashboard/domains/introduction) and the [sending API](https://resend.com/docs/api-reference/emails/send-email).

## Files

- `src/pages/index.astro`: refreshed homepage.
- `src/styles/global.css`: shared responsive visual theme.
- `src/components/ContactForm.astro`: shared accessible form and preview behavior.
- `lib/contact.js`: shared validation, email content, configuration and sending logic.
- `api/contact.js`: live Vercel function.
- `src/endpoints/contact.ts`: local development API.
- `.env.example`: configuration names only; never add live credentials to Git.

The Google Ads and Traralgon pages retain their URLs and local content, with the shared navigation, form and visual theme. Existing social images and the simulator remain in place.

## Font loading

Manrope and Space Grotesk are bundled as Latin variable WOFF2 files, covering all weights used by the site (about 46 KB combined). Vite fingerprints their URLs; the shared layout preloads the exact same assets referenced by the stylesheet. There is no Google Fonts stylesheet or font request at runtime.

Keep `font-display: optional`: the browser uses the custom font if it is ready for the initial render, otherwise it keeps the fallback for that page view instead of swapping fonts later and rewrapping the text. Preloading makes the bundled fonts available early on normal connections. Source URLs are recorded in `src/assets/fonts/SOURCES.json`, and the SIL Open Font Licenses are included in `public/fonts`.
