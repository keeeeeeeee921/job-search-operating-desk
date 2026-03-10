import { afterAll, describe, expect, it } from "vitest";
import { eq, sql } from "drizzle-orm";
import { closeDb, getDb } from "@/lib/db/client";
import { dailyGoalsTable, jobsTable } from "@/lib/db/schema";
import {
  archiveJobRecord,
  getDailyGoalsState,
  insertJob,
  updateComments,
  updateDailyGoalState
} from "@/lib/db/repository";
import type { JobRecord } from "@/lib/types";
import { getEasternDateKey } from "@/lib/utils";

const postgresEnabled = Boolean(process.env.DATABASE_URL);
const smokeId = "postgres-smoke-job";
const triggerSmokeId = "postgres-smoke-trigger-job";

describe.skipIf(!postgresEnabled)("postgres smoke", () => {
  afterAll(async () => {
    if (!postgresEnabled) {
      return;
    }

    await getDb().delete(jobsTable).where(eq(jobsTable.id, smokeId));
    await getDb().delete(jobsTable).where(eq(jobsTable.id, triggerSmokeId));
    await closeDb();
  });

  it("covers create, comments, archive, and daily goals on real Postgres", async () => {
    const db = getDb();
    const today = getEasternDateKey();
    const initialGoalsRow = (
      await db.select().from(dailyGoalsTable).where(eq(dailyGoalsTable.dateKey, today)).limit(1)
    )[0];

    const record: JobRecord = {
      id: smokeId,
      roleTitle: "Postgres Smoke Analyst",
      company: "Smoke Test Co",
      location: "Remote",
      link: "https://example.com/jobs/postgres-smoke-analyst",
      jobDescription: "Validate the managed Postgres path end to end.",
      timestamp: new Date().toISOString(),
      pool: "active",
      comments: "",
      applyCountedDateKey: null,
      sourceType: "company",
      sourceConfidence: "high",
      extractionStatus: "confirmed"
    };

    const initialGoals = await getDailyGoalsState();
    await insertJob(record);
    await updateComments(smokeId, "Smoke comment");
    await archiveJobRecord(smokeId);

    const archived = (
      await db.select().from(jobsTable).where(eq(jobsTable.id, smokeId)).limit(1)
    )[0];

    expect(archived.comments).toBe("Smoke comment");
    expect(archived.pool).toBe("rejected");

    await updateDailyGoalState({
      goal: "apply",
      kind: "increment"
    });
    await updateDailyGoalState({
      goal: "follow",
      kind: "target",
      value: 5
    });

    const updatedGoals = await getDailyGoalsState();
    expect(updatedGoals.goals.apply.count).toBe(initialGoals.goals.apply.count + 1);
    expect(updatedGoals.goals.follow.target).toBe(5);

    await getDb().delete(jobsTable).where(eq(jobsTable.id, smokeId));

    await db.execute(sql`
      insert into jobs (
        id,
        role_title,
        company,
        location,
        link,
        job_description,
        search_text,
        "timestamp",
        pool,
        comments,
        apply_counted_date_key,
        source_type,
        source_confidence,
        extraction_status
      ) values (
        ${triggerSmokeId},
        'Trigger Analyst',
        'Trigger Test Co',
        'Remote',
        '',
        'Trigger check for search_text autopopulation.',
        '',
        now(),
        'active',
        '',
        null,
        'unknown',
        'unknown',
        'needs_review'
      )
    `);

    const inserted = (
      await db.select().from(jobsTable).where(eq(jobsTable.id, triggerSmokeId)).limit(1)
    )[0];

    expect(inserted.searchText).toBe("trigger test co trigger analyst remote");

    await db
      .update(jobsTable)
      .set({
        company: "Trigger Updated Co",
        searchText: ""
      })
      .where(eq(jobsTable.id, triggerSmokeId));

    const updated = (
      await db.select().from(jobsTable).where(eq(jobsTable.id, triggerSmokeId)).limit(1)
    )[0];
    expect(updated.searchText).toBe("trigger updated co trigger analyst remote");

    await getDb().delete(jobsTable).where(eq(jobsTable.id, triggerSmokeId));

    if (initialGoalsRow) {
      await db
        .update(dailyGoalsTable)
        .set({
          applyCount: initialGoalsRow.applyCount,
          applyAdjustment: initialGoalsRow.applyAdjustment,
          applyTarget: initialGoalsRow.applyTarget,
          connectCount: initialGoalsRow.connectCount,
          connectTarget: initialGoalsRow.connectTarget,
          followCount: initialGoalsRow.followCount,
          followTarget: initialGoalsRow.followTarget
        })
        .where(eq(dailyGoalsTable.dateKey, today));
    } else {
      await db.delete(dailyGoalsTable).where(eq(dailyGoalsTable.dateKey, today));
    }
  });
});
