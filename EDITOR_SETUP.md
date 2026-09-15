# Client editor — implementation and staging setup

The full draft editor is implemented at `/admin`: Home and Google Ads page selection, section selection in the preview, 102 fixed content fields, shared profile/reviews/navigation/contact details, image uploads and portrait cropping, saved drafts, version conflicts, history and restore-to-draft. The editor uses the existing Astro components for its preview. The public site remains static.

Staging publishing is enabled and verified. Mike is enabled with the `editor` role; Sam remains `owner`. Both can save drafts, upload images, restore history and update staging. The optional `preview` role still denies all writes. The OTP gate allows Sam and Mike; no invitations are sent and codes are sent only on request. Production release is not authorized.

The setup-only screen has been replaced by the complete editor.

## Content and preview

- `lib/content/fields.json` holds the field registry and verbatim initial copy; `model.js` validates exact slots, text limits, secure links, media references and crop positions.
- Page components consume a complete content snapshot. The preview uses those same components and maps fixed field identifiers to text, links and images. It accepts messages only from the same-origin editor window.
- The public pages do not include the editor or authentication scripts. Preview shells contain only approved baseline content until the authenticated parent loads a private draft.
- Each build resolves one immutable published snapshot into `.generated/editor-content.json`. Explicit publication builds require the saved source SHA to match Vercel’s commit. Ordinary staging code deployments retain the last confirmed published content; they never read the draft.
- Existing visible text and links on all five public routes were compared against their pre-editor baseline. Initial content is unchanged.

The V2 default social card is `public/ogimage-v2.png` (1200 × 630), created with the built-in image generator using the original logo and `img_8071.png` portrait. The design brief was: black background, white geometric headline, lilac “Real Growth”, a rounded portrait panel, and restrained paid-media service labels. Existing saved references to `/ogimage.png` display the refreshed asset without rewriting drafts or custom uploads. Open Graph and Twitter metadata use absolute image URLs on the staging hostname for previews, and the production hostname for future production builds.

## Data and access

Neon stores editor access, a versioned site draft, immutable saved/restored/publishing revisions, media metadata, publication jobs and the last confirmed published revision. Drizzle migration `0002_content_editor.sql` adds the full editor tables alongside the original integration-proof tables.

Every protected API request checks the signed Neon session and the current application allowlist. The browser holds Neon’s signed session cookie inside a narrow HttpOnly, SameSite Strict cookie. Login verifies the new session before returning success. Never substitute the unsigned JSON token for that cookie: the initial implementation did so, which caused the immediate-expiry bug; this is fixed and covered by regression tests.

Draft saves use a row lock and optimistic version comparison. Restore creates a new revision and advances the draft version. History is never overwritten. Uploaded media references are resolved from server metadata, not trusted from submitted URLs or dimensions.

## Staging resources

| Resource | Identifier |
| --- | --- |
| Vercel account | `shjpenny@gmail.com` / `sampennycodes` |
| Team | `sam-pennys-projects` / `team_zjInBCSNrQqJZMwfPEZkynST` |
| Project | `velocity-website` / `prj_GystREmzRaAaEennoJHO20yTudVp` |
| Branch | `codex/visual-refresh` |
| Staging site | https://velocitymarketing-v2.vercel.app/ |
| Editor | https://velocitymarketing-v2.vercel.app/admin |
| Neon project | `velocity-website-editor-staging` / `wandering-leaf-36893216` |
| Neon staging branch | `br-wild-violet-a7x4k47v` |
| Database | `velocity_editor`, Sydney |
| Private Blob store | `store_OVi7GlgQAEOtYfSn`, Sydney |
| Public Blob store | `store_BRZQAcnn91CVjipl`, Sydney |

Storage integrations are attached only to preview/development. Editor variables are restricted to the staging branch’s preview environment. Authentication SMTP uses Sam’s existing Resend sending credential via `smtp.resend.com:465`, with `sam@sampenny.io` as sender. Sam’s real OTP login confirmed delivery. The contact form remains disabled on previews independently of authentication mail.

## Local commands

Use Node 22.12 or newer. Supply staging credentials using the variable names in `.env.example` in an ignored `.env`.

```sh
npm ci
npm run editor:migrate
npm run editor:access
npm test
npm run dev
```

Astro 7 runs its dev server in the background. Use `npm run astro -- dev stop` to stop it. Generated snapshots, environment files and `.vercel` state are excluded from git and deployment uploads.

`DATABASE_URL` is pooled; `DATABASE_URL_UNPOOLED` is used by migrations. Both use Neon’s WebSocket transport. `EDITOR_ORIGINS` contains exact origins, without wildcards or trailing slashes. Neon Auth has matching trusted origins. The short `velocitymarketing-v2.vercel.app` domain tracks `codex/visual-refresh`; the original long branch URL remains usable. Sign in again when moving to the new hostname because session cookies belong to their original host. Production domains and production execution are rejected by the editor configuration.

## Staging publishing configuration

