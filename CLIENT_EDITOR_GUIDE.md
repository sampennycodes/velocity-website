# Velocity website editor

Open the [staging editor](https://velocitymarketing-v2.vercel.app/admin) and sign in with your email code. Mike can sign in with `mike@velocitymarketing.com.au`; Sam uses `sam@sampenny.io`. Both can edit, upload images, save, restore history and update the staging website. Login codes are sent only when requested.

1. Choose **Home** or **Google Ads in Traralgon**.
2. Choose a section from the list, or select it in the page preview. On a phone, use the section selector and **Back to preview**.
3. Update the fields on the right. The preview updates as you type. **Shared content** changes both pages; navigation and footer changes also affect other routes that use those components.
4. For a portrait or social image, choose a JPEG, PNG or WebP up to 3 MB, add an image description, and wait for the image to appear. The image uploads privately. The portrait’s crop sliders choose which part of the image stays visible. Uploaded images remain private until publishing.
   **Corner rounding** adjusts the portrait from square corners to a circle at the far right. It applies to the shared portrait on both pages; crop controls position the image inside the circle.
5. Select **Save & update staging**. The button saves your changes and starts the staging build. The progress panel shows the current step, elapsed time and an estimate based on recent successful updates (currently around 20–45 seconds). Keep the tab open until it says **Saved**, then you can keep editing or return later while the saved version builds. Wait for **Staging is up to date**, then open the staging link to review. A slower build shows a delay message and keeps checking. Production is unaffected.
6. **History** lists saved versions. Choose **Restore to draft**, review the restored version, and save any further changes. Restoring keeps the intervening history.

Saving also updates staging; there is no separate publishing step. If a build fails, your saved changes remain available. Use **Retry staging update**. This editor cannot publish to production.

If another browser saves first, your edits remain on screen. Use **Download my edits** to keep a copy, then **Load latest saved draft** and reapply your changes. The editor will not overwrite the newer version silently.

If a session expires, sign in again without closing the page. Unsaved edits stay in memory while you sign in. If an email code expires, use **Send a new code**.

Choose **Shared → Contact emails** to change the sender name/email, the inbox receiving enquiries, where lead replies go, and the subjects and messages for both emails. **From email** can be any address on a domain verified in your Resend account (currently `velocitymarketing.com.au`). **Reply-to email (optional)** controls replies to lead confirmations: clear it to use the From address. Replies to enquiry notifications still go directly to the lead. Use `{firstName}` or `{name}` to personalise a message; the enquiry always includes the lead’s contact details and original message below your introduction. Switch between **Contact Form** and **Autoresponder** to see each email’s settings and styled preview. Sender name and From email apply to both emails. Switching tabs keeps your unsaved edits; previews do not send anything. Use **Desktop** and **Mobile** to check their layout.

Select **Save & update staging** to save the email settings with the website version. History and restore include these settings. The staging contact form does not send email; delivery starts with the approved production release. Changing **Public contact details** still only changes the address displayed on the website. Contact Sam for editor access or help with a failed publication.

Each email subject and message field has variable buttons: **First name** inserts `{firstName}` (for example, Alex), and **Full name** inserts `{name}` (Alex Smith). Click in your text, then choose a variable to insert it at the cursor or replace selected text. The preview shows the result using the example lead. These are the two available variables; the Contact Form email adds the lead’s email, phone and original message automatically.
