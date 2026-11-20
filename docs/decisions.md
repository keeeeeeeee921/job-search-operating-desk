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

## 2026-10-15 — Search cycles become data

- Every search cycle used to be constants in `lib/search-cycle.ts` (the
  Search 02 start date, the Search 01 story, a hand-typed list of twelve
  interviewed companies); five commits existed only to edit those values.
  Migration `0009` adds a `search_cycles` table seeded with the same two
  rows, the app resolves a record's cycle from the rows (latest `start_date`
  on or before the save date), and the Search Log edits the story in place
  and starts new cycles. "Companies I interviewed with" is computed from
  `jobs.stage`, which the 2026-10-14 backfill made possible; the typed list
  survives only as `scripts/backfill-stage-companies.json`, an input to that
  backfill script.
- The cycle list is cached in-process for the same 15 s as other queries.
  A new cycle must start after the previous one and no later than today, so
  "current cycle" (latest start) and "cycle of a record saved now" always
  agree.

## 2026-11-18 — Capture from the open page instead of fetching harder

- Problem: 19 of the 35 Active records in Search 02 held a hand-typed summary
  instead of the posting. Workday answers the server's fetch with HTTP 429, so
  a pasted link produced only URL hints, the description was required, and
  people typed a summary plus application notes into it.
- Decision: a bookmarklet reads the page the browser already rendered and
  hands it to the desk (`lib/capture.ts`). No per-site scraper was added; the
  captured DOM goes through the same generic parser as a pasted link, and the
  description is the page's rendered text.
- Cross-origin: the bookmarklet opens the desk as a new tab and passes the
  page with `postMessage`. Rejected: a credentialed `fetch` from the job page
  (needs `SameSite=None` on the access cookie and CORS open to every origin,
  which lets any site call the desk with the reader's session) and a
  cross-site form POST (Lax cookies are not sent, so a signed-out capture is
  lost at the login redirect). The bookmarklet holds only the desk's origin.
- Any site can open the desk in a window with the capture name and offer a
  draft. That is accepted: the draft is parsed as untrusted text, nothing is
  fetched, and nothing is saved until a signed-in person presses Save.
- Captures always stop at review. The review dialog gained a Notes box, saved
  to `comments`, so application notes have somewhere to go at entry time.
- Existing records were not touched; the 19 short descriptions stay as they
  are.
- Follow-up the next day, from the first live capture (Ameren, Workday): the
  description began with "Skip to main content / Sign In" and ended with the
  footer, and the location was the tenant's site code
  ("001X HQ (St_Louis_MO), United States") shown as "Looks good".
  - The description is now cut to the posting body the page itself publishes
    (`locatePostingBody`). The published text only locates the start and the
    end; what is saved is still the rendered text. The cut is skipped unless
    both ends are found, the span is the same size as the published body and
    it is at least half the page, so a teaser can never shorten a record.
  - A location containing an underscore is treated as an internal label by
    the shared parser (this also applies to pasted links). For a capture the
    location then comes from the page's visible text.

## Convention

**When removing a feature, say why in the commit body.** Three removals above
(the public demo, the design lab, the stage column) have no recorded reason,
and each one later cost time: the demo and the stage column were both rebuilt
months later. One or two sentences on what the feature cost, what replaced it,
and what data is affected is enough.
