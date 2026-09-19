# Velocity Marketing V2 WIP — client editor

Implementation plan · 14 September 2026 · V2 WIP

Implementation status: the draft editor and content migration are now implemented on staging. Mike now has browser-only preview access without saving. Publishing remains disabled pending its scoped credential; final browser acceptance and production release remain outstanding. See `EDITOR_SETUP.md` for verification and `CLIENT_EDITOR_GUIDE.md` for usage.

## Version and scope

This plan applies to **Velocity Marketing V2 WIP**, the visual refresh on the `codex/visual-refresh` branch and its localhost/Vercel staging previews. Build and review the editor against this version. The existing production website remains unchanged until the V2 WIP site and editor are approved for release.

## Outcome

Give Mike an email-code login and a simple visual editor for the two main marketing pages. He can update text, links and images, preview his changes, and publish them without working with code or altering the site’s design.

The approved copy and current visual refresh are the starting content. Adding the editor must not rewrite copy or change the public layout.

## Agreed direction

| Responsibility | Proposed implementation |
| --- | --- |
| Public website | Existing Astro site on Vercel, with static public pages |
| Editor | Custom `/admin` interface with a page preview and section editing panel |
| Content, drafts and history | Neon Postgres |
| Login | Neon Auth email OTP, with application access restricted to approved editors |
| Image uploads | Vercel Blob |
| Authentication email delivery | Dedicated SMTP configuration, preferably Mike’s verified Resend account |
| Publishing | Server-controlled Vercel deployment of a specific saved content revision |

