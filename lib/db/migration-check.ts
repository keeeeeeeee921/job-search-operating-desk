/**
 * Compares what Drizzle recorded in `__drizzle_migrations` with the journal
 * the code was built from, so a deployment whose database is behind (or
 * ahead of) its migrations fails fast with a message that says what to do,
 * instead of a column-not-found error somewhere in the first query.
 *
 * Drizzle's migrations table does not store the tag; each row's `created_at`
 * is the journal entry's `when` (milliseconds), which is unique per entry.
 */
export type MigrationJournalEntry = {
  idx: number;
  when: number;
  tag: string;
};

export type AppliedMigration = {
  createdAt: number | string | bigint | null | undefined;
};

const MIGRATE_HINT =
  "Run `pnpm db:migrate` with DATABASE_URL_UNPOOLED pointing at this database, then redeploy.";

function tagFor(entries: MigrationJournalEntry[], when: number) {
  return entries.find((entry) => entry.when === when)?.tag;
}

/**
 * Returns null when the database matches the journal, otherwise the error
 * message to throw.
 */
export function describeMigrationMismatch(
  latestApplied: AppliedMigration | undefined,
  entries: MigrationJournalEntry[]
): string | null {
  const expected = entries[entries.length - 1];

  if (!expected) {
    return null;
  }

  const appliedWhen =
    latestApplied?.createdAt === null || latestApplied?.createdAt === undefined
      ? null
      : Number(latestApplied.createdAt);

  if (appliedWhen === null || Number.isNaN(appliedWhen)) {
    return `Postgres has no applied migrations recorded in __drizzle_migrations, but the code expects ${expected.tag}. ${MIGRATE_HINT}`;
  }

  if (appliedWhen === expected.when) {
    return null;
  }

  const appliedTag = tagFor(entries, appliedWhen);

  if (appliedWhen < expected.when) {
    const applied = appliedTag ?? `an unknown migration (created_at ${appliedWhen})`;
    return `Postgres schema is behind the code: latest applied migration is ${applied}, but the code expects ${expected.tag}. ${MIGRATE_HINT}`;
  }

  return `Postgres schema is ahead of the code: __drizzle_migrations records a migration (created_at ${appliedWhen}) newer than ${expected.tag}, the last entry in drizzle/meta/_journal.json. Deploy the code that added it, or check which branch this build came from.`;
}
