CREATE EXTENSION IF NOT EXISTS pg_trgm;--> statement-breakpoint
ALTER TABLE "jobs" ADD COLUMN "search_text" text DEFAULT '' NOT NULL;--> statement-breakpoint
UPDATE "jobs"
SET "search_text" = lower(trim(concat_ws(' ', "company", "role_title", "location")));--> statement-breakpoint
CREATE INDEX "jobs_pool_timestamp_idx" ON "jobs" USING btree ("pool","timestamp" DESC);--> statement-breakpoint
CREATE INDEX "jobs_pool_apply_date_idx" ON "jobs" USING btree ("pool","apply_counted_date_key");--> statement-breakpoint
CREATE INDEX "jobs_search_text_trgm_idx" ON "jobs" USING gin ("search_text" gin_trgm_ops);
