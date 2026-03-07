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
