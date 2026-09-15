ALTER TABLE "velocity_editor"."content_publications" DROP CONSTRAINT "content_staging_only";--> statement-breakpoint
ALTER TABLE "velocity_editor"."site_state" DROP CONSTRAINT "state_staging_only";--> statement-breakpoint
ALTER TABLE "velocity_editor"."content_publications" ADD CONSTRAINT "content_environment" CHECK ("velocity_editor"."content_publications"."environment" in ('staging', 'production'));--> statement-breakpoint
ALTER TABLE "velocity_editor"."site_state" ADD CONSTRAINT "state_environment" CHECK ("velocity_editor"."site_state"."environment" in ('staging', 'production'));