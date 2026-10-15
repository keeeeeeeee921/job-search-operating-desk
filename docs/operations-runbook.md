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

## Maintenance Utilities

All of these are dry-run by default and write only with `--apply`.

Archive Active records with no response for over a year (the app also runs
this sweep once a day on its own):

```bash
pnpm archive:stale-active
pnpm archive:stale-active -- --apply
```

Backfill `stage` from comment keywords for records that predate the stage
column:

```bash
pnpm backfill:stage-from-comments
pnpm backfill:stage-from-comments -- --apply
```

The one-off repair scripts from March 2026 (`repair:search-text`,
`repair:records`, `repair:search-cycle-label`, `repair:connect-goal`,
`manual-fix:records`) were removed on 2026-10-14 after their fixes landed in
production; see git history before that date if one is needed again.
