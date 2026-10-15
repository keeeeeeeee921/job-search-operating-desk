# Troubleshooting

## 1) Active record exists but search cannot find it

Most common cause used to be an empty `search_text` for that row. Since
migration `0004` a database trigger (`jobs_set_search_text_before_write`)
fills `search_text` on every insert and update, so this should not recur for
new or edited rows.

If it does: confirm the trigger exists in the target database
(`\d jobs` in psql), then save any edit to the record (a comment is enough) so
the trigger rebuilds its search text. The one-off `repair:search-text` script
that fixed the pre-trigger rows was removed on 2026-10-14; it is in git history
if a bulk repair is ever needed again.

## 2) Company / Role / Location is clearly polluted

1. Audit recent Active records:

```bash
pnpm audit:active-records -- --days 7 --limit 150 --json
```

2. Scraped noise (undecoded entities, metadata glued onto the location,
   aggregator chrome, flattened acronyms) has a bulk repair. Dry-run first,
   then apply:

```bash
pnpm repair:extraction-noise
pnpm repair:extraction-noise -- --apply
```

3. Anything the noise repair does not cover is fixed by hand on that record.
   The one-off patch-map scripts (`manual-fix:records`, `repair:records`) were
   removed on 2026-10-14 and remain in git history.

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
