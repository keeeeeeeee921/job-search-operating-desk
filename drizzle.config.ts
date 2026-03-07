import { defineConfig } from "drizzle-kit";

const databaseUrl =
  process.env.DATABASE_URL_UNPOOLED ??
  process.env.DATABASE_URL ??
  "postgres://postgres:postgres@127.0.0.1:5432/job_search_operating_desk";

export default defineConfig({
  dialect: "postgresql",
  schema: "./lib/db/schema.ts",
  out: "./drizzle",
  dbCredentials: {
    url: databaseUrl
  },
  migrations: {
    table: "__drizzle_migrations",
    schema: "public"
  }
});
