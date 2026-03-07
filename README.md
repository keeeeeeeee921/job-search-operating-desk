# Job Search Operating Desk

A desktop-first personal job search workspace built for one user.

This is not a corporate ATS, not a recruiting CRM, and not a static mockup.  
It is a real, interactive web app for capturing job records, keeping an Active-only working pool, archiving rejected roles separately, and handling the repetitive parts of job searching with a calmer, more truthful workflow.

## Demo

The actively used deployment is private to avoid exposing live personal job-search data.

If needed, a separate public-safe demo instance can be created later.

## What It Does

- Paste a job link and process it into a structured job record
- Detect likely duplicates before saving
- Force manual review when required fields are missing or low-confidence
- Keep search scoped to Active records only
- Archive rejected roles into a separate quiet pool
- Update a job from pasted rejection email text
- Track daily goals for `Apply`, `Connect`, and `Follow`
- Support pasted job text for cases like LinkedIn Easy Apply, where a clean job link is often not reliable

## Product Direction

The app is designed around a few constraints:

- The UI should never look more certain than the data really is
- Frontend-only extraction is not magic
- LinkedIn and Easy Apply links are often restricted or incomplete
- Missing fields should trigger review, not fabricated values
- Job records should feel structured and honest, not decorative

## Core MVP Screens

- Homepage with command-style intake
- Recent Active records preview
- Daily Goals side widget
- Duplicate detection modal
- Missing-fields review modal
- Active list
- Active detail page with inline comments
- Rejected archive
- Active-only search
- Update by Email matching flow

## Tech Stack

- Next.js App Router
- TypeScript
- Tailwind CSS
- Framer Motion
- Postgres-ready persistence
- Drizzle migrations
- Local fallback store for offline dev and test isolation
- Vitest
- Playwright

## Input Paths

### 1. Job link intake

Paste a job link and press `Enter`.

The app will:

- detect probable source
- attempt extraction
- validate required fields
- check for duplicates
- save to Active only when the record is clean enough

### 2. Pasted job text intake

Paste copied job text and press `Enter`.

This path is useful for:

- LinkedIn Easy Apply
- copied recruiter postings
- roles where the source link is noisy, restricted, or not worth storing

For this path, `Link` may be left empty.

## Daily Goals

`Apply` resets daily using **America/New_York** midnight boundaries.

- default target: `50`
- new Active records automatically increment `Apply`
- manual `+1` still works
- manual target editing still works

## Local Development

```bash
pnpm install
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000).

## Environment Variables

For managed Postgres runtime:

- `DATABASE_URL`
- `DATABASE_URL_UNPOOLED`

For local development without Postgres, the app can fall back to a local file store.

See [docs/postgres-deployment.md](docs/postgres-deployment.md) for deployment and migration notes.

## Scripts

```bash
pnpm dev
pnpm build
pnpm test
pnpm test:e2e
pnpm db:migrate
```

## Notes

- Seed data exists for demo and test purposes
- The app is intentionally conservative around extraction confidence
- LinkedIn parsing is handled truthfully: if the source does not expose enough information, the app falls back to manual review

## Why I Built It

Most job tracking tools either feel too corporate, too decorative, or too fake.  
I wanted something that feels more like a personal operating desk:

- calm
- structured
- honest about uncertainty
- practical enough to use every day
