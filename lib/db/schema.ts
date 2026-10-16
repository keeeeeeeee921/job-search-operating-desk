import { sql } from "drizzle-orm";
import {
  date,
  index,
  integer,
  jsonb,
  pgTable,
  serial,
  text,
  timestamp,
  varchar
} from "drizzle-orm/pg-core";

export const jobsTable = pgTable(
  "jobs",
  {
    id: varchar("id", { length: 191 }).primaryKey(),
    roleTitle: text("role_title").notNull(),
    company: text("company").notNull(),
    location: text("location").notNull(),
    link: text("link").notNull(),
    jobDescription: text("job_description").notNull(),
    searchText: text("search_text").notNull().default(""),
    timestamp: timestamp("timestamp", {
      withTimezone: true,
      mode: "date"
    }).notNull(),
    pool: varchar("pool", { length: 16 }).notNull(),
    stage: varchar("stage", { length: 32 }).notNull().default("no_response"),
    searchCycleLabel: varchar("search_cycle_label", { length: 32 }),
    comments: text("comments").notNull(),
    applyCountedDateKey: varchar("apply_counted_date_key", { length: 32 }),
    sourceType: varchar("source_type", { length: 32 }).notNull(),
    sourceConfidence: varchar("source_confidence", { length: 16 }).notNull(),
    extractionStatus: varchar("extraction_status", { length: 32 }).notNull()
  },
  (table) => ({
    jobsPoolTimestampIdx: index("jobs_pool_timestamp_idx").on(
      table.pool,
      table.timestamp
    ),
    jobsPoolApplyDateIdx: index("jobs_pool_apply_date_idx").on(
      table.pool,
      table.applyCountedDateKey
    ),
    jobsCycleStageIdx: index("jobs_cycle_stage_idx").on(
      table.searchCycleLabel,
      table.stage
    )
  })
);

export const dailyGoalsTable = pgTable("daily_goals", {
  dateKey: varchar("date_key", { length: 32 }).primaryKey(),
  applyCount: integer("apply_count").notNull(),
  applyAdjustment: integer("apply_adjustment").notNull(),
  applyTarget: integer("apply_target").notNull(),
  connectCount: integer("connect_count").notNull(),
  connectTarget: integer("connect_target").notNull(),
  followCount: integer("follow_count").notNull(),
  followTarget: integer("follow_target").notNull()
});

/**
 * One row per job search. A record belongs to the cycle whose start_date is
 * the latest one on or before the record's timestamp (America/Toronto date);
 * the cycle with the latest start_date is the current working set. The story
 * fields (title, goals, note, image_src) feed the Search Log page.
 */
export const searchCyclesTable = pgTable("search_cycles", {
  id: serial("id").primaryKey(),
  label: varchar("label", { length: 32 }).notNull().unique(),
  startDate: date("start_date", { mode: "string" }).notNull(),
  endDate: date("end_date", { mode: "string" }),
  title: text("title").notNull().default(""),
  goals: jsonb("goals")
    .$type<string[]>()
    .notNull()
    .default(sql`'[]'::jsonb`),
  note: text("note").notNull().default(""),
  imageSrc: text("image_src"),
  createdAt: timestamp("created_at", { withTimezone: true, mode: "date" })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true, mode: "date" })
    .notNull()
    .defaultNow()
});
