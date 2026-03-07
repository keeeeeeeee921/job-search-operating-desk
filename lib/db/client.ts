import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "@/lib/db/schema";

declare global {
  // eslint-disable-next-line no-var
  var __jobDeskDb: ReturnType<typeof drizzle> | undefined;
  // eslint-disable-next-line no-var
  var __jobDeskSqlClient: ReturnType<typeof postgres> | undefined;
}

function getRuntimeDatabaseUrl() {
  const databaseUrl = process.env.DATABASE_URL;

  if (!databaseUrl) {
    if (process.env.VERCEL) {
      throw new Error(
        "DATABASE_URL is missing on Vercel. Configure DATABASE_URL and DATABASE_URL_UNPOOLED before deploying."
      );
    }

    throw new Error(
      "DATABASE_URL is not set. Use the local fallback only outside managed Postgres runtime."
    );
  }

  return databaseUrl;
}

function createDb() {
  const client = postgres(getRuntimeDatabaseUrl(), {
    max: 1,
    prepare: false
  });

  globalThis.__jobDeskSqlClient = client;
  return drizzle(client, { schema });
}

export function getDb() {
  if (!globalThis.__jobDeskDb) {
    globalThis.__jobDeskDb = createDb();
  }

  return globalThis.__jobDeskDb;
}

export async function closeDb() {
  if (globalThis.__jobDeskSqlClient) {
    await globalThis.__jobDeskSqlClient.end({ timeout: 0 });
    globalThis.__jobDeskSqlClient = undefined;
  }

  globalThis.__jobDeskDb = undefined;
}
