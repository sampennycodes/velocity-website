import { z } from "zod";
import registry from "./fields.json" with { type: "json" };
export const groups = registry.groups;
export const fields = registry.fields;
export const fieldMap = Object.fromEntries(
  fields.map((field) => [field.key, field]),
);
export function safeLink(value, webOnly = false) {
  if (typeof value !== "string" || /[\s\\\u0000-\u001f\u007f]/.test(value))
    return false;
  if (!webOnly && (/^\/(?!\/)/.test(value) || /^#[a-zA-Z][\w-]*$/.test(value)))
    return true;
  try {
    const u = new URL(value);
    return (
      !u.username &&
      !u.password &&
      (u.protocol === "https:" ||
        (!webOnly && ["mailto:", "tel:"].includes(u.protocol)))
    );
  } catch {
    return false;
  }
}
const localImages = new Set(
  fields.filter((f) => f.type === "image").map((f) => f.initial.src),
);
// Saved revisions may still reference the previous default social card.
localImages.add('/ogimage.png');
localImages.add('/ogimage-v2.png');
const image = z
  .object({
    src: z.string().max(1500),
    assetId: z.string().uuid().nullable(),
    description: z.string().trim().min(1).max(500),
    width: z.number().int().positive().max(16000),
    height: z.number().int().positive().max(16000),
    x: z.number().min(0).max(100),
    y: z.number().min(0).max(100),
    // Optional so existing drafts and immutable history keep their original styling.
    rounding: z.number().int().min(0).max(50).optional(),
  })
  .strict()
  .refine(
    (value) =>
      value.assetId
        ? value.src === `/api/editor?action=image&id=${value.assetId}` ||
          /^https:\/\/[a-z0-9]+\.public\.blob\.vercel-storage\.com\//.test(
            value.src,
          )
        : localImages.has(value.src),
    "Choose a library image or upload a replacement.",
  );
const schemas = Object.fromEntries(
  fields.map((f) => {
    if (f.type === "boolean") return [f.key, z.boolean().default(f.initial)];
    let schema = z.string().trim().min(1, "This field is required.").max(f.max);
    if (f.type === "image") return [f.key, image];
    if (f.type === "link" || f.type === "webLink")
      schema = schema.refine(
        (v) => safeLink(v, f.type === "webLink"),
        "Use a secure URL, a site path, an anchor, mailto or tel link.",
      );
    if (f.type === "email") schema = schema.email();
    if (f.group === "shared.emails") {
      if (f.type !== "textarea")
        schema = schema.refine((v) => !/[\u0000-\u001f\u007f]/.test(v), "Use a single line without control characters.");
      if (f.key === "shared.emails.senderName")
        schema = schema.refine((v) => !/[<>"\\]/.test(v), "Use a plain sender name without quotes or angle brackets.");
      if (f.optional) schema = schema.or(z.string().trim().length(0));
      // Add only the new fields to old snapshots. Existing required slots stay strict.
      schema = schema.default(f.initial);
    }
    if (f.type === "phone")
      schema = schema.regex(
        /^\+?[0-9 ()-]{3,40}$/,
        "Use a phone number with digits, spaces, parentheses or hyphens.",
      );
    // Older revisions predate this editable label; retain their original copy.
    if (f.key === "shared.reviews.ratingLabel") schema = schema.default(f.initial);
    return [f.key, schema];
  }),
);
export const emailSettingsSchema = z.object(Object.fromEntries(
  fields.filter((f) => f.group === "shared.emails").map((f) => [f.key, schemas[f.key]]),
)).strict();
export function contactEmailSettings(content) {
  return emailSettingsSchema.parse(Object.fromEntries(
    fields.filter((f) => f.group === "shared.emails").map((f) => [f.key, content.values[f.key]]),
  ));
}
export const contactSettingsSchema = emailSettingsSchema.extend(Object.fromEntries(
  fields.filter((f) => f.group === "shared.form").map((f) => [f.key, schemas[f.key]]),
));
export function contactSettings(content) {
  return contactSettingsSchema.parse(Object.fromEntries(
    fields.filter((f) => ["shared.emails", "shared.form"].includes(f.group)).map((f) => [f.key, content.values[f.key]]),
  ));
}
export function referralSettings(values) {
  return {
    enabled: values["shared.form.referralEnabled"] ?? true,
    required: values["shared.form.referralRequired"] ?? false,
    otherRequired: values["shared.form.referralOtherRequired"] ?? true,
  };
}
export const contentSchema = z
  .object({ schemaVersion: z.literal(1), values: z.object(schemas).strict() })
  .strict();
export const initialContent = contentSchema.parse({
  schemaVersion: 1,
  values: Object.fromEntries(fields.map((f) => [f.key, f.initial])),
});
/**
 * @template {keyof import('./types').SiteContent['values']} K
 * @param {import('./types').SiteContent} content
 * @param {K} key
 * @returns {import('./types').SiteContent['values'][K]}
 */
export const value = (content, key) => content.values[key];
export function format(value, kind = "") {
  if (kind === "quote") return `“${value}”`;
  if (kind === "initials")
    return value
      .split(" ")
      .filter(Boolean)
      .map((part) => part[0])
      .join("");
  if (kind === "copyright") return `© ${new Date().getFullYear()} ${value}`;
  if (kind === "mailto") return `mailto:${value}`;
  if (kind === "tel") return `tel:${value.replace(/[ ()-]/g, "")}`;
  if (kind === "call-label") return `Call Mike on ${value}`;
  if (kind === "linkedin-label")
    return `Connect with ${value} on LinkedIn (opens in a new tab)`;
  return value;
}
