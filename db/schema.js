import { pgSchema, text, boolean, timestamp, integer, jsonb, uuid, uniqueIndex, check } from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
const editor = pgSchema('velocity_editor');
const time = name => timestamp(name, { withTimezone: true }).notNull().defaultNow();
export const editors = editor.table('editors', {
  email: text('email').primaryKey(), userId: text('user_id').unique(), role: text('role').notNull(),
  enabled: boolean('enabled').notNull().default(false), createdAt: time('created_at'),
}, table => [check('valid_role', sql`${table.role} in ('owner', 'editor')`)]);
export const revisions = editor.table('integration_revisions', {
  id: uuid('id').primaryKey().defaultRandom(), author: text('author').notNull().references(() => editors.email),
  sourceSha: text('source_sha').notNull(), snapshot: jsonb('snapshot').notNull(), createdAt: time('created_at'),
});
export const media = editor.table('media', {
  id: uuid('id').primaryKey().defaultRandom(), author: text('author').notNull().references(() => editors.email),
  privateUrl: text('private_url').notNull(), pathname: text('pathname').notNull(),
  filename: text('filename').notNull(), contentType: text('content_type').notNull(),
  width: integer('width').notNull(), height: integer('height').notNull(), bytes: integer('bytes').notNull(),
  description: text('description').notNull(), createdAt: time('created_at'),
});
export const publications = editor.table('integration_publications', {
  id: uuid('id').primaryKey().defaultRandom(), revisionId: uuid('revision_id').notNull().references(() => revisions.id),
  idempotencyKey: uuid('idempotency_key').notNull().unique(), environment: text('environment').notNull().default('staging'),
  status: text('status').notNull().default('preparing'), deploymentId: text('deployment_id'), deploymentUrl: text('deployment_url'),
  error: text('error'), createdAt: time('created_at'), updatedAt: time('updated_at'),
}, table => [
  check('staging_only', sql`${table.environment} = 'staging'`),
  check('valid_status', sql`${table.status} in ('preparing', 'building', 'ready', 'failed', 'unknown')`),
  uniqueIndex('one_active_publication').on(table.environment).where(sql`${table.status} in ('preparing', 'building', 'unknown')`),
]);
export const rateLimits = editor.table('rate_limits', {
  key: text('key').primaryKey(), count: integer('count').notNull(), resetAt: timestamp('reset_at', { withTimezone: true }).notNull(),
});

export const contentRevisions = editor.table('content_revisions', {
  id: uuid('id').primaryKey().defaultRandom(), author: text('author').notNull().references(() => editors.email),
  schemaVersion: integer('schema_version').notNull().default(1), snapshot: jsonb('snapshot').notNull(),
  kind: text('kind').notNull().default('save'), restoredFrom: uuid('restored_from'), sourceSha: text('source_sha'), createdAt: time('created_at'),
}, table => [check('content_revision_kind', sql`${table.kind} in ('save', 'restore', 'publish')`)]);
export const drafts = editor.table('drafts', {
  id: text('id').primaryKey(), version: integer('version').notNull(), snapshot: jsonb('snapshot').notNull(),
  revisionId: uuid('revision_id').notNull().references(() => contentRevisions.id),
  updatedBy: text('updated_by').notNull().references(() => editors.email), updatedAt: time('updated_at'),
}, table => [check('single_site_draft', sql`${table.id} = 'site'`)]);
export const contentPublications = editor.table('content_publications', {
  id: uuid('id').primaryKey().defaultRandom(), revisionId: uuid('revision_id').notNull().references(() => contentRevisions.id),
  sourceSha: text('source_sha').notNull(), idempotencyKey: uuid('idempotency_key').notNull().unique(),
  environment: text('environment').notNull().default('staging'), status: text('status').notNull().default('preparing'),
  deploymentId: text('deployment_id'), deploymentUrl: text('deployment_url'), error: text('error'),
  createdAt: time('created_at'), updatedAt: time('updated_at'),
}, table => [check('content_staging_only', sql`${table.environment} = 'staging'`), check('content_publish_status', sql`${table.status} in ('preparing', 'building', 'ready', 'failed', 'unknown')`), uniqueIndex('one_active_content_publication').on(table.environment).where(sql`${table.status} in ('preparing', 'building', 'unknown')`)]);
export const siteState = editor.table('site_state', {
  environment: text('environment').primaryKey(), revisionId: uuid('revision_id').notNull().references(() => contentRevisions.id),
  publicationId: uuid('publication_id').notNull().references(() => contentPublications.id), updatedAt: time('updated_at'),
}, table => [check('state_staging_only', sql`${table.environment} = 'staging'`)]);
