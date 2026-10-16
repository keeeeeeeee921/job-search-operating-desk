# Operations Runbook

This runbook documents the recurring maintenance flow for the private app.

## Daily Checks

```bash
pnpm audit:active-records -- --days 7 --limit 120
pnpm report:extraction-health -- --days 7 --pool active --limit 20
```

Optional JSON output for automation/reporting:

```bash
pnpm audit:active-records -- --days 7 --limit 120 --json
pnpm report:extraction-health -- --days 7 --pool active --limit 20 --json
```

The audit JSON includes:
- `trend` (daily suspicious trend)
- `familyTrend` (daily source-family trend)
- `hostnameTrend` (daily hostname trend)
- `patchTemplate` (copy-friendly manual fix starter map)

## Weekly Checks

```bash
pnpm report:extraction-health:weekly
```

This command groups extraction status by week and highlights the top failing host/source families.

## Active-Only Data Fix Workflow

1. Run `audit:active-records` and identify suspicious IDs.
2. Run the scraped-noise repair as a dry run, read the report, then apply:

```bash
pnpm repair:extraction-noise
pnpm repair:extraction-noise -- --apply
```

3. Fix whatever remains by hand on the record.

Rule: data repair is always `Active`-only. Rejected records are not modified.

## Release Safety Gate

GitHub Actions runs the same gate on every push and pull request
(`.github/workflows/ci.yml`). Locally, before push/deploy:

```bash
pnpm lint
pnpm typecheck
pnpm test
pnpm build
pnpm test:e2e
```

## Troubleshooting

See `docs/troubleshooting.md` for common production issues:
- search misses caused by empty `search_text`
- polluted extraction fields
- update-by-email misses
- location missing in pasted text flows

## Search Cycles

Search cycles live in the `search_cycles` table (migration `0009`), one row
per job search: `label`, `start_date`, optional `end_date`, and the story
shown on the Search Log (`title`, `goals`, `note`, `image_src`). Nothing
about a cycle is hard-coded any more:

- A record belongs to the cycle with the latest `start_date` on or before
  the day it was saved (America/New_York calendar day). Records saved before
  the first cycle count in the first cycle. `jobs.search_cycle_label` stores
  the label at save time; rows whose label is still null are resolved from
  the timestamp the same way.
- The current working set (Active's default view, the home page) is the
  cycle with the latest `start_date`.
- Starting a new cycle is done in the app: Search Log → **Start a new search
  cycle**. The new start date must be after the previous cycle's start and
  no later than today; the previous cycle gets `end_date` = the day before.
  No deploy is needed.
- The story is edited in the app with the **Edit** button on each cycle.
  A summary image goes into `public/` and its path (`/name.png`) into the
  image field.
- "Companies I interviewed with" is computed from `jobs.stage` (every record
  of the cycle past `no_response` / `rejected`, furthest stage per company).
  To change the list, change the stages of the records.

The cycle list is cached in the server process for the same 15 seconds as
the other queries and dropped on every write, so an edit shows on the next
request.

## Maintenance Utilities

All of these are dry-run by default and write only with `--apply`.

Archive Active records with no response for over a year (the app also runs
this sweep once a day on its own):

```bash
pnpm archive:stale-active
pnpm archive:stale-active -- --apply
```

Backfill `stage` from comment keywords for records that predate the stage
column. `scripts/backfill-stage-companies.json` names one cycle and the
companies interviewed with in it; a record of that cycle whose company
matches and that carries a human note is suggested Round 1 when no keyword
rule hits. Manual corrections go in `scripts/backfill-stage-overrides.json`.

```bash
pnpm backfill:stage-from-comments
pnpm backfill:stage-from-comments -- --apply
```

The one-off repair scripts from March 2026 (`repair:search-text`,
`repair:records`, `repair:search-cycle-label`, `repair:connect-goal`,
`manual-fix:records`) were removed on 2026-10-14 after their fixes landed in
production; see git history before that date if one is needed again.
