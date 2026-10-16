CREATE TABLE "search_cycles" (
	"id" serial PRIMARY KEY NOT NULL,
	"label" varchar(32) NOT NULL,
	"start_date" date NOT NULL,
	"end_date" date,
	"title" text DEFAULT '' NOT NULL,
	"goals" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"note" text DEFAULT '' NOT NULL,
	"image_src" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "search_cycles_label_unique" UNIQUE("label")
);
--> statement-breakpoint
-- The two cycles that were hard-coded in lib/search-cycle.ts before this
-- migration. Search 02 starts with an empty story; it is written in the app.
INSERT INTO "search_cycles" ("label", "start_date", "end_date", "title", "goals", "note", "image_src")
VALUES
  (
    'Search 01',
    '2025-09-06',
    '2026-04-02',
    'First full-time search after graduation',
    '["Find a job", "Keep some data analysis content in the role"]'::jsonb,
    'This was my first full-time search after graduation, so the scope stayed broad. The goal was to land a solid role with at least some analytics work, without over-optimizing for a perfect match.',
    '/job-search-cycle-01.png'
  ),
  ('Search 02', '2026-04-03', NULL, '', '[]'::jsonb, '', NULL)
ON CONFLICT ("label") DO NOTHING;
