CREATE TABLE "daily_goals" (
	"date_key" varchar(32) PRIMARY KEY NOT NULL,
	"apply_count" integer NOT NULL,
	"apply_target" integer NOT NULL,
	"connect_count" integer NOT NULL,
	"connect_target" integer NOT NULL,
	"follow_count" integer NOT NULL,
	"follow_target" integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE "jobs" (
	"id" varchar(191) PRIMARY KEY NOT NULL,
	"role_title" text NOT NULL,
	"company" text NOT NULL,
	"location" text NOT NULL,
	"link" text NOT NULL,
	"job_description" text NOT NULL,
	"timestamp" timestamp with time zone NOT NULL,
	"pool" varchar(16) NOT NULL,
	"comments" text NOT NULL,
	"source_type" varchar(32) NOT NULL,
	"source_confidence" varchar(16) NOT NULL,
	"extraction_status" varchar(32) NOT NULL
);
