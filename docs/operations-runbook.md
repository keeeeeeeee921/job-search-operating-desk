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

## Weekly Checks

```bash
pnpm report:extraction-health:weekly
```

This command groups extraction status by week and highlights the top failing host/source families.

## Active-Only Data Fix Workflow

1. Run `audit:active-records` and identify suspicious IDs.
2. Prepare a patch map for `manual-fix:records`.
3. Dry run first:

```bash
pnpm manual-fix:records -- --dry-run
```

4. Apply only after review:

```bash
pnpm manual-fix:records -- --apply
```

Rule: data repair is always `Active`-only. Rejected records are not modified.

## Release Safety Gate

Before push/deploy:

```bash
pnpm lint
pnpm test
pnpm build
```

## Emergency Utilities

Repair search index text in a bounded window:

```bash
pnpm repair:search-text -- --from 2026-03-08 --to 2026-03-10 --dry-run
pnpm repair:search-text -- --from 2026-03-08 --to 2026-03-10 --apply
```

Repair extraction for a date window:

```bash
pnpm repair:records -- --date 2026-03-08 --dry-run
pnpm repair:records -- --date 2026-03-08 --apply
```
