# Troubleshooting

## 1) Active record exists but search cannot find it

Most common cause: `search_text` is empty for that row.

Run a bounded dry-run first:

```bash
pnpm repair:search-text -- --from 2026-03-08 --to 2026-03-10 --dry-run
```

Then apply:

```bash
pnpm repair:search-text -- --from 2026-03-08 --to 2026-03-10 --apply
```

Notes:
- Keep the date window narrow.
- This operation is data-index repair only. It does not change business fields.

## 2) Company / Role / Location is clearly polluted

Use the Active-only audit/fix flow.

1. Audit with JSON output:

```bash
pnpm audit:active-records -- --days 7 --limit 150 --json
```

2. Build a patch map from `patchTemplate` output (or your own file).
3. Dry-run manual fix first:

```bash
pnpm manual-fix:records -- --patch-file ./tmp/patches.json --dry-run
```

4. Apply after review:

```bash
pnpm manual-fix:records -- --patch-file ./tmp/patches.json --apply
```

Rule: repair is always Active-only. Rejected records stay untouched.

## 3) Update by Email cannot find a known record

Checklist:
- Confirm the target record is in `Active` (not `Rejected`).
- Paste enough signal words: company + role title in the email text.
- Retry with cleaner text (remove signatures/disclaimers if needed).

Health check command:

```bash
pnpm report:extraction-health -- --days 7 --pool active --limit 20
```

If extraction quality dropped for one host family, prioritize that family in parser fixes.

## 4) New records keep falling into manual review for location

Likely causes:
- pasted text is mostly UI noise
- no location-shaped text (`City, ST`, `Country`, `Remote: USA`, etc.)

What to do:
- Keep the conservative behavior (do not auto-guess).
- Fill location in review modal for that record.
- Add a regression sample for the failing text shape before changing parser rules.
