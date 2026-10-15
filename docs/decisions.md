# Decision log

Key product and engineering decisions, reconstructed from git history. Each
entry names the commit so the diff can be read when the one-line summary is
not enough. Dates are commit dates.

## 2026-03-07 — Public demo added, then its link removed the same day

- `b5958c8` publishes the README with a live-demo link; `73c892f` removes the
  link a few hours later. The README afterwards says the actively used
  deployment is private because it holds real job-search data.
- `67689c0` adds a separate public demo mode with its own database, seeded
  records and a daily reset endpoint (`/api/demo/reset`).

## 2026-03-09 and 2026-03-13 — Public demo removed

- `eec6fd7` ("Remove public demo and ship query optimizations") drops the
  demo deployment notes from the README; `8a5377e` removes the demo runtime
  (`lib/demo.ts`, the reset route, most of the seed data).
- **Reason not recorded.** Neither commit body says why. The most likely
  reading is that a second Vercel project plus a daily reset was more to run
  than it was worth for a one-person tool, but that is an inference.

## 2026-03-10 — `/search` folded into `/active`

- `dfe335c` removes the standalone search page; searching happens on Active.
  A redirect stub stayed behind for old links until 2026-10-14.

## 2026-03-16 — Design lab added and removed the same day

- `8662617` adds `/design-lab/*` A/B comparison pages; `13915c1` removes them
  once the comparison was decided. Reason for the removal is not written
  down; the empty directories lingered until 2026-10-14.

## 2026-03-29 — Stage tracking and the application-flow Sankey

- `34e114e` adds a `stage` column (migration `0005`, default `applied`), a
  stage repair script and an `/analytics` page with a Sankey funnel.
- `ffac723` (2026-03-31) replaces the live funnel with a fixed "search log
  snapshot"; `/analytics` becomes a redirect to `/search-log`.

## 2026-04-03 — Search cycle labels

- `0bdda86` adds `search_cycle_label` (migration `0006`) so records can be
  grouped by job-search round ("Search 01", "Search 02").

## 2026-04-05 — Stage column removed in favour of comments

- `737118b` drops the `stage` column (migration `0007`), the stage library and
  its scripts. Progress is recorded as free text in comments instead.
- **Reason not recorded** in the commit body. Consequence: between April and
  June, interview progress for Search 01 only exists as comment text.

## 2026-06-13 — Stage column restored, backfilled by pool

- `c1d514e` restores `stage` (migration `0008`) for a Search Log Sankey. The
  migration backfills every row from `pool` only: rejected → `rejected`,
  everything else → `no_response`.
- Consequence: the stages people actually reached before April (screening,
  rounds, offers) were not recovered at this point, so the Search 01 funnel
  showed no interview stages until the 2026-10-14 backfill.

## 2026-10-13 — Access token and read-only demo mode

- `324d7d6` puts every page, server action and API route behind a token
  cookie (`JOB_DESK_ACCESS_TOKEN`); production without a token refuses all
  requests. Reason: the desk held real application records behind no
  authentication.
- `1961ca2` makes `JOB_DESK_PUBLIC_DEMO=true` a real read-only demo: in-memory
  seeded store, writes answered with 403, UI controls disabled.
- `da335d6` shows only the current search cycle on Active by default;
  `7262e55` auto-archives Active records with no response for over a year;
  `6a83c22` cleans scraped noise from company, title and location.

## 2026-10-14 — Stage backfill and the drill-down Sankey

- `fb62e93` / `c565cf7` backfill `stage` for Search 01 from comment keywords
  and the interviewed-companies list (dry-run by default, overrides file for
  manual corrections). This repairs the loss noted on 2026-06-13.
- `3fb33f1` / `40cc8fe` / `ce4a9be` redraw the Search Log Sankey as a
  click-to-focus funnel with its own layout; `d3-sankey` is no longer used.
- Engineering hygiene the same day: `d3-sankey` dropped and `xlsx` moved to
  devDependencies; route-level error and not-found pages; GitHub Actions CI;
  Drizzle snapshots `0004`–`0008` reconstructed and the app now checks that
  the database's latest applied migration matches `drizzle/meta/_journal.json`;
  one-off repair scripts, the `/search` and `/analytics` redirect stubs, the
  empty design-lab folders and the static-copy audit removed.
- A loading skeleton (`app/loading.tsx`) was tried and dropped: on Next.js
  15.5 any route-level Suspense boundary makes same-path navigations that
  only change the query string (for example Active → Older cycles) hang
  (vercel/next.js#86151, fixed in the 16.3 canaries). Revisit after upgrading.

## Convention

**When removing a feature, say why in the commit body.** Three removals above
(the public demo, the design lab, the stage column) have no recorded reason,
and each one later cost time: the demo and the stage column were both rebuilt
months later. One or two sentences on what the feature cost, what replaced it,
and what data is affected is enough.
