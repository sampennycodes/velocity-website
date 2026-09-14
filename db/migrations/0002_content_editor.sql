CREATE TABLE "velocity_editor"."content_publications" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"revision_id" uuid NOT NULL,
	"source_sha" text NOT NULL,
	"idempotency_key" uuid NOT NULL,
	"environment" text DEFAULT 'staging' NOT NULL,
	"status" text DEFAULT 'preparing' NOT NULL,
	"deployment_id" text,
	"deployment_url" text,
	"error" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "content_publications_idempotency_key_unique" UNIQUE("idempotency_key"),
	CONSTRAINT "content_staging_only" CHECK ("velocity_editor"."content_publications"."environment" = 'staging'),
	CONSTRAINT "content_publish_status" CHECK ("velocity_editor"."content_publications"."status" in ('preparing', 'building', 'ready', 'failed', 'unknown'))
);
--> statement-breakpoint
CREATE TABLE "velocity_editor"."content_revisions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"author" text NOT NULL,
	"schema_version" integer DEFAULT 1 NOT NULL,
	"snapshot" jsonb NOT NULL,
	"kind" text DEFAULT 'save' NOT NULL,
	"restored_from" uuid,
	"source_sha" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "content_revision_kind" CHECK ("velocity_editor"."content_revisions"."kind" in ('save', 'restore', 'publish'))
);
--> statement-breakpoint
CREATE TABLE "velocity_editor"."drafts" (
	"id" text PRIMARY KEY NOT NULL,
	"version" integer NOT NULL,
	"snapshot" jsonb NOT NULL,
	"revision_id" uuid NOT NULL,
	"updated_by" text NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "single_site_draft" CHECK ("velocity_editor"."drafts"."id" = 'site')
);
--> statement-breakpoint
CREATE TABLE "velocity_editor"."site_state" (
	"environment" text PRIMARY KEY NOT NULL,
	"revision_id" uuid NOT NULL,
	"publication_id" uuid NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "state_staging_only" CHECK ("velocity_editor"."site_state"."environment" = 'staging')
);
--> statement-breakpoint
ALTER TABLE "velocity_editor"."content_publications" ADD CONSTRAINT "content_publications_revision_id_content_revisions_id_fk" FOREIGN KEY ("revision_id") REFERENCES "velocity_editor"."content_revisions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "velocity_editor"."content_revisions" ADD CONSTRAINT "content_revisions_author_editors_email_fk" FOREIGN KEY ("author") REFERENCES "velocity_editor"."editors"("email") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "velocity_editor"."drafts" ADD CONSTRAINT "drafts_revision_id_content_revisions_id_fk" FOREIGN KEY ("revision_id") REFERENCES "velocity_editor"."content_revisions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "velocity_editor"."drafts" ADD CONSTRAINT "drafts_updated_by_editors_email_fk" FOREIGN KEY ("updated_by") REFERENCES "velocity_editor"."editors"("email") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "velocity_editor"."site_state" ADD CONSTRAINT "site_state_revision_id_content_revisions_id_fk" FOREIGN KEY ("revision_id") REFERENCES "velocity_editor"."content_revisions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "velocity_editor"."site_state" ADD CONSTRAINT "site_state_publication_id_content_publications_id_fk" FOREIGN KEY ("publication_id") REFERENCES "velocity_editor"."content_publications"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "one_active_content_publication" ON "velocity_editor"."content_publications" USING btree ("environment") WHERE "velocity_editor"."content_publications"."status" in ('preparing', 'building', 'unknown');
--> statement-breakpoint
CREATE TRIGGER content_revisions_immutable BEFORE UPDATE OR DELETE ON velocity_editor.content_revisions
FOR EACH ROW EXECUTE FUNCTION velocity_editor.prevent_revision_change();
