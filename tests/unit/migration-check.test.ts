import { describe, expect, it } from "vitest";
import journal from "@/drizzle/meta/_journal.json";
import { describeMigrationMismatch } from "@/lib/db/migration-check";

const entries = [
  { idx: 0, when: 100, tag: "0000_init" },
  { idx: 1, when: 200, tag: "0001_second" },
  { idx: 2, when: 300, tag: "0002_third" }
];

describe("describeMigrationMismatch", () => {
  it("accepts a database whose latest migration matches the journal", () => {
    expect(describeMigrationMismatch({ createdAt: 300 }, entries)).toBeNull();
    expect(describeMigrationMismatch({ createdAt: "300" }, entries)).toBeNull();
    expect(describeMigrationMismatch({ createdAt: BigInt(300) }, entries)).toBeNull();
  });

  it("names the applied and expected tags when the database is behind", () => {
    const message = describeMigrationMismatch({ createdAt: 200 }, entries);
    expect(message).toContain("behind the code");
    expect(message).toContain("0001_second");
    expect(message).toContain("0002_third");
    expect(message).toContain("pnpm db:migrate");
  });

  it("falls back to the timestamp when the applied migration is not in the journal", () => {
    const message = describeMigrationMismatch({ createdAt: 250 }, entries);
    expect(message).toContain("created_at 250");
    expect(message).toContain("0002_third");
  });

  it("explains a database that is ahead of the code", () => {
    const message = describeMigrationMismatch({ createdAt: 400 }, entries);
    expect(message).toContain("ahead of the code");
    expect(message).toContain("0002_third");
  });

  it("rejects an empty migrations table", () => {
    expect(describeMigrationMismatch(undefined, entries)).toContain("no applied migrations");
    expect(describeMigrationMismatch({ createdAt: null }, entries)).toContain("no applied migrations");
  });

  it("is a no-op for an empty journal", () => {
    expect(describeMigrationMismatch({ createdAt: 1 }, [])).toBeNull();
  });

  it("works against the real journal shipped with the app", () => {
    const last = journal.entries[journal.entries.length - 1];
    expect(describeMigrationMismatch({ createdAt: last.when }, journal.entries)).toBeNull();
    expect(
      describeMigrationMismatch({ createdAt: journal.entries[3].when }, journal.entries)
    ).toContain("0003_large_shiver_man");
  });
});
