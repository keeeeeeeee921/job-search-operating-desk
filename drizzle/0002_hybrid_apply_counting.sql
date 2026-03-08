ALTER TABLE "daily_goals" ADD COLUMN "apply_adjustment" integer NOT NULL DEFAULT 0;

UPDATE "daily_goals" AS "dg"
SET "apply_adjustment" = GREATEST(
  0,
  "dg"."apply_count" - COALESCE(
    (
      SELECT COUNT(*)
      FROM "jobs" AS "j"
      WHERE
        "j"."pool" = 'active'
        AND "j"."apply_counted_date_key" = "dg"."date_key"
    ),
    0
  )
);

ALTER TABLE "daily_goals" ALTER COLUMN "apply_adjustment" DROP DEFAULT;
