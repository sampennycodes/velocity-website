import test from "node:test";
import assert from "node:assert/strict";
import {
  initialContent,
  contentSchema,
  fields,
  safeLink,
  format,
} from "../lib/content/model.js";
import { checkVersion, validateAssets, draftResult } from "../lib/editor/content.js";
import {
  contentDeploymentPayload,
  checkContentDeployment,
} from "../lib/editor/content-publish.js";
import { handleEditor } from "../lib/editor/handler.js";
import { DEFAULT_SOCIAL_IMAGE, imageSource } from '../lib/site.js';
test('refreshed social cards support saved drafts and retain custom uploaded images', () => {
  const oldDraft = structuredClone(initialContent);
  for (const key of ['home.seo.image', 'ads.seo.image']) {
    oldDraft.values[key].src = '/ogimage.png';
    assert.equal(imageSource(contentSchema.parse(oldDraft).values[key].src), DEFAULT_SOCIAL_IMAGE);
  }
  const custom = 'https://example.public.blob.vercel-storage.com/staging-published/card.webp';
  assert.equal(imageSource(custom), custom);
  assert.match(imageSource('/img_8071.png'), /^\/optimized\/img_8071-800-.*\.webp$/);
});
test("content schema preserves fixed slots and rejects unsafe links and injected image sources", () => {
  assert.equal(fields.length, 88);
  assert.equal(contentSchema.parse(initialContent).schemaVersion, 1);
  // Old revisions omit rounding; new saves preserve only bounded percentages.
  assert.equal(contentSchema.parse(initialContent).values["shared.profile.image"].rounding, undefined);
  for (const rounding of [0, 25, 50]) {
    const rounded = structuredClone(initialContent);
    rounded.values["shared.profile.image"].rounding = rounding;
    assert.equal(contentSchema.parse(rounded).values["shared.profile.image"].rounding, rounding);
  }
  for (const rounding of [-1, 51, "50", 2.5]) {
    const rounded = structuredClone(initialContent);
    rounded.values["shared.profile.image"].rounding = rounding;
    assert.equal(contentSchema.safeParse(rounded).success, false);
  }
  for (const link of [
    "javascript:alert(1)",
    "data:text/html,bad",
    "//evil.test",
    "/\\evil.test",
    "https://example.com\n",
    "https://name:password@example.com",
  ])
    assert.equal(safeLink(link), false);
  for (const link of [
    "/google-ads-traralgon",
    "#contact",
    "https://example.com/path",
    "mailto:sam@example.com",
    "tel:0427733566",
  ])
    assert.equal(safeLink(link), true);
  const extra = structuredClone(initialContent);
  extra.values["arbitrary.html"] = "<script>bad</script>";
  assert.equal(contentSchema.safeParse(extra).success, false);
  const missing = structuredClone(initialContent);
  delete missing.values["shared.reviews.2.quote"];
  assert.equal(contentSchema.safeParse(missing).success, false);
  const image = structuredClone(initialContent);
  image.values["shared.profile.image"].src = "https://evil.test/image";
  assert.equal(contentSchema.safeParse(image).success, false);
  image.values["shared.profile.image"] = {
    ...initialContent.values["shared.profile.image"],
    x: 101,
  };
  assert.equal(contentSchema.safeParse(image).success, false);
});
test("media references are resolved from storage metadata instead of trusting submitted URLs or dimensions", async () => {
  const snapshot = structuredClone(initialContent),
    id = "00000000-0000-4000-8000-000000000009";
  snapshot.values["shared.profile.image"] = {
    ...snapshot.values["shared.profile.image"],
    assetId: id,
    src: "https://other.public.blob.vercel-storage.com/fake.webp",
    width: 1,
    height: 1,
  };
  const result = await validateAssets(snapshot, {
    query: async (_sql, args) => {
      assert.equal(args[0], id);
      return { rows: [{ width: 900, height: 1200 }] };
    },
  });
  assert.equal(
    result.values["shared.profile.image"].src,
    `/api/editor?action=image&id=${id}`,
  );
  assert.equal(result.values["shared.profile.image"].width, 900);
  assert.equal(
    snapshot.values["shared.profile.image"].width,
    1,
    "caller content is not mutated",
  );
  await assert.rejects(
    validateAssets(snapshot, { query: async () => ({ rows: [] }) }),
    { status: 400 },
  );
});
test("conflicts reject stale drafts and preview formatting matches published text", () => {
  checkVersion(3, 3);
  assert.throws(() => checkVersion(4, 3), { status: 409 });
  assert.equal(format("Sam Penny", "initials"), "SP");
  assert.equal(format("Hello", "quote"), "“Hello”");
  assert.equal(format("0427 733 566", "tel"), "tel:0427733566");
});
test("anonymous clients cannot read drafts/history, save or restore", async () => {
  const env = {
    EDITOR_ENABLED: "true",
    EDITOR_ENVIRONMENT: "staging",
    EDITOR_ORIGINS: "https://staging.example.com",
    NEON_AUTH_BASE_URL: "https://example.neon.tech/auth",
    DATABASE_URL: "postgresql://example/db",
  };
  for (const action of ["draft", "history", "save", "restore"]) {
    const res = await handleEditor(
      new Request(`https://staging.example.com/api/editor?action=${action}`, {
        method: ["save", "restore"].includes(action) ? "POST" : "GET",
        headers: { origin: "https://staging.example.com" },
      }),
      env,
    );
    assert.equal(res.status, 401);
  }
});
test("content publishing pins an immutable revision and source; mismatched and production deployments cannot become ready", () => {
  const config = {
      project: "prj_test",
      team: "team_test",
      sha: "a".repeat(40),
    },
    job = {
      id: "00000000-0000-4000-8000-000000000001",
      revision_id: "00000000-0000-4000-8000-000000000002",
      source_sha: "a".repeat(40),
    };
  const payload = contentDeploymentPayload(config, job.revision_id, job.id);
  assert.equal(payload.target, undefined);
  assert.equal(payload.gitSource.sha, config.sha);
  assert.equal(payload.projectSettings, undefined, 'Publishing must not change the shared project build command');
  assert.equal(payload.meta.velocityContentRevision, job.revision_id);
  const valid = {
    projectId: config.project,
    ownerId: config.team,
    target: null,
    gitSource: { sha: config.sha },
    meta: payload.meta,
  };
  checkContentDeployment(valid, job, config);
  for (const patch of [
    { target: "production" },
    { ownerId: "team_other" },
    { gitSource: { sha: "b".repeat(40) } },
    { meta: { ...payload.meta, velocityContentRevision: "other" } },
  ])
    assert.throws(
      () => checkContentDeployment({ ...valid, ...patch }, job, config),
      { status: 502 },
    );
});