Neon’s [email OTP guide](https://neon.com/docs/auth/guides/plugins/email-otp) confirms passwordless sign-in support and currently labels managed auth beta. Verify its current status and compatibility during the first implementation phase. The public website should continue serving its existing static deployment if the editor or database is unavailable.

## Mike’s editing experience

1. Open `/admin`, enter his email, and enter the code received by email.
2. Choose **Home** or **Google Ads in Traralgon**.
3. See a preview of the page. Editable sections show a subtle outline and edit button on hover, keyboard focus or tap.
4. Select a section to open its fields in a side panel. Changes update the preview immediately.
5. Choose **Save draft** to keep unfinished work. Show a saved/unsaved indicator and warn before leaving with unsaved changes.
6. Choose **Publish** to release the saved version. Show **Publishing**, then **Live** only after Vercel confirms a successful deployment.
7. Use **History** to restore an earlier version into a draft, review it, and publish again.

The editor must work without hover. On a narrow screen, show the editing fields in a drawer or full-width panel with a clear way back to the preview.

## Editable scope

| Area | Editable fields | Design constraints |
| --- | --- | --- |
| Hero | Heading, highlighted phrase, supporting text, button labels and destinations | Preserve the heading treatment, button styles and layout |
| Services | Existing service titles, descriptions and links | Keep the four service slots and platform marks, including editable ChatGPT Ads copy |
| About | Heading, introduction and existing bullet points | Preserve spacing and typography |
| Mike’s profile | Portrait, image description, crop position, name, role and LinkedIn URL | One shared profile for desktop and mobile placements |
| Reviews | Existing quote, name and business fields | Keep the current card layout and review slots |
| Contact | Heading, introductory text, public email and phone number | Keep form labels, validation and delivery settings in code/configuration |
| Shared navigation/footer | Existing link labels, destinations and public contact details | Keep structure and styling fixed |
| Search metadata | Page title, description and social image | Keep existing routes and canonical URL rules |

Use ordinary text inputs and textareas wherever possible. Offer limited rich text only where the existing design needs it: bold, links and lists. Never expose raw HTML, arbitrary embeds, font controls, colour controls or freeform layout editing.

Keep the logo, platform marks, Google rating claim, proof-point animations and decorative assets managed in code for this first version. A simple content editor does not need a page builder or animation controls.

The repository also contains `/traralgon`, `/sim` and the error page. Preserve those routes. They are outside the page editor’s initial scope; shared content updates may still appear wherever shared components are used. Label shared fields clearly so Mike understands their reach.

Changing the displayed contact email must not silently change the form’s sending account or destination. Manage those delivery settings separately.

## Architecture

### Separate content from presentation

- Extract existing text and image references into a typed, validated content model for the two pages plus shared content.
- Seed the model verbatim from the current source. Treat this as a content migration, not a copywriting pass.
- Refactor the existing Astro sections to consume this model while retaining their HTML structure and CSS.
- Give editable regions stable field identifiers. A shared value, such as Mike’s portrait, must update every relevant instance in the preview.
- Keep a versioned schema in the repository so future code changes can migrate older content deliberately.

### Keep public pages static

- Public builds load one explicit content revision and render it into HTML. Visitors do not fetch the database to read the page.
- The ordinary website does not load the editing interface or authentication SDK.
- Render the editor’s preview shell using the same Astro section components and styling as the public pages. After login, load the private draft and apply changes to the mapped fields.
- Use shared content formatting rules for preview and published output. Verify that text, lists, links and image crops render consistently in both.
- Start with a small client-side editor and Vercel server functions for its protected API, matching the existing hosting architecture. Add a framework adapter only if an integration requires it; do not migrate all public pages to server rendering simply to support editing.

### Store content and history in Neon

Use a small schema with these responsibilities:

- **Editor access:** approved identities and owner/editor permissions, separate from the managed authentication tables.
- **Drafts:** the editable site content, schema version, last editor and an optimistic-lock version to prevent silent overwrites.
- **Content revisions:** immutable snapshots created for publishing, including author, time and the previous revision being restored when applicable.
- **Media assets:** Blob object references, dimensions, file type and original filename. Store image bytes in Blob rather than Postgres.
- **Publishing records:** target environment, content revision, approved source commit, deployment ID, status and the last successfully deployed revision.

Publish a complete site snapshot so shared content and both pages stay consistent. Keep database schema migrations in source control, using Drizzle for schema management.

### Login and access

- Use Neon Auth to generate, send and verify one-time codes and manage sessions.
- Restrict editing to Mike and Sam’s approved identities. A successful sign-in alone must not grant editing access.
- Check session validity and editor permissions on every content, upload and publish API request. Hiding controls in the browser is not authorization.
- Keep database, Blob write, SMTP and deployment credentials on the server.
- Apply request validation, appropriate origin/CSRF protections for the chosen session mechanism, and rate limits to sensitive endpoints.
- Support expired codes, expired sessions, sign-out and removed editor access with clear messages that preserve unsaved work where practical.
- Configure the exact localhost, staging and production authentication origins. Keep staging content and credentials isolated from production.

Authentication emails must work on staging even though the existing preview contact form intentionally does not send enquiries. Use separate configuration for those two behaviours.

### Image handling

- Allow JPEG, PNG and WebP uploads, with a documented file-size limit and server-side verification of the actual file contents.
- Require image descriptions where the image conveys content, and offer a simple focal-point/crop control.
- Generate suitable display dimensions and keep width/height metadata to prevent layout shifts.
- Give replacement images new object names. Keep older images available for content restoration.
- Show upload progress and actionable errors; do not save broken image references into a draft.
- Keep unpublished uploads private. Copy or promote approved image versions into public delivery as part of publishing, and persist the final references in the saved revision.
- Use [Vercel Blob](https://vercel.com/docs/vercel-blob) for storage and delivery. Automatic permanent deletion of old images is outside the first release.

## Publishing and restoration

1. Validate the saved draft and confirm the editor is allowed to publish to the requested environment.
2. Create an immutable candidate revision. Resolve uploaded assets to their intended published versions.
3. Request a Vercel deployment using the approved application source and an explicit content revision identifier supplied to that build.
4. Read that revision once for the build and use it across every page. Avoid reading a moving “latest draft” pointer during deployment.
5. Track the deployment on the server. Confirm the result with Vercel before showing success or updating the live revision record.
6. If a build fails, keep the existing live deployment and content record intact. Preserve the draft and show a retry option.

Allow only one publishing job per environment at a time. Prevent duplicate clicks from starting duplicate deployments, and detect drafts changed by another editor before overwriting them.

Restoration follows the same process: copy a previous revision into a new draft, preview it, then publish a new revision. Do not erase the intervening history.

Staging publishing must always target staging. During the initial production rollout, rebuild the approved source with production configuration: the existing preview builds deliberately bake in disabled enquiry delivery, analytics and indexing, so a preview artifact must not be promoted directly into production.

## Implementation sequence

### 1. Prove the integrations

- Confirm access to the `sam-pennys-projects` Vercel workspace and `velocity-website` project for Blob configuration and deployment requests.
- Select or create a dedicated Velocity Neon project and separate development/staging and production data.
- Confirm Mike’s editor email and Sam’s chosen editor email.
- Prove OTP login, server-side session validation and editor authorization in the current Astro/Vercel setup.
- Configure authentication email delivery using a verified sender.
- Prove one authenticated image upload and one staging deployment pinned to a content revision.

**Exit condition:** the core login, upload and publishing paths work before building the full editor.

### 2. Extract and seed the content

- Define the content schema and migrations.
- Move the existing approved content into the model and seed the initial revision.
- Refactor the two page templates and shared components to read it.
- Compare the initial rendered content with the existing site and retain the current appearance.

**Exit condition:** the site builds from structured content with unchanged initial copy and styling.

### 3. Build one complete editing flow

- Build `/admin`, page selection, draft loading and save state.
- Wire the homepage hero to the overlay and editing panel.
- Include portrait replacement and crop positioning to exercise the image path.
- Complete draft saving, preview and staging publishing for those fields.

**Exit condition:** Mike’s intended workflow is usable end to end for one section.

### 4. Extend across the agreed content

- Add the remaining homepage sections, the Google Ads page and shared settings.
- Add field validation, link handling, image descriptions and any required limited rich text.
- Add revision history, restore-to-draft and conflicting-edit handling.
- Complete keyboard and touch interactions.

**Exit condition:** every field in the agreed scope is editable, and shared fields remain consistent.

### 5. Verify and release

- Verify an anonymous visitor and an authenticated non-editor cannot read private drafts, upload files, save changes or publish.
- Verify approved editors can complete login, save, refresh, replace images, publish and restore content.
- Test invalid/expired OTPs, expired sessions, invalid uploads, concurrent edits, repeated publish clicks and failed builds.
- Compare preview and published output on desktop and mobile, including the shared portrait’s mobile placement, font loading and layout stability.
- Check the public pages’ copy, links, search metadata and contact behaviour after publishing.
- Confirm staging writes and publishing cannot alter production data or deployments.
- Let Sam and Mike review the staging editor, then release the approved implementation to production.
- Provide a short client guide covering login, editing, publishing, restoration and who to contact for help.

**Exit condition:** Mike can make and safely publish a routine text or image update without developer assistance.

## First-release boundaries

The first release covers two existing pages, fixed sections, text, links, images, drafts, publishing and restoration. Additional pages, draggable sections, a blog, arbitrary HTML, multiple clients, complex approval workflows and scheduled publishing can be considered later if there is a demonstrated need.

This plan does not provision services, change credentials, modify the application or publish anything. Implementation begins with the integration proof on staging.
