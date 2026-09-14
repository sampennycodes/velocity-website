# Client editor — implementation and staging setup

The full draft editor is implemented at `/admin`: Home and Google Ads page selection, section selection in the preview, 80 fixed content fields, shared profile/reviews/navigation/contact details, image uploads and portrait cropping, saved drafts, version conflicts, history and restore-to-draft. The editor uses the existing Astro components for its preview. The public site remains static.

The server-controlled publishing implementation is present but **disabled** pending approval and installation of the scoped Vercel deployment token. Production release is not authorized. Mike remains disabled and the email delivery gate still allows only Sam.

The latest user request to provide the actual editor superseded the original plan’s sequencing gate; the remaining publishing check is isolated behind the disabled publishing control. The setup-only screen has been replaced.

## Content and preview

- `lib/content/fields.json` holds the field registry and verbatim initial copy; `model.js` validates exact slots, text limits, secure links, media references and crop positions.
- Page components consume a complete content snapshot. The preview uses those same components and maps fixed field identifiers to text, links and images. It accepts messages only from the same-origin editor window.
- The public pages do not include the editor or authentication scripts. Preview shells contain only approved baseline content until the authenticated parent loads a private draft.
- Each build resolves one immutable published snapshot into `.generated/editor-content.json`. Explicit publication builds require the saved source SHA to match Vercel’s commit. Ordinary staging code deployments retain the last confirmed published content; they never read the draft.
- Existing visible text and links on all five public routes were compared against their pre-editor baseline. Initial content is unchanged.

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

`DATABASE_URL` is pooled; `DATABASE_URL_UNPOOLED` is used by migrations. Both use Neon’s WebSocket transport. `EDITOR_ORIGINS` contains exact origins, without wildcards or trailing slashes. Neon Auth has matching trusted origins. Production domains and production execution are rejected by the editor configuration.

## Publishing connection still required

Install an approved project-scoped credential as `EDITOR_VERCEL_TOKEN`, set the fixed team/project IDs and a full tested `EDITOR_APPROVED_SOURCE_SHA` containing this editor, then enable `EDITOR_PUBLISH_ENABLED` for the staging branch only and redeploy. The two Blob credentials are separate: `EDITOR_BLOB_PRIVATE_TOKEN` and `EDITOR_BLOB_PUBLIC_TOKEN`.

Publication validates the current saved version, locks out concurrent publications, prepares public copies of referenced images, creates an immutable publishing snapshot, then asks Vercel to build that exact revision and source. The API never accepts a production target. READY is recorded only after Vercel’s project, team, source SHA, revision and job metadata match. Ambiguous requests retain the publication lock and reconcile by metadata instead of blindly retrying. Failed builds leave the draft and last successful content record intact.

A `preparing`, `building` or `unknown` job blocks another job. If reconciliation cannot find the matching deployment, inspect Vercel before manually resolving it. Do not clear the lock simply because a request timed out. Old private/public media is retained for history; orphan cleanup is outside this release.

## Verification

- 21 automated tests pass, covering contact behavior, auth/session handling, email gating, image validation, field/schema/link restrictions, media metadata, conflict checks, anonymous draft/history/save/restore denial, and pinned staging deployment matching.
- Live database transaction checks passed for draft saving, stale-version conflicts, restoration, immutable history, one active publisher and production-target rejection. All test draft/history/publication writes were rolled back.
- Live storage checks passed for private upload and read, anonymous denial, public copying and byte-for-byte equality. The retained test asset is a public Velocity logo, not client draft content.
- Public-route baseline comparison passed. Production dependency audit was clear after upgrading Astro to 7.3.2; `compressHTML: true` and relocation of the duplicate legacy simulator preserve previous rendering.
- Sam confirmed real login works after the session-cookie correction.
- Final signed-in browser verification of the new editor is pending the Mac unlock. The real Vercel publication remains pending its scoped credential. These are not implied by the database and storage checks.

See `CLIENT_EDITOR_GUIDE.md` for the client workflow. Keep all testing on staging. A future approved production release must rebuild with production settings, not promote a preview artifact.
