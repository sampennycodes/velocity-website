CREATE SCHEMA "velocity_editor";
--> statement-breakpoint
CREATE TABLE "velocity_editor"."editors" (
	"email" text PRIMARY KEY NOT NULL,
	"user_id" text,
	"role" text NOT NULL,
	"enabled" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "editors_user_id_unique" UNIQUE("user_id"),
	CONSTRAINT "valid_role" CHECK ("velocity_editor"."editors"."role" in ('owner', 'editor'))
);
--> statement-breakpoint
CREATE TABLE "velocity_editor"."media" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"author" text NOT NULL,
	"private_url" text NOT NULL,
	"pathname" text NOT NULL,
	"filename" text NOT NULL,
	"content_type" text NOT NULL,
	"width" integer NOT NULL,
	"height" integer NOT NULL,
	"bytes" integer NOT NULL,
	"description" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "velocity_editor"."integration_publications" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"revision_id" uuid NOT NULL,
	"idempotency_key" uuid NOT NULL,
	"environment" text DEFAULT 'staging' NOT NULL,
	"status" text DEFAULT 'preparing' NOT NULL,
	"deployment_id" text,
	"deployment_url" text,
	"error" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "integration_publications_idempotency_key_unique" UNIQUE("idempotency_key"),
	CONSTRAINT "staging_only" CHECK ("velocity_editor"."integration_publications"."environment" = 'staging'),
	CONSTRAINT "valid_status" CHECK ("velocity_editor"."integration_publications"."status" in ('preparing', 'building', 'ready', 'failed', 'unknown'))
);
--> statement-breakpoint
CREATE TABLE "velocity_editor"."rate_limits" (
	"key" text PRIMARY KEY NOT NULL,
	"count" integer NOT NULL,
	"reset_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "velocity_editor"."integration_revisions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"author" text NOT NULL,
	"source_sha" text NOT NULL,
	"snapshot" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "velocity_editor"."media" ADD CONSTRAINT "media_author_editors_email_fk" FOREIGN KEY ("author") REFERENCES "velocity_editor"."editors"("email") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "velocity_editor"."integration_publications" ADD CONSTRAINT "integration_publications_revision_id_integration_revisions_id_fk" FOREIGN KEY ("revision_id") REFERENCES "velocity_editor"."integration_revisions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "velocity_editor"."integration_revisions" ADD CONSTRAINT "integration_revisions_author_editors_email_fk" FOREIGN KEY ("author") REFERENCES "velocity_editor"."editors"("email") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "one_active_publication" ON "velocity_editor"."integration_publications" USING btree ("environment") WHERE "velocity_editor"."integration_publications"."status" in ('preparing', 'building', 'unknown');