test('older drafts and history gain email defaults without changing existing content or stored snapshots', () => {
  const old = structuredClone(initialContent);
  for (const field of fields.filter(f => f.group === 'shared.emails')) delete old.values[field.key];
  old.values['home.hero.heading'] = 'Saved custom heading';
  const upgraded = contentSchema.parse(old);
  assert.equal(upgraded.values['home.hero.heading'], 'Saved custom heading');
  assert.equal(upgraded.values['shared.emails.senderEmail'], 'website@velocitymarketing.com.au');
  assert.equal(upgraded.values['shared.emails.confirmationMessage'], initialContent.values['shared.emails.confirmationMessage']);
  assert.equal(old.values['shared.emails.senderEmail'], undefined);
  assert.deepEqual(draftResult({ snapshot: old, version: 7 }).content, upgraded);
});

test('email configuration rejects bad addresses, unverified sender domains and injected headers', () => {
  for (const [key, value] of [
    ['recipientEmail', 'not-an-email'],
    ['replyToEmail', 'a@example.com,b@example.com'],
    ['senderEmail', 'sender@unverified.example'],
    ['senderEmail', 'sender@evilvelocitymarketing.com.au'],
    ['senderName', 'Velocity <sender@evil.example>'],
    ['senderName', 'Velocity\\Name'],
    ['notificationSubject', 'Hi\nBcc: attacker@example.com'],
    ['confirmationSubject', 'Hi\rBcc: attacker@example.com'],
    ['confirmationMessage', ''],
  ]) {
    const content = structuredClone(initialContent);
    content.values['shared.emails.' + key] = value;
    assert.equal(contentSchema.safeParse(content).success, false, key + ': ' + value);
  }
});
