# Postgres Deployment

This app runs against real Postgres when `DATABASE_URL` is present.

## Environment Variables

- `DATABASE_URL`: pooled runtime connection string used by the app.
- `DATABASE_URL_UNPOOLED`: direct connection string used by Drizzle migrations.
- `JOB_DESK_ENABLE_SEED`: optional explicit seed flag. Leave `false` for production and preview.
- `JOB_DESK_PUBLIC_DEMO`: set to `true` only for the public demo project.
- `CRON_SECRET`: optional secret used by the demo reset route and Vercel cron.

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

## Public Demo Project

Create the public demo as a second Vercel project pointed at the same repo, but with its own Postgres database.

Required demo env vars:

- `DATABASE_URL`
- `DATABASE_URL_UNPOOLED`
- `JOB_DESK_PUBLIC_DEMO=true`
- `CRON_SECRET=<demo-secret>`

Demo behavior:

- uses a separate curated demo seed dataset
- shows a public demo banner in the app shell
- stays fully interactive
- resets all demo jobs and daily goals every day at `3:00 AM America/New_York`

The repo already includes a cron-backed route at `/api/demo/reset`. `vercel.json` triggers it hourly, and the route only performs the reset during the `3 AM` Eastern hour.

## Preview Deployments

`vercel.json` runs `pnpm db:migrate` automatically for `VERCEL_ENV=preview`.

That keeps Preview schema in sync with the branch-specific Neon database before `pnpm build`.

## Ongoing Schema Changes

1. Update `lib/db/schema.ts`
2. Generate SQL: `pnpm db:generate --name <change>`
3. Review the SQL under `drizzle/`
4. Apply it: `pnpm db:migrate`
5. Deploy

## Validation Checklist

- `__drizzle_migrations` exists in the target database
- homepage add flow writes to Postgres
- comments persist after refresh
- Update by Email archives records into Rejected
- Preview writes do not appear in Production
