CREATE TYPE "public"."channel_automation" AS ENUM('auto', 'gated', 'manual');--> statement-breakpoint
CREATE TYPE "public"."channel_category" AS ENUM('social', 'launch_platform', 'directory', 'reddit', 'dev_content', 'community');--> statement-breakpoint
CREATE TYPE "public"."connection_status" AS ENUM('connected', 'needs_reauth', 'disconnected');--> statement-breakpoint
CREATE TYPE "public"."link_placement" AS ENUM('body', 'first_comment', 'none');--> statement-breakpoint
CREATE TYPE "public"."link_policy" AS ENUM('fine', 'penalized', 'first_comment', 'not_clickable');--> statement-breakpoint
CREATE TYPE "public"."plan_status" AS ENUM('pending', 'ready', 'failed');--> statement-breakpoint
CREATE TYPE "public"."priority" AS ENUM('must', 'should', 'optional');--> statement-breakpoint
CREATE TYPE "public"."project_status" AS ENUM('idea', 'building', 'launched', 'archived');--> statement-breakpoint
CREATE TYPE "public"."scheduled_status" AS ENUM('scheduled', 'processing', 'posted', 'failed', 'skipped', 'manual_pending', 'manual_done');--> statement-breakpoint
CREATE TYPE "public"."update_kind" AS ENUM('launch', 'feature', 'milestone', 'writeup');--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "channels" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"category" "channel_category" NOT NULL,
	"automation" "channel_automation" NOT NULL,
	"connector_key" text,
	"submit_url_template" text,
	"homepage_url" text,
	"char_limit" integer,
	"supports_images" boolean DEFAULT true NOT NULL,
	"requires_image" boolean DEFAULT false NOT NULL,
	"link_policy" "link_policy" DEFAULT 'fine' NOT NULL,
	"audience" text,
	"posting_rules" text,
	"best_time" text,
	"requires_tags" text[] DEFAULT ARRAY[]::text[] NOT NULL,
	"min_spacing_minutes" integer DEFAULT 60 NOT NULL,
	"enabled" boolean DEFAULT true NOT NULL,
	"sort_order" integer DEFAULT 100 NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "connections" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"connector_key" text NOT NULL,
	"display_name" text,
	"credentials_encrypted" text NOT NULL,
	"meta" jsonb,
	"status" "connection_status" DEFAULT 'connected' NOT NULL,
	"last_verified_at" timestamp with time zone,
	"last_error" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "connections_connector_key_unique" UNIQUE("connector_key")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"scheduled_post_id" uuid,
	"event" text NOT NULL,
	"detail" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "launch_plans" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"update_id" uuid NOT NULL,
	"provider" text NOT NULL,
	"model" text NOT NULL,
	"status" "plan_status" DEFAULT 'pending' NOT NULL,
	"strategy_memo" text,
	"positioning" jsonb,
	"open_source_rec" jsonb,
	"asset_checklist" text[] DEFAULT ARRAY[]::text[] NOT NULL,
	"raw_response" jsonb,
	"token_usage" jsonb,
	"error" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "post_drafts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"launch_plan_id" uuid NOT NULL,
	"channel_id" text NOT NULL,
	"priority" "priority" DEFAULT 'should' NOT NULL,
	"title" text,
	"body" text NOT NULL,
	"link_url" text,
	"link_placement" "link_placement" DEFAULT 'body' NOT NULL,
	"image_prompt" text,
	"rationale" text,
	"suggested_offset_hours" integer DEFAULT 0 NOT NULL,
	"approved" boolean DEFAULT false NOT NULL,
	"edited_by_user" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "projects" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"slug" text NOT NULL,
	"tagline" text,
	"description" text,
	"url" text,
	"repo_url" text,
	"status" "project_status" DEFAULT 'building' NOT NULL,
	"tags" text[] DEFAULT ARRAY[]::text[] NOT NULL,
	"is_open_source" boolean DEFAULT false NOT NULL,
	"tech_stack" text[] DEFAULT ARRAY[]::text[] NOT NULL,
	"target_audience" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "projects_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "scheduled_posts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"post_draft_id" uuid NOT NULL,
	"channel_id" text NOT NULL,
	"scheduled_for" timestamp with time zone NOT NULL,
	"status" "scheduled_status" DEFAULT 'scheduled' NOT NULL,
	"attempts" integer DEFAULT 0 NOT NULL,
	"last_error" text,
	"external_id" text,
	"external_url" text,
	"posted_at" timestamp with time zone,
	"idempotency_key" text NOT NULL,
	"locked_at" timestamp with time zone,
	"locked_by" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "settings" (
	"id" integer PRIMARY KEY DEFAULT 1 NOT NULL,
	"llm_provider" text DEFAULT 'anthropic' NOT NULL,
	"llm_model" text DEFAULT 'claude-sonnet-5' NOT NULL,
	"llm_keys_encrypted" text,
	"timezone" text DEFAULT 'America/New_York' NOT NULL,
	"dry_run" boolean DEFAULT true NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "updates" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" uuid NOT NULL,
	"kind" "update_kind" DEFAULT 'feature' NOT NULL,
	"title" text NOT NULL,
	"body" text NOT NULL,
	"version" text,
	"media_urls" text[] DEFAULT ARRAY[]::text[] NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "events" ADD CONSTRAINT "events_scheduled_post_id_scheduled_posts_id_fk" FOREIGN KEY ("scheduled_post_id") REFERENCES "public"."scheduled_posts"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "launch_plans" ADD CONSTRAINT "launch_plans_update_id_updates_id_fk" FOREIGN KEY ("update_id") REFERENCES "public"."updates"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "post_drafts" ADD CONSTRAINT "post_drafts_launch_plan_id_launch_plans_id_fk" FOREIGN KEY ("launch_plan_id") REFERENCES "public"."launch_plans"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "post_drafts" ADD CONSTRAINT "post_drafts_channel_id_channels_id_fk" FOREIGN KEY ("channel_id") REFERENCES "public"."channels"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "scheduled_posts" ADD CONSTRAINT "scheduled_posts_post_draft_id_post_drafts_id_fk" FOREIGN KEY ("post_draft_id") REFERENCES "public"."post_drafts"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "scheduled_posts" ADD CONSTRAINT "scheduled_posts_channel_id_channels_id_fk" FOREIGN KEY ("channel_id") REFERENCES "public"."channels"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "updates" ADD CONSTRAINT "updates_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "events_scheduled_idx" ON "events" USING btree ("scheduled_post_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "launch_plans_update_idx" ON "launch_plans" USING btree ("update_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "post_drafts_plan_idx" ON "post_drafts" USING btree ("launch_plan_id");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "scheduled_posts_idempotency_idx" ON "scheduled_posts" USING btree ("idempotency_key");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "scheduled_posts_due_idx" ON "scheduled_posts" USING btree ("status","scheduled_for");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "updates_project_idx" ON "updates" USING btree ("project_id");