# Postgres Deployment

This app runs against real Postgres when `DATABASE_URL` is present.

## Environment Variables

- `DATABASE_URL`: pooled runtime connection string used by the app.
- `DATABASE_URL_UNPOOLED`: direct connection string used by Drizzle migrations.
- `JOB_DESK_ENABLE_SEED`: optional explicit seed flag. Leave `false` for production and preview.

## Local Setup

1. Link the project to Vercel: `pnpm dlx vercel link`
2. Pull development env vars: `pnpm env:pull`
3. Run migrations: `pnpm db:migrate`
4. Start the app: `pnpm dev`

## First Production Rollout

1. Install Neon from the Vercel Marketplace and enable Preview branches.
2. Confirm `DATABASE_URL` and `DATABASE_URL_UNPOOLED` exist in Vercel Production.
3. Run `pnpm db:migrate` against the production database before the first production deploy.
4. Deploy the app to Vercel.

Production does not auto-run migrations during `next build`.

## Preview Deployments

Preview deployments do not run migrations. The Neon integration exposes the production `DATABASE_URL` to every Vercel environment, so an automatic migrate on preview would change the production schema from any branch. Apply migrations by hand with `pnpm db:migrate` before pushing `main`.

## Ongoing Schema Changes

1. Update `lib/db/schema.ts`
2. Generate SQL: `pnpm db:generate --name <change>`
3. Review the SQL under `drizzle/` and commit the matching `drizzle/meta/NNNN_snapshot.json`
4. Apply it: `pnpm db:migrate`
5. Deploy

Hand-written SQL files need a snapshot too: `drizzle-kit generate` diffs the
schema against the newest snapshot, so a missing one makes the next generate
produce a wrong migration. Snapshots `0004`-`0008` were reconstructed by hand
for exactly that reason.

On startup the app compares the newest row in `__drizzle_migrations` with the
last entry of `drizzle/meta/_journal.json` and refuses to serve when they
differ, with a message naming both migrations. A database that is behind means
`pnpm db:migrate` was not run for this deploy.

## Validation Checklist

- `__drizzle_migrations` exists in the target database
- homepage add flow writes to Postgres
- comments persist after refresh
- Update by Email archives records into Rejected
- Preview writes do not appear in Production
