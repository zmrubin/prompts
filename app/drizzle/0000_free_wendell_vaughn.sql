CREATE TABLE `channels` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`category` text NOT NULL,
	`submit_url_template` text,
	`homepage_url` text,
	`char_limit` integer,
	`title_char_limit` integer,
	`requires_image` integer DEFAULT false NOT NULL,
	`link_policy` text DEFAULT 'fine' NOT NULL,
	`audience` text,
	`posting_rules` text,
	`best_time` text,
	`requires_tags` text DEFAULT '[]' NOT NULL,
	`metrics_source` text,
	`enabled` integer DEFAULT true NOT NULL,
	`sort_order` integer DEFAULT 100 NOT NULL
);
--> statement-breakpoint
CREATE TABLE `metrics` (
	`id` text PRIMARY KEY NOT NULL,
	`post_id` text NOT NULL,
	`score` integer,
	`comments` integer,
	`views` integer,
	`source` text DEFAULT 'manual' NOT NULL,
	`captured_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`post_id`) REFERENCES `posts`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `metrics_post_idx` ON `metrics` (`post_id`);--> statement-breakpoint
CREATE TABLE `plans` (
	`id` text PRIMARY KEY NOT NULL,
	`update_id` text NOT NULL,
	`source` text DEFAULT 'api' NOT NULL,
	`model` text,
	`strategy_memo` text,
	`positioning` text,
	`open_source_rec` text,
	`asset_checklist` text DEFAULT '[]' NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`update_id`) REFERENCES `updates`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `plans_update_idx` ON `plans` (`update_id`);--> statement-breakpoint
CREATE TABLE `posts` (
	`id` text PRIMARY KEY NOT NULL,
	`plan_id` text NOT NULL,
	`channel_id` text NOT NULL,
	`priority` text DEFAULT 'should' NOT NULL,
	`title` text,
	`body` text NOT NULL,
	`link_url` text,
	`link_placement` text DEFAULT 'body' NOT NULL,
	`image_prompt` text,
	`rationale` text,
	`day_offset` integer DEFAULT 0 NOT NULL,
	`status` text DEFAULT 'todo' NOT NULL,
	`posted_at` integer,
	`posted_url` text,
	`notes` text,
	`edited` integer DEFAULT false NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`plan_id`) REFERENCES `plans`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`channel_id`) REFERENCES `channels`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `posts_plan_idx` ON `posts` (`plan_id`);--> statement-breakpoint
CREATE INDEX `posts_status_idx` ON `posts` (`status`);--> statement-breakpoint
CREATE UNIQUE INDEX `posts_plan_channel_idx` ON `posts` (`plan_id`,`channel_id`);--> statement-breakpoint
CREATE TABLE `projects` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`slug` text NOT NULL,
	`tagline` text,
	`description` text,
	`url` text,
	`repo_url` text,
	`status` text DEFAULT 'building' NOT NULL,
	`tags` text DEFAULT '[]' NOT NULL,
	`tech_stack` text DEFAULT '[]' NOT NULL,
	`is_open_source` integer DEFAULT false NOT NULL,
	`target_audience` text,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `projects_slug_unique` ON `projects` (`slug`);--> statement-breakpoint
CREATE TABLE `settings` (
	`id` integer PRIMARY KEY DEFAULT 1 NOT NULL,
	`llm_provider` text DEFAULT 'anthropic' NOT NULL,
	`llm_model` text DEFAULT 'claude-sonnet-5' NOT NULL,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL
);
--> statement-breakpoint
CREATE TABLE `updates` (
	`id` text PRIMARY KEY NOT NULL,
	`project_id` text NOT NULL,
	`kind` text DEFAULT 'feature' NOT NULL,
	`title` text NOT NULL,
	`body` text NOT NULL,
	`version` text,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`project_id`) REFERENCES `projects`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `updates_project_idx` ON `updates` (`project_id`);