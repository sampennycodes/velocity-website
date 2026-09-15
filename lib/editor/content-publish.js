import { randomUUID } from "node:crypto";
import { get, put } from "@vercel/blob";
import { getPool } from "./db.js";
import { publishConfig } from "./config.js";
import { contentSchema, fields } from "../content/model.js";
import { checkVersion } from "./content.js";
import { insist } from "./errors.js";
import { STAGING_ORIGIN } from "../site.js";
export function contentDeploymentPayload(config, revisionId, jobId) {
  insist(
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(
      revisionId,
    ),
    400,
    "Invalid revision.",
  );
  return {
    name: "velocity-website",
    project: config.project,
    gitSource: {
      type: "github",
      org: "sampennycodes",
      repo: "velocity-website",
      ref: "codex/visual-refresh",
      sha: config.sha,
    },
    // Build reads this deployment's immutable metadata. Never change the
    // project's shared build command to select a content revision.
    meta: {
      velocityContentRevision: revisionId,
      velocityContentJob: jobId,
      velocitySourceSha: config.sha,
      velocityEnvironment: "staging",
    },
  };
}
async function vercel(path, config, body) {
  return fetch(
    `https://api.vercel.com${path}${path.includes("?") ? "&" : "?"}teamId=${config.team}`,
    {
      method: body ? "POST" : "GET",
      headers: {
        Authorization: `Bearer ${config.token}`,
        ...(body ? { "Content-Type": "application/json" } : {}),
      },
      body: body ? JSON.stringify(body) : undefined,
      cache: "no-store",
      redirect: "error",
      signal: AbortSignal.timeout(20000),
    },
  );
}
export function checkContentDeployment(deployment, job, config) {
  insist(
    deployment.projectId === config.project &&
      deployment.ownerId === config.team &&
      deployment.target == null,
    502,
    "The deployment does not match this staging site. Contact Sam.",
  );
  insist(
    deployment.meta?.velocityContentRevision === job.revision_id &&
      deployment.meta?.velocityContentJob === job.id &&
      deployment.meta?.velocitySourceSha === job.source_sha &&
      deployment.meta?.velocityEnvironment === "staging",
    502,
    "The deployment does not match the saved revision. Contact Sam.",
  );
  insist(
    deployment.gitSource?.sha === job.source_sha ||
      deployment.meta?.githubCommitSha === job.source_sha,
    502,
    "The deployed source could not be verified.",
  );
}
const result = (row) => ({
  id: row.id,
  revisionId: row.revision_id,
  status: row.status,
  url: row.deployment_url,
  error: row.error,
  createdAt: row.created_at,
  updatedAt: row.updated_at,
});
export async function promoteImages(snapshot, env, db) {
  const content = contentSchema.parse(structuredClone(snapshot));
  const promoted = new Map();
  for (const field of fields.filter((f) => f.type === "image")) {
    const image = content.values[field.key];
    if (!image.assetId) continue;
    if (!promoted.has(image.assetId)) {
      insist(
        env.EDITOR_BLOB_PUBLIC_TOKEN,
        503,
        "Image publishing is not configured. Contact Sam.",
      );
      const { rows } = await db.query(
        "SELECT private_url, width, height FROM velocity_editor.media WHERE id=$1",
        [image.assetId],
      );
      insist(
        rows[0],
        400,
        "An image is unavailable. Replace it before publishing.",
      );
      const blob = await get(rows[0].private_url, {
        access: "private",
        token: env.EDITOR_BLOB_PRIVATE_TOKEN,
      });
      insist(
        blob?.statusCode === 200 && blob.stream,
        503,
        "An image could not be prepared for publishing. Retry later.",
      );
      const publicImage = await put(
        `staging-published/${image.assetId}.webp`,
        blob.stream,
        {
          access: "public",
          token: env.EDITOR_BLOB_PUBLIC_TOKEN,
          contentType: "image/webp",
          addRandomSuffix: true,
        },
      );
      promoted.set(image.assetId, {
        src: publicImage.url,
        width: rows[0].width,
        height: rows[0].height,
      });
    }
    Object.assign(image, promoted.get(image.assetId));
  }
  return contentSchema.parse(content);
}
export async function startContentPublication(key, version, editor, env) {
  const config = publishConfig(env),
    pool = getPool(env);
  const projectResponse = await vercel(
    `/v9/projects/${config.project}`,
    config,
  );
  insist(
    projectResponse.ok,
    503,
    "Publishing cannot access the staging site. Contact Sam.",
  );
  const project = await projectResponse.json();
  insist(
    project.id === config.project &&
      project.accountId === config.team &&
      project.name === "velocity-website" &&
      project.link?.org === "sampennycodes" &&
      project.link?.repo === "velocity-website",
    503,
    "Publishing is not connected to the correct site.",
  );
  const client = await pool.connect();
  let job, snapshot;
  try {
    await client.query("BEGIN");
    await client.query(
      "SELECT pg_advisory_xact_lock(hashtext('velocity-content-publish'))",
    );
    const duplicate = await client.query(
      "SELECT * FROM velocity_editor.content_publications WHERE idempotency_key=$1",
      [key],
    );
    if (duplicate.rows[0]) {
      await client.query("COMMIT");
      return result(duplicate.rows[0]);
    }
    const active = await client.query(
      "SELECT id FROM velocity_editor.content_publications WHERE status IN ('preparing','building','unknown')",
    );
    insist(
      !active.rowCount,
      409,
      "Another publication is in progress. Check its status before retrying.",
    );
    const draft = await client.query(
      "SELECT * FROM velocity_editor.drafts WHERE id='site' FOR UPDATE",
    );
    insist(draft.rows[0], 409, "Save your draft before publishing.");
    checkVersion(draft.rows[0].version, version);
    snapshot = draft.rows[0].snapshot;
    const inserted = await client.query(
      "INSERT INTO velocity_editor.content_publications (id,revision_id,source_sha,idempotency_key) VALUES ($1,$2,$3,$4) RETURNING *",
      [randomUUID(), draft.rows[0].revision_id, config.sha, key],
    );
    job = inserted.rows[0];
    await client.query("COMMIT");
  } catch (e) {
    await client.query("ROLLBACK");
    throw e;
  } finally {
    client.release();
  }
  try {
    const promoted = await promoteImages(snapshot, env, pool),
      revisionId = randomUUID();
    await pool.query(
      "INSERT INTO velocity_editor.content_revisions (id,author,snapshot,kind,source_sha) VALUES ($1,$2,$3,'publish',$4)",
      [revisionId, editor.email, promoted, config.sha],
    );
    await pool.query(
      "UPDATE velocity_editor.content_publications SET revision_id=$2,updated_at=now() WHERE id=$1",
      [job.id, revisionId],
    );
    job.revision_id = revisionId;
  } catch {
    await pool.query(
      "UPDATE velocity_editor.content_publications SET status='failed',error=$2,updated_at=now() WHERE id=$1",
      [
        job.id,
        "Images could not be prepared. Your draft is safe; contact Sam or try again.",
      ],
    );
    return {
      ...result(job),
      status: "failed",
      error: "Images could not be prepared. Your draft is safe.",
    };
  }
  let response;
  try {
    response = await vercel(
      "/v13/deployments",
      config,
      contentDeploymentPayload(config, job.revision_id, job.id),
    );
  } catch {
    await pool.query(
      "UPDATE velocity_editor.content_publications SET status='unknown',updated_at=now() WHERE id=$1",
      [job.id],
    );
    return { ...result(job), status: "unknown" };
  }
  if (!response.ok) {
    const status = response.status >= 500 ? "unknown" : "failed",
      error =
        status === "unknown"
          ? "Waiting for Vercel to confirm publishing."
          : "Vercel rejected this build. Your draft is safe. Contact Sam before retrying.";
    await pool.query(
      "UPDATE velocity_editor.content_publications SET status=$2,error=$3,updated_at=now() WHERE id=$1",
      [job.id, status, error],
    );
    return { ...result(job), status, error };
  }
  let deployment;
  try {
    deployment = await response.json();
  } catch {
    deployment = {};
  }
  const valid = /^dpl_[a-zA-Z0-9]+$/.test(deployment.id || "");
  await pool.query(
    "UPDATE velocity_editor.content_publications SET status=$2,deployment_id=$3,updated_at=now() WHERE id=$1",
    [job.id, valid ? "building" : "unknown", valid ? deployment.id : null],
  );
  return { ...result(job), status: valid ? "building" : "unknown" };
}
export async function contentPublicationStatus(id, env) {
  const config = publishConfig(env),
    pool = getPool(env);
  const { rows } = await pool.query(
    "SELECT * FROM velocity_editor.content_publications WHERE id=$1",
    [id],
  );
  const job = rows[0];
  insist(job, 404, "Publication not found.");
  if (["ready", "failed"].includes(job.status)) return result(job);
  if (!job.deployment_id) {
    const response = await vercel(
      `/v6/deployments?projectId=${config.project}&limit=100&since=${new Date(job.created_at).getTime() - 60000}`,
      config,
    );
    insist(response.ok, 503, "Publishing status is temporarily unavailable.");
    const data = await response.json();
    const matches = (data.deployments || []).filter(
      (d) => d.meta?.velocityContentJob === job.id,
    );
    insist(
      matches.length <= 1,
      502,
      "Multiple deployments match this publication. Contact Sam.",
    );
    if (!matches[0])
      return {
        ...result(job),
        error:
          "Waiting for deployment confirmation. Contact Sam if this persists; do not start another build.",
      };
    job.deployment_id = matches[0].uid;
    insist(
      /^dpl_[a-zA-Z0-9]+$/.test(job.deployment_id || ""),
      502,
      "Invalid deployment identifier.",
    );
    await pool.query(
      "UPDATE velocity_editor.content_publications SET deployment_id=$2 WHERE id=$1",
      [id, job.deployment_id],
    );
  }
  const response = await vercel(
    `/v13/deployments/${job.deployment_id}`,
    config,
  );
  insist(response.ok, 503, "Publishing status is temporarily unavailable.");
  const deployment = await response.json();
  checkContentDeployment(deployment, job, config);
  const stagingOrigin = STAGING_ORIGIN;
  if (deployment.readyState === 'READY') {
    // READY alone is insufficient: the link Mike uses must serve this revision.
    const visible = await fetch(`${stagingOrigin}/?editor-revision=${job.revision_id}`, {
      cache: 'no-store', redirect: 'error', signal: AbortSignal.timeout(15000),
    });
    const html = visible.ok ? await visible.text() : '';
    const tag = html.match(/<meta\b[^>]*name=["']velocity-content-revision["'][^>]*>/)?.[0];
    if (!tag?.includes(job.revision_id))
      return { ...result(job), status: 'building', phase: 'checking', error: 'Build ready. Waiting for the staging link to serve the saved changes.' };
  }
  const status =
    deployment.readyState === "READY"
      ? "ready"
      : ["ERROR", "CANCELED"].includes(deployment.readyState)
        ? "failed"
        : "building";
  const url = status === 'ready' ? stagingOrigin : null;
  const error =
    status === "failed"
      ? "The build failed. Your draft and the last successful publication are safe."
      : null;
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const changed = await client.query(
      "UPDATE velocity_editor.content_publications SET status=$2,deployment_url=$3,error=$4,updated_at=now() WHERE id=$1 AND status IN ('preparing','building','unknown') RETURNING *",
      [id, status, url, error],
    );
    if (!changed.rowCount) {
      const current = await client.query(
        "SELECT * FROM velocity_editor.content_publications WHERE id=$1",
        [id],
      );
      await client.query("COMMIT");
      return result(current.rows[0]);
    }
    if (status === "ready")
      await client.query(
        "INSERT INTO velocity_editor.site_state (environment,revision_id,publication_id) VALUES ('staging',$1,$2) ON CONFLICT(environment) DO UPDATE SET revision_id=$1,publication_id=$2,updated_at=now() WHERE (SELECT created_at FROM velocity_editor.content_publications WHERE id=velocity_editor.site_state.publication_id) <= $3",
        [job.revision_id, id, job.created_at],
      );
    await client.query("COMMIT");
    job.updated_at = changed.rows[0].updated_at;
  } catch (e) {
    await client.query("ROLLBACK");
    throw e;
  } finally {
    client.release();
  }
  return { ...result(job), status, url, error, phase: ['QUEUED', 'INITIALIZING'].includes(deployment.readyState) ? 'queued' : 'building' };
}
