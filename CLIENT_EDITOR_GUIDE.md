# Velocity website editor

Open the [staging editor](https://velocitymarketing-v2.vercel.app/admin) and sign in with your email code. Mike can sign in with `mike@velocitymarketing.com.au`; Sam uses `sam@sampenny.io`. Both can edit, upload images, save, restore history and update the staging website. Login codes are sent only when requested.

1. Choose **Home**, or choose a town under **Location Pages**. Traralgon is now in that group alongside the other 16 towns.
2. Choose a section from the list, or select it in the page preview. On a phone, use the section selector and **Back to preview**.
3. Update the fields on the right. The preview updates as you type. **Shared content** changes Home and all location pages; navigation and footer changes also affect other routes that use those components.
4. For a portrait or social image, choose a JPEG, PNG or WebP up to 3 MB, add an image description, and wait for the image to appear. The image uploads privately. The portrait’s crop sliders choose which part of the image stays visible. Uploaded images remain private until publishing.
   **Corner rounding** adjusts the portrait from square corners to a circle at the far right. It applies to the shared portrait on Home and all location pages; crop controls position the image inside the circle.
5. Select **Save & update staging**. The button saves your changes and starts the staging build. The progress panel shows the current step, elapsed time and an estimate based on recent successful updates (currently around 20–45 seconds). Keep the tab open until it says **Saved**, then you can keep editing or return later while the saved version builds. Wait for **Staging is up to date**, then open the staging link to review. A slower build shows a delay message and keeps checking. Production is unaffected.
6. **History** lists saved versions. Choose **Restore to draft**, review the restored version, and save any further changes. Restoring keeps the intervening history.

Saving also updates staging; there is no separate publishing step. If a build fails, your saved changes remain available. Use **Retry staging update**. This editor cannot publish to production.

If another browser saves first, your edits remain on screen. Use **Download my edits** to keep a copy, then **Load latest saved draft** and reapply your changes. The editor will not overwrite the newer version silently.

If a session expires, sign in again without closing the page. Unsaved edits stay in memory while you sign in. If an email code expires, use **Send a new code**.

Choose **Shared → Reviews → Rating label** to change “Perfect 5* Rating” above the reviews heading. The preview updates as you type, and the label applies to Home and all location pages after **Save & update staging**.

Choose **Shared → Contact form** to configure each field: Name, Email, Phone Number, How did you hear about us?, Other — please specify, and Message. **Required** controls whether the visitor must answer. **Show status label** controls whether the label displays `*` for required or `(optional)` for optional. Hiding this label does not change validation. The referral question also has **Show question** to hide the whole question and its Other details field. Changes appear immediately in the preview and apply to every contact form after **Save & update staging**.

The referral choices are Word of mouth, Google Search, Search Engine (Other), AI Assistant (ChatGPT, etc.), and Other (Please specify). Other reveals its details field and follows that field’s Required setting. If Email is optional and left blank, the enquiry reaches your team without an autoresponder. If Name is optional and left blank, `{firstName}` becomes “there” and `{name}` becomes “a website visitor”. Completely empty enquiries cannot be submitted.

Choose **Shared → Contact emails** to change the sender name/email, the inbox receiving enquiries, where lead replies go, and the subjects and messages for both emails. **From email** can be any address on a domain verified in your Resend account (currently `velocitymarketing.com.au`). **Reply-to email (optional)** controls replies to lead confirmations: clear it to use the From address. Replies to enquiry notifications still go directly to the lead. Use `{firstName}` or `{name}` to personalise a message; the enquiry always includes the lead’s contact details and original message below your introduction. Switch between **Contact Form** and **Autoresponder** to see each email’s settings and styled preview. Sender name and From email apply to both emails. Switching tabs keeps your unsaved edits; previews do not send anything. Use **Desktop** and **Mobile** to check their layout.

Select **Save & update staging** to save the email settings with the website version. History and restore include these settings. The staging contact form does not send email; delivery starts with the approved production release. Changing **Public contact details** still only changes the address displayed on the website. Contact Sam for editor access or help with a failed publication.

Each email subject and message field has variable buttons: **First name** inserts `{firstName}` (for example, Alex), and **Full name** inserts `{name}` (Alex Smith). Click in your text, then choose a variable to insert it at the cursor or replace selected text. The preview shows the result using the example lead. These are the two available variables; the Contact Form email adds the lead’s email, phone and original message automatically.

## Location pages and service areas

**Location Pages** contains 17 towns in alphabetical order. Each town has its own Hero, Specialties, About, Nearby areas, Contact, and Search & sharing fields. Editing Warragul’s copy or social image does not change Drouin or another town. The shared profile, reviews, contact form, email settings and navigation still apply across the website.

The location pages lead with Google Ads and also cover Meta and LinkedIn. Their standard headline is **Paid Ads Specialist {Location} – Google, Meta, & LinkedIn**. Public addresses use `/paid-ads-{town}`, for example `/paid-ads-neerim-south`. Both older Traralgon addresses forward to `/paid-ads-traralgon`.

Choose **Home → Areas we service** to edit the homepage heading. Town names link directly to their pages beneath five region headings; regions do not have separate landing pages. Moe, Morwell and Traralgon appear in both Central Gippsland and Latrobe Valley and always link to the same town page.

Choose a town’s **Nearby areas** section to edit its heading. The links automatically show the other listed towns in that town’s region, without duplicates or a link back to itself. Contact Sam to change the town catalogue or regional membership.

Use **Save & update staging** for location edits, just as for Home. History includes every location’s content. Restoring a version saved before location pages were introduced preserves its existing copy and supplies the new pages’ starting content for review.
