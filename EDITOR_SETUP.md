# Client editor staging setup

This branch implements phase 1 of `CLIENT_EDITOR_PLAN.md`: the integration harness at `/admin`. It does **not** yet implement content editing, drafts, history, restoration, public image promotion or production publishing. Those phases remain behind the plan’s requirement to prove real login, upload and a revision-pinned staging deployment first.

## Review decisions

- Keep Astro’s public pages static and retain their existing copy, links and layout. The editor uses a small browser script and a separate Vercel function; no SSR adapter or public authentication SDK is required.
- Managed Neon Auth still describes its service as beta in its current [email OTP documentation](https://neon.com/docs/auth/guides/plugins/email-otp). OTP verification and live session validation are delegated to that service; application access is checked separately on every protected request.
- Keep phase 1 `integration_revisions` and `integration_publications` separate from the future content model. An integration revision pins existing source content; it must never be presented as a saved client content revision.
- Only Sam is enabled during setup. Mike is seeded disabled, and the separate OTP delivery gate contains only Sam. No invitation or code is sent by the access-seeding script.
- Use a dedicated private Blob store. Authenticated uploads are decoded, checked and converted to WebP; unpublished images are only served through the protected API.
- Pin deployment requests to a full source SHA and an immutable revision. Omit Vercel’s production target. Serialize active jobs, make repeated requests idempotent, and reconcile ambiguous deployment responses before retrying.
- Upgrade Astro from 5 to 7.3.2 to clear the production dependency audit. Preserve its earlier whitespace behavior with `compressHTML: true`. Move the duplicate legacy simulator HTML outside `public` so the existing `/sim` Astro page keeps precedence.

## Provisioned staging resources

| Resource | Identifier |
| --- | --- |
| Vercel account | `shjpenny@gmail.com` / `sampennycodes` |
| Vercel team | `sam-pennys-projects` / `team_zjInBCSNrQqJZMwfPEZkynST` |
| Vercel project | `velocity-website` / `prj_GystREmzRaAaEennoJHO20yTudVp` |
| Working branch | `codex/visual-refresh` |
| Neon project | `velocity-website-editor-staging` / `wandering-leaf-36893216` |
| Neon branch | `br-wild-violet-a7x4k47v` |
| Neon database | `velocity_editor` |
| Database region | Sydney, `aws-ap-southeast-2` |
| Private Blob store | `velocity-editor-staging-private` / `store_OVi7GlgQAEOtYfSn` |
| Blob region | Sydney, `syd1` |

The production site and its configuration are unchanged. No production editor database or publishing path exists in this implementation. The private Blob integration is attached only to Vercel development and preview environments. Editor environment variables are restricted to the preview branch above.

## Local setup

Use Node 22.12 or newer. Copy the names in `.env.example` into an ignored `.env` and supply the staging credentials. Never commit or send `.env`, `.env.local` or `.vercel` files; `.vercelignore` also excludes them from deployment uploads.

```sh
npm ci
npm run editor:migrate
npm run editor:access
npm run dev
```

Open `http://127.0.0.1:4321/admin`. Astro 7 runs its development server in the background; use `npm run astro -- dev stop` to stop it.

- `DATABASE_URL`: pooled staging database URL, used over Neon’s WebSocket transport by server functions and builds.
- `DATABASE_URL_UNPOOLED`: unpooled staging URL for the migration command. Migrations also use WebSocket transport.
- `EDITOR_ENABLED=true`, `EDITOR_ENVIRONMENT=staging`.
- `EDITOR_ORIGINS`: comma-separated exact origins. No trailing slashes, wildcards or production site domains.
- `NEON_AUTH_BASE_URL`: the staging Neon Auth endpoint. Configure matching trusted origins in Neon Auth.
- `EDITOR_OTP_EMAILS=sam@sampenny.io` until Mike’s onboarding is explicitly approved.
- `EDITOR_BLOB_PRIVATE_TOKEN`: private staging store token, server only.
- `EDITOR_PUBLISH_ENABLED=false` until the scoped Vercel credential and approved source SHA are configured.
- `PUBLIC_SITE_PREVIEW=true`: preserve staging contact, indexing and analytics behavior.

The allowed editor rows are `sam@sampenny.io` (enabled owner) and `mike@velocitymarketing.com.au` (disabled editor). Rerunning `editor:access` does not overwrite an existing access decision. Verified identity IDs are bound on the first successful login. Disabling a row takes effect on the next protected request.

## Completing the phase 1 checks

1. Dedicated staging SMTP is now configured with `smtp.resend.com:465`, Sam’s existing Resend sending credential and `sam@sampenny.io` as sender. Neon confirmed dispatch of a test message to Sam; Sam’s subsequent real OTP verification confirmed delivery. Mike’s preferred sender can be configured during onboarding. Keep authentication mail independent from the preview enquiry form, which intentionally does not send.
2. Sign in as Sam using a real emailed code. Confirm refresh retains the session and sign-out removes access. The browser receives an HttpOnly, Secure-on-HTTPS, SameSite Strict cookie containing Neon’s signed session cookie; it never receives a credential in JSON. The server forwards that signed cookie to Neon for each session check. Login also checks the session before returning success.
3. Upload a JPEG, PNG or WebP through `/admin` with an image description. Maximum input is 3 MiB and 16 megapixels. Confirm the preview loads while signed in and the image endpoint denies anonymous requests. Images are resized within 2048×2048, retain aspect ratio and use new private object names.
4. Create a project-scoped Vercel token, store it only as `EDITOR_VERCEL_TOKEN` in staging configuration, and record its expiry outside source control. Set the team/project IDs above and `EDITOR_APPROVED_SOURCE_SHA` to the full tested commit on this branch. Then enable staging publishing.
5. Start the staging build from `/admin`. Check status until Vercel confirms READY. Confirm the deployment source SHA and `velocity-integration-revision` HTML meta tag match the recorded immutable revision.
6. Verify a failed build preserves the current site, a duplicate request does not create another build, and staging cannot request a production target. Only then proceed to content extraction and the full editor.

A `preparing`, `building` or `unknown` job blocks a second job. For an ambiguous response, check status to locate the Vercel deployment by its job metadata. If it cannot be reconciled, Sam must inspect Vercel before manually resolving the record. Do not clear the lock merely because a request timed out.

## Verification completed

- Production build succeeds and all 16 automated tests pass, covering the existing contact handler plus editor configuration, authentication boundaries, session validity, email delivery gating, image validation and deployment matching.
- All five existing public pages retain their baseline visible text and link destinations after the Astro upgrade.
- Runtime dependency audit reports no vulnerabilities. Four moderate findings remain in the development-only Drizzle tooling dependency chain.
- Built static artifacts contain none of the configured server credentials.
- Live staging database checks confirm Sam is enabled, Mike is disabled, integration revisions reject changes, only one active publication can exist, and production publication records are rejected. Test writes were rolled back.

- Preview deployment `dpl_Df7CF5cq2T6Hbek8F45Y4aYjFs6h` reached READY with a preview target. Its live API denies all six tested anonymous read/write actions with 401 and rejects a cross-origin login-code request with 403. Responses use private, no-store caching.
- Neon confirmed dispatch of the dedicated SMTP test to Sam. No email was sent to Mike.

The corrected browser session flow, private upload and the server-triggered pinned deployment require the remaining setup checks above. Do not report them as passed based on unit tests or an ordinary preview deployment.

Staging review: [Open editor setup](https://velocity-website-git-codex-visual-refresh-sam-pennys-projects.vercel.app/admin). Publishing remains disabled pending approval and installation of the project-scoped token. The Mac was locked during the final browser checks, so a fresh desktop/mobile browser review is also pending.

## Release boundary

Do not merge or promote this staging setup to production. The complete editor still needs the content schema, verbatim migration, preview bindings, optimistic draft saves, image crop controls and public promotion, revision history, restoration, full field coverage and end-to-end acceptance checks in the plan. An approved production release must rebuild with production configuration rather than promote a preview artifact.

## Immediate session-expiry fix

Sam’s first real OTP sign-in created a verified seven-day Neon session, but the editor incorrectly reused the unsigned token from the JSON response as a bearer credential. Neon returned `null` to that session check. The corrected implementation preserves the `__Secure-neon-auth.session_token` response cookie and forwards it to Neon, matching the official server SDK. It verifies the resulting session before setting the local HttpOnly cookie. Regression tests cover login followed by session validation, missing upstream cookies, invalid sessions and sign-out. Existing browser credentials require one fresh sign-in; the code form now includes a resend button.
