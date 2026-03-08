import {
  integer,
  pgTable,
  text,
  timestamp,
  varchar
} from "drizzle-orm/pg-core";

export const jobsTable = pgTable("jobs", {
  id: varchar("id", { length: 191 }).primaryKey(),
  roleTitle: text("role_title").notNull(),
  company: text("company").notNull(),
  location: text("location").notNull(),
  link: text("link").notNull(),
  jobDescription: text("job_description").notNull(),
  timestamp: timestamp("timestamp", {
    withTimezone: true,
    mode: "date"
  }).notNull(),
  pool: varchar("pool", { length: 16 }).notNull(),
  comments: text("comments").notNull(),
  applyCountedDateKey: varchar("apply_counted_date_key", { length: 32 }),
  sourceType: varchar("source_type", { length: 32 }).notNull(),
  sourceConfidence: varchar("source_confidence", { length: 16 }).notNull(),
  extractionStatus: varchar("extraction_status", { length: 32 }).notNull()
});

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