`EDITOR_VERCEL_TOKEN` is a Vercel Secret restricted to Preview / `codex/visual-refresh`. The approved token is named **Velocity Editor Staging**, scoped to this project, and expires **14 December 2026**. Renew it before then and redeploy staging. The fixed team/project IDs and `EDITOR_PUBLISH_ENABLED=true` use the same branch restriction. `EDITOR_APPROVED_SOURCE_SHA` pins the tested implementation; advance it only after testing code changes that content builds should use. The two Blob credentials are separate: `EDITOR_BLOB_PRIVATE_TOKEN` and `EDITOR_BLOB_PUBLIC_TOKEN`.

Publication validates the current saved version, locks out concurrent publications, prepares public copies of referenced images, creates an immutable publishing snapshot, then asks Vercel to build that exact revision and source. The prebuild resolves the revision from that deployment’s immutable metadata; publishing never changes the shared project build command. The API never accepts a production target. READY is recorded only after Vercel’s project, team, source SHA, revision and job metadata match and the stable staging link serves that revision. Ambiguous requests retain the publication lock and reconcile by metadata instead of blindly retrying. Failed builds leave the draft and last successful content record intact.

Saving with publishing enabled performs one Save & update staging action. The UI polls for completion, and a server background monitor continues normal builds if the tab closes. A failed update retains the saved draft and offers a retry. A `preparing`, `building` or `unknown` job blocks another job. If reconciliation cannot find the matching deployment, inspect Vercel before manually resolving it. Do not clear the lock simply because a request timed out. Old private/public media is retained for history; orphan cleanup is outside this release.

## Performance

The editor function runs in `syd1` beside the Sydney Neon database and Auth service. The authenticated workspace endpoint combines session, draft and status loading into one browser request, with independent data reads in parallel. Every request still verifies the current session and editor permission; private responses remain uncached. Publication estimates use the last ten jobs, considering only successful durations, with a 20–45 second fallback. The UI reports elapsed time and actual build/checking/completed states, never a simulated percentage.

The default portrait has 480/800/1200px WebP variants; the logo and small raster marks also use reduced WebP copies. Originals remain for existing draft compatibility. `npm run images:optimize` regenerates the committed manifest and content-hashed files when source artwork changes. Only these hashed assets get year-long immutable caching. Custom images and preview uploads keep their own source and clear the default portrait's `srcset`. Image conversion is not part of each publishing build.

## Verification

- Automated tests cover the original editor and email flows, covering contact behavior, auth/session handling, email gating, image validation, field/schema/link restrictions, media metadata, conflict checks, anonymous draft/history/save/restore denial, pinned staging deployment matching, combined workspace access, publication estimates and responsive image compatibility.
- Live database transaction checks passed for draft saving, stale-version conflicts, restoration, immutable history, one active publisher and production-target rejection. All test draft/history/publication writes were rolled back.
- Live storage checks passed for private upload and read, anonymous denial, public copying and byte-for-byte equality. The retained test asset is a public Velocity logo, not client draft content.
- Public-route baseline comparison passed. Production dependency audit was clear after upgrading Astro to 7.3.2; `compressHTML: true` and relocation of the duplicate legacy simulator preserve previous rendering.
- Sam confirmed real login works after the session-cookie correction.
- Preview-role tests cover write denial before storage access, read-only draft loading, local image URL restrictions and on-request OTP eligibility.
- Signed-in browser verification passed on 15 September 2026: Save & update staging saved a temporary Home button-label change, created the pinned Vercel preview build, automatically confirmed the stable staging URL, and displayed the changed label on that public URL. The original label was then saved back through the same workflow. Mike’s role was changed from preview to editor after the first successful publication.
- Dropdown arrow spacing was visually verified in the deployed editor. Browser interaction checks cover save progress, retry after publishing failure, and preserving edits made during a save.
- Production remains at deployment `dpl_Dq2SuHn9CFTntUwLbGXwj8C1vKZM`, source `70ef263529c4402e87f2019e8d7c397baf3cd46a`; the shared build command remains unchanged (`null`).

See `CLIENT_EDITOR_GUIDE.md` for the client workflow. Keep all testing on staging. A future approved production release must rebuild with production settings, not promote a preview artifact.

## V2 contact email settings

The shared Contact emails group adds eight validated fields and in-editor samples for the enquiry and lead confirmation. Missing fields in older snapshots default on read, while existing fixed slots remain required. There is no database migration or history rewrite. The contact function packages `.generated/contact-email-settings.json` from the same selected build snapshot as the pages, and prefers `RESEND_API_KEY_NEW`. The CMS owns addresses and templates; obsolete sender/recipient environment variables are ignored. Staging delivery remains disabled.

Advance the branch-scoped `EDITOR_APPROVED_SOURCE_SHA` to the tested code revision before deploying this editor, so later Save & update staging builds include the email fields. Production publishing remains a separate future release task; carry the approved snapshot into that release instead of relying on default production content.

The shared Contact form group stores a referral visibility flag plus Required and Show status label flags for each field. Older snapshots preserve the original requirements and visible labels; the referral question defaults to visible and optional. The same packaged contact settings control server validation, and hidden referral answers are discarded. Other details are bounded to 500 characters and escaped in the internal notification. The CMS preview applies these flags immediately. Optional missing email produces only the team notification; missing name uses readable template fallbacks. Entirely empty submissions remain invalid. Contact delivery remains disabled on staging.
