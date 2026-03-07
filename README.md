# Job Search Operating Desk

*A desktop-first personal workspace for managing job applications with calm structure and honest handling of uncertain data.*

## Overview

Job Search Operating Desk is a real web app for turning messy job links, copied job text, uncertain extraction results, and rejection emails into a focused personal workflow. It is built for one user: the job seeker.

## Highlights

- Paste a job link or copied job text
- Handle LinkedIn Easy Apply style input realistically
- Review incomplete records instead of inventing fields
- Match rejection emails back to Active jobs
- Track daily Apply / Connect / Follow counts

## Why I built it

I built this after getting frustrated with how much time personal job tracking wastes on repetitive, messy work. I wanted something quieter and more practical: a tool that supports imperfect input, keeps the active pool clean, and stays honest when the data is incomplete.

## What makes this different

- Built for one user: the job seeker
- Designed to stay truthful when extraction is incomplete
- Supports messy real-world inputs like copied job text
- Keeps the working pool focused on current Active roles

## Screenshots

### Home

![Home screen](docs/images/home-intake.png)

### Manual review for incomplete records

![Manual review flow](docs/images/manual-review-modal.png)

### Duplicate detection

![Duplicate detection](docs/images/duplicate-modal.png)

### Active job detail

![Active job detail](docs/images/active-detail.png)

## Key workflows

### Capture from a job link

Paste a link and press Enter. The app detects the likely source, attempts extraction, validates required fields, checks for duplicates, and only saves to Active when the record is complete enough.

### Capture from pasted job text

Paste copied job text and press Enter. This path is useful for LinkedIn Easy Apply, recruiter-shared job descriptions, and postings where the original link is noisy or not worth storing. For this flow, the `Link` field may remain empty.

### Review uncertain records

If required fields are missing or extraction confidence is low, the app pauses for manual review instead of pretending extraction succeeded.

### Update from rejection email

Paste rejection email text to find the most likely Active records and move the correct one into the Rejected archive.

## Design principles

- The interface should never look more certain than the underlying data
- Extraction stays conservative and may route to manual review
- LinkedIn-style sources are handled realistically, not as fake scraping

## Implementation notes

- Extraction is conservative and falls back to manual review when fields are missing or low-confidence
- LinkedIn-style intake is supported through pasted job text rather than pretending unrestricted scraping
- Rejection email matching is part of the actual workflow, not a demo-only screen
- The app is tested with Vitest and Playwright

## Tech stack

- Next.js App Router
- TypeScript
- Tailwind CSS
- Framer Motion
- Drizzle migrations
- Postgres-ready persistence
- Local fallback store for offline development and isolated testing
- Vitest
- Playwright

## Local development

```bash
pnpm install
pnpm dev
```

Then open `http://localhost:3000`.

## Environment variables

For managed Postgres runtime:

- `DATABASE_URL`
- `DATABASE_URL_UNPOOLED`

For local development without Postgres, the app can fall back to a local file store. For deployment and migration notes, see `docs/postgres-deployment.md`.

## Daily goals

`Apply` resets on `America/New_York` midnight boundaries. New Active records automatically increment `Apply`, while `Connect` and `Follow` are tracked as daily counts with manual updates.

## Demo

The actively used deployment is private because it contains real personal job-search data. A separate public-safe demo instance can be created later if needed.
