# Static Web Copy Audit (Baseline)

Generated: 2026-04-03  
Purpose: review all current user-facing static copy before any rewrite pass.

Notes:
- This file is the pre-rewrite audit baseline.
- A full UI copy rewrite was shipped on 2026-04-03; use the current app code as the source of truth for live copy.
- Scope includes visible UI copy, modal/toast copy, placeholders, helper text, metadata, and fixed template fragments shown in the app.
- Scope excludes README, scripts, tests, logs, and backend-only/internal error text that does not surface in the current UI.
- Shared copy appears once in a dedicated section and is referenced from page sections where relevant.

## Global Shell

1.  
   页面/区域: Global shell  
   位置: `app/layout.tsx` -> `metadata.title`  
   当前文本: `Job Search Operating Desk`  
   备注: 和 header eyebrow 文案一致。

2.  
   页面/区域: Global shell  
   位置: `app/layout.tsx` -> `metadata.description`  
   当前文本: `A desktop-first personal job search management workspace.`  
   备注: 偏产品描述语气，后面如果整体文案更收束，这句可能也要同步。

3.  
   页面/区域: Global shell  
   位置: Header / brand eyebrow  
   当前文本: `Job Search Operating Desk`  
   备注: 和 metadata title 重复，shared。

4.  
   页面/区域: Global shell  
   位置: Header / brand title  
   当前文本: `Personal job search workspace`  
   备注: 当前语气比较克制。

5.  
   页面/区域: Global shell  
   位置: Header / nav item  
   当前文本: `Active`  
   备注: 导航核心词之一，建议和其他页面标题保持不动，除非整体术语体系重做。

6.  
   页面/区域: Global shell  
   位置: Header / nav item  
   当前文本: `Rejected`  
   备注:

7.  
   页面/区域: Global shell  
   位置: Header / nav item  
   当前文本: `Update by Email`  
   备注: 功能导向较强，后续如果想更自然，可重点复查。

## Home

1.  
   页面/区域: Home  
   位置: Main hero / eyebrow  
   当前文本: `Main Input`  
   备注:

2.  
   页面/区域: Home  
   位置: Main hero / title  
   当前文本: `Paste a job link. Keep the working pool honest.`  
   备注: 当前品牌感较强，也最像产品原则文案。

3.  
   页面/区域: Home  
   位置: Main hero / body copy  
   当前文本: `This desk separates input, extraction, and saved records. If required fields are missing or the source is restricted, the app stops and asks for review instead of pretending extraction succeeded.`  
   备注: 信息准确，但略偏解释型，可能值得压短一点。

4.  
   页面/区域: Home  
   位置: Main hero / illustration alt  
   当前文本: `A bear sitting in an office chair surrounded by paper stacks.`  
   备注: 辅助文本，可保持轻量。

5.  
   页面/区域: Home  
   位置: Input mode button  
   当前文本: `Paste link`  
   备注:

6.  
   页面/区域: Home  
   位置: Input mode button  
   当前文本: `Paste job text`  
   备注:

7.  
   页面/区域: Home  
   位置: Link input / placeholder  
   当前文本: `Paste a job link and press Enter`  
   备注:

8.  
   页面/区域: Home  
   位置: Text input / title  
   当前文本: `Paste job text`  
   备注: 和上面的 mode button 重复，shared within page。

9.  
   页面/区域: Home  
   位置: Text input / helper  
   当前文本: `Best for LinkedIn Easy Apply and copied listings. Link can be empty.`  
   备注: 功能信息明确，但偏说明书口吻。

10.  
   页面/区域: Home  
   位置: Text input / badge  
   当前文本: `Press Enter`  
   备注:

11.  
   页面/区域: Home  
   位置: Text input / placeholder  
   当前文本: `Paste copied job text. Press Enter to process, or Shift+Enter for a new line.`  
   备注:

12.  
   页面/区域: Home  
   位置: Text input / footnote  
   当前文本: `UI noise such as Save, Easy Apply, Resume Match, and profile blocks is filtered when possible.`  
   备注: 偏内部实现说明，可考虑简化。

13.  
   页面/区域: Home  
   位置: Processing status  
   当前文本: `Processing...`  
   备注: shared with link/text flow。

14.  
   页面/区域: Home  
   位置: Processing status  
   当前文本: `Detecting source...`  
   备注:

15.  
   页面/区域: Home  
   位置: Processing status  
   当前文本: `Preparing job record...`  
   备注:

16.  
   页面/区域: Home  
   位置: Processing status  
   当前文本: `Checking duplicates...`  
   备注:

17.  
   页面/区域: Home  
   位置: Processing status  
   当前文本: `Parsing pasted job text...`  
   备注: 仅 text mode 出现。

18.  
   页面/区域: Home  
   位置: Recent items / eyebrow  
   当前文本: `Active Pool`  
   备注:

19.  
   页面/区域: Home  
   位置: Recent items / title  
   当前文本: `Current working set`  
   备注:

20.  
   页面/区域: Home  
   位置: Recent items / body copy  
   当前文本: `Recent Active records, kept clean, quiet, and easy to scan.`  
   备注: 带有风格感，后续如果你觉得太“写文案”可以再收一点。

21.  
   页面/区域: Home  
   位置: Recent items / empty title  
   当前文本: `No Active records yet`  
   备注:

22.  
   页面/区域: Home  
   位置: Recent items / empty description  
   当前文本: `Saved records will appear here after they are confirmed and added to Active.`  
   备注:

23.  
   页面/区域: Home  
   位置: Daily goals / eyebrow  
   当前文本: `Daily Goals`  
   备注:

24.  
   页面/区域: Home  
   位置: Daily goals / title  
   当前文本: `A quiet progress check-in`  
   备注: 当前语气偏柔和，和主输入区比较一致。

25.  
   页面/区域: Home  
   位置: Daily goals / item label  
   当前文本: `Apply`  
   备注: shared data label。

26.  
   页面/区域: Home  
   位置: Daily goals / item label  
   当前文本: `Connect`  
   备注: shared data label。

27.  
   页面/区域: Home  
   位置: Daily goals / item label  
   当前文本: `Follow`  
   备注: shared data label。

28.  
   页面/区域: Home  
   位置: Daily goals / increment button  
   当前文本: `+1`  
   备注:

29.  
   页面/区域: Home  
   位置: Footer link near daily goals  
   当前文本: `Search log`  
   备注: 和 Search Log 页面标题大小写不一致，可复查。

30.  
   页面/区域: Home  
   位置: Toast  
   当前文本: `Added to Active`  
   备注:

31.  
   页面/区域: Home  
   位置: Toast  
   当前文本: `Missing fields need review`  
   备注: 和 review modal 标题一致，shared。

32.  
   页面/区域: Home  
   位置: Toast  
   当前文本: `Possible duplicate found`  
   备注: 和 duplicate modal 标题一致，shared。

## Home Modals

1.  
   页面/区域: Review modal  
   位置: Dialog / title  
   当前文本: `Missing fields need review`  
   备注: 也被 Home toast 复用，shared。

2.  
   页面/区域: Review modal  
   位置: Dialog / description  
   当前文本: `Some required fields are missing or low confidence. Confirm values before saving to Active.`  
   备注: 信息明确，但偏技术判断口吻。

3.  
   页面/区域: Review modal  
   位置: Top action button  
   当前文本: `Cancel`  
   备注: shared with duplicate modal。

4.  
   页面/区域: Review modal  
   位置: Bottom action button  
   当前文本: `Cancel`  
   备注: shared with duplicate modal。

5.  
   页面/区域: Review modal  
   位置: Bottom action button  
   当前文本: `Save to Active`  
   备注:

6.  
   页面/区域: Review modal  
   位置: Field helper / optional link case  
   当前文本: `Optional when saving pasted job text.`  
   备注:

7.  
   页面/区域: Review modal  
   位置: Field helper / non-issue state  
   当前文本: `Ready to save.`  
   备注:

8.  
   页面/区域: Review modal  
   位置: Field origin fallback  
   当前文本: `missing`  
   备注: 和 `confirmed / derived / manual` 属于同一组 shared extraction labels。

9.  
   页面/区域: Review modal  
   位置: Confidence template  
   当前文本: `Confidence {percent}%`  
   备注: 固定模板片段。

10.  
   页面/区域: Review modal  
   位置: Validation message template  
   当前文本: `{Field Label} is required before saving.`  
   备注: shared validation template。

11.  
   页面/区域: Review modal  
   位置: Validation message template  
   当前文本: `{Field Label} was inferred from the URL and should be reviewed.`  
   备注: shared validation template，偏技术化。

12.  
   页面/区域: Review modal  
   位置: Validation message  
   当前文本: `Role title looks too generic to trust without manual review.`  
   备注:

13.  
   页面/区域: Review modal  
   位置: Validation message  
   当前文本: `Link is not a valid URL.`  
   备注:

14.  
   页面/区域: Review modal  
   位置: Unsupported reason  
   当前文本: `LinkedIn Easy Apply links do not expose enough public detail here. Paste the posting URL with the title slug if possible, or fill the missing fields manually.`  
   备注: 很长，且明显偏实现解释。

15.  
   页面/区域: Review modal  
   位置: Unsupported reason  
   当前文本: `This LinkedIn job link only exposes a numeric job ID, not a readable role/company slug. Manual review is required.`  
   备注:

16.  
   页面/区域: Review modal  
   位置: Unsupported reason  
   当前文本: `LinkedIn pages are restricted, so this link needs manual review.`  
   备注:

17.  
   页面/区域: Review modal  
   位置: Unsupported reason  
   当前文本: `LinkedIn Easy Apply links are restricted. The URL slug provided a few hints, but manual review is still required.`  
   备注:

18.  
   页面/区域: Review modal  
   位置: Unsupported reason  
   当前文本: `LinkedIn pages are restricted, so this link still needs manual review.`  
   备注:

19.  
   页面/区域: Review modal  
   位置: Unsupported reason  
   当前文本: `The job link did not return an HTML page that can be parsed.`  
   备注: 可能偏内部错误语气，但属于可见流程提示。

20.  
   页面/区域: Review modal  
   位置: Unsupported reason  
   当前文本: `The job page is too large to process automatically. Please continue with manual review.`  
   备注: 功能说明清楚，但风格偏系统提示。

21.  
   页面/区域: Duplicate modal  
   位置: Dialog / title  
   当前文本: `Possible duplicate found`  
   备注: 也被 Home toast 复用，shared。

22.  
   页面/区域: Duplicate modal  
   位置: Dialog / description  
   当前文本: `These existing records look similar. Review before adding another Active record.`  
   备注:

23.  
   页面/区域: Duplicate modal  
   位置: Candidate card / link fallback  
   当前文本: `Link not saved`  
   备注: shared with list row variant，但和 detail 页的 fallback 不是同一句。

24.  
   页面/区域: Duplicate modal  
   位置: Candidate card / timestamp template  
   当前文本: `Saved {date}`  
   备注: shared template。

25.  
   页面/区域: Duplicate modal  
   位置: Action button  
   当前文本: `Cancel`  
   备注: shared。

26.  
   页面/区域: Duplicate modal  
   位置: Action button  
   当前文本: `Save anyway`  
   备注:

## Active

1.  
   页面/区域: Active  
   位置: Page eyebrow  
   当前文本: `Search`  
   备注: 这里是 list page eyebrow，不是页面标题。

2.  
   页面/区域: Active  
   位置: Page title  
   当前文本: `Active`  
   备注:

3.  
   页面/区域: Active  
   位置: Page description  
   当前文本: `This is the active-only working pool. It stays focused on current applications, sorted by newest first.`  
   备注:

4.  
   页面/区域: Active  
   位置: Search input / placeholder  
   当前文本: `Search Active records by company or role`  
   备注:

5.  
   页面/区域: Active  
   位置: Search action  
   当前文本: `Search`  
   备注:

6.  
   页面/区域: Active  
   位置: Search action  
   当前文本: `Clear`  
   备注:

7.  
   页面/区域: Active  
   位置: Range text / zero state  
   当前文本: `No records to show`  
   备注: shared list template。

8.  
   页面/区域: Active  
   位置: Range text / non-zero template  
   当前文本: `Showing {start}-{end} of {totalCount} records`  
   备注: shared list template。

9.  
   页面/区域: Active  
   位置: Empty state / title  
   当前文本: `No matching Active records`  
   备注:

10.  
   页面/区域: Active  
   位置: Empty state / description  
   当前文本: `Try another company or role title in Active records.`  
   备注:

11.  
   页面/区域: Active  
   位置: Pagination template  
   当前文本: `Page {page} of {totalPages}`  
   备注: shared with Rejected。

12.  
   页面/区域: Active  
   位置: Pagination action  
   当前文本: `Previous`  
   备注: shared with Rejected。

13.  
   页面/区域: Active  
   位置: Pagination action  
   当前文本: `Next`  
   备注: shared with Rejected。

14.  
   页面/区域: Active  
   位置: Shared row copy reference  
   当前文本: `See Shared UI Copy -> Job record row`  
   备注: 不重复展开 row 内固定标签。

## Active Detail

1.  
   页面/区域: Active detail  
   位置: Panel eyebrow  
   当前文本: `Record`  
   备注:

2.  
   页面/区域: Active detail  
   位置: Danger button  
   当前文本: `Delete record`  
   备注:

3.  
   页面/区域: Active detail  
   位置: Delete confirmation  
   当前文本: `Delete this job record permanently? This cannot be undone.`  
   备注:

4.  
   页面/区域: Active detail  
   位置: Field label  
   当前文本: `Role Title`  
   备注: shared field label。

5.  
   页面/区域: Active detail  
   位置: Field label  
   当前文本: `Company`  
   备注: shared field label。

6.  
   页面/区域: Active detail  
   位置: Field label  
   当前文本: `Location`  
   备注: shared field label。

7.  
   页面/区域: Active detail  
   位置: Field label  
   当前文本: `Source`  
   备注:

8.  
   页面/区域: Active detail  
   位置: Field value fallback  
   当前文本: `Source not confirmed`  
   备注: shared extraction label。

9.  
   页面/区域: Active detail  
   位置: Field label  
   当前文本: `Timestamp`  
   备注:

10.  
   页面/区域: Active detail  
   位置: Field label  
   当前文本: `Search Cycle`  
   备注:

11.  
   页面/区域: Active detail  
   位置: Field value fallback  
   当前文本: `Not assigned`  
   备注:

12.  
   页面/区域: Active detail  
   位置: Field label  
   当前文本: `Link`  
   备注: shared field label。

13.  
   页面/区域: Active detail  
   位置: Link fallback  
   当前文本: `Link not saved for this record.`  
   备注: 和 list row / duplicate modal 版本不同。

14.  
   页面/区域: Active detail  
   位置: Section eyebrow  
   当前文本: `Job Description`  
   备注: shared field label。

15.  
   页面/区域: Active detail  
   位置: Section eyebrow  
   当前文本: `Comments`  
   备注:

16.  
   页面/区域: Active detail  
   位置: Comments helper  
   当前文本: `Add progress notes here: interviews, OA, follow-up, or recruiter updates.`  
   备注:

18.  
   页面/区域: Active detail  
   位置: Comments placeholder  
   当前文本: `Add a progress note...`  
   备注:

19.  
   页面/区域: Active detail  
   位置: Toast  
   当前文本: `Delete failed`  
   备注:

20.  
   页面/区域: Active detail  
   位置: Toast  
   当前文本: `Record deleted`  
   备注:

21.  
   页面/区域: Active detail  
   位置: Toast  
   当前文本: `Comments not saved`  
   备注:

22.  
   页面/区域: Active detail  
   位置: Toast  
   当前文本: `Comments saved`  
   备注:

23.  
   页面/区域: Active detail  
   位置: Not-found state / title  
   当前文本: `Active record not found`  
   备注:

24.  
   页面/区域: Active detail  
   位置: Not-found state / description  
   当前文本: `This record may have been archived or deleted.`  
   备注:

25.  
   页面/区域: Active detail  
   位置: Not-found state / action  
   当前文本: `Back to Active`  
   备注:

## Rejected

1.  
   页面/区域: Rejected  
   位置: Page eyebrow  
   当前文本: `Records`  
   备注:

2.  
   页面/区域: Rejected  
   位置: Page title  
   当前文本: `Rejected`  
   备注:

3.  
   页面/区域: Rejected  
   位置: Page description  
   当前文本: `Rejected records are archived here, outside your active queue.`  
   备注:

4.  
   页面/区域: Rejected  
   位置: Empty state / title  
   当前文本: `No records yet`  
   备注:

5.  
   页面/区域: Rejected  
   位置: Empty state / description  
   当前文本: `No records in this list yet.`  
   备注:

6.  
   页面/区域: Rejected  
   位置: Shared list copy reference  
   当前文本: `See Shared UI Copy -> List and pagination templates`  
   备注:

7.  
   页面/区域: Rejected  
   位置: Shared row copy reference  
   当前文本: `See Shared UI Copy -> Job record row`  
   备注:

## Update by Email

1.  
   页面/区域: Update by Email  
   位置: Left panel / eyebrow  
   当前文本: `Rejection Email`  
   备注:

2.  
   页面/区域: Update by Email  
   位置: Left panel / title  
   当前文本: `Match a rejection email to the right Active record`  
   备注:

3.  
   页面/区域: Update by Email  
   位置: Left panel / body copy  
   当前文本: `Paste a rejection email or a job title + company query, then archive the correct Active record manually.`  
   备注: 功能说明准确，但有点像操作说明。

4.  
   页面/区域: Update by Email  
   位置: Textarea / placeholder  
   当前文本: `Paste a rejection email or job title + company...`  
   备注:

5.  
   页面/区域: Update by Email  
   位置: Textarea / helper  
   当前文本: `Press Enter to find matches. Use Shift+Enter for a new line.`  
   备注:

6.  
   页面/区域: Update by Email  
   位置: Right panel / eyebrow  
   当前文本: `Likely Matches`  
   备注:

7.  
   页面/区域: Update by Email  
   位置: Empty state / title  
   当前文本: `No Active records to match yet`  
   备注:

8.  
   页面/区域: Update by Email  
   位置: Empty state / description  
   当前文本: `Save a few Active records first, then return to archive rejections.`  
   备注:

9.  
   页面/区域: Update by Email  
   位置: Empty state / title  
   当前文本: `No likely matches yet`  
   备注:

10.  
   页面/区域: Update by Email  
   位置: Empty state / description  
   当前文本: `Paste a rejection email or title/company query, then press Enter to see likely matches.`  
   备注:

11.  
   页面/区域: Update by Email  
   位置: Match card / timestamp template  
   当前文本: `Saved {date}`  
   备注: shared template。

12.  
   页面/区域: Update by Email  
   位置: Match card / action  
   当前文本: `Archive to Rejected`  
   备注:

13.  
   页面/区域: Update by Email  
   位置: Toast  
   当前文本: `Archive could not be completed`  
   备注:

14.  
   页面/区域: Update by Email  
   位置: Toast  
   当前文本: `Moved to Rejected`  
   备注:

## Search Log

1.  
   页面/区域: Search log  
   位置: Page eyebrow  
   当前文本: `Search Log`  
   备注: 和 Home link `Search log` 大小写不一致。

2.  
   页面/区域: Search log  
   位置: Page title  
   当前文本: `Job search cycles, captured as fixed snapshots`  
   备注:

3.  
   页面/区域: Search log  
   位置: Intro body copy  
   当前文本: `Each search cycle can live here as its own recorded run, with a short note on goals and one attached summary image.`  
   备注:

4.  
   页面/区域: Search log  
   位置: Side note  
   当前文本: `One search cycle at a time. Add the next one when a new job hunt begins.`  
   备注:

5.  
   页面/区域: Search log  
   位置: Cycle label  
   当前文本: `Search 01`  
   备注: shared search cycle label。

6.  
   页面/区域: Search log  
   位置: Cycle title  
   当前文本: `First full-time search after graduation`  
   备注:

7.  
   页面/区域: Search log  
   位置: Cycle period  
   当前文本: `Sep 6, 2025 ~ April 2, 2026`  
   备注: 已和 search cycle cutoff 对齐。

8.  
   页面/区域: Search log  
   位置: Section eyebrow  
   当前文本: `Main goals`  
   备注:

9.  
   页面/区域: Search log  
   位置: Goal item  
   当前文本: `Find a job`  
   备注:

10.  
   页面/区域: Search log  
   位置: Goal item  
   当前文本: `Keep some data analysis content in the role`  
   备注:

11.  
   页面/区域: Search log  
   位置: Section eyebrow  
   当前文本: `Search stance`  
   备注:

12.  
   页面/区域: Search log  
   位置: Search stance body copy  
   当前文本: `Because this was the first post-graduation search, the scope stayed intentionally broad. The priority was to land a solid full-time role, ideally with some analytics content, without over-optimizing for a perfect match.`  
   备注: 这句已经比较贴近你现在对这段找工的描述。

13.  
   页面/区域: Search log  
   位置: Snapshot section / eyebrow  
   当前文本: `Snapshot`  
   备注:

14.  
   页面/区域: Search log  
   位置: Snapshot section / title  
   当前文本: `Search 01 summary image`  
   备注:

15.  
   页面/区域: Search log  
   位置: Snapshot image alt  
   当前文本: `First job search cycle summary from September 6, 2025 through April 2, 2026`  
   备注:

## Shared UI Copy

1.  
   页面/区域: Shared / job record row  
   位置: Field label  
   当前文本: `Role Title`  
   备注: 用于 list row。

2.  
   页面/区域: Shared / job record row  
   位置: Fallback value  
   当前文本: `Role title not extracted`  
   备注:

3.  
   页面/区域: Shared / job record row  
   位置: Extraction label  
   当前文本: `Source not confirmed`  
   备注: 详情页也复用。

4.  
   页面/区域: Shared / job record row  
   位置: Extraction label template  
   当前文本: `Reviewed manually · {sourceType}`  
   备注:

5.  
   页面/区域: Shared / job record row  
   位置: Extraction label template  
   当前文本: `Confirmed · {sourceType}`  
   备注:

6.  
   页面/区域: Shared / job record row  
   位置: Field label  
   当前文本: `Link`  
   备注: 详情页也复用字段名。

7.  
   页面/区域: Shared / job record row  
   位置: Fallback value  
   当前文本: `Link not saved`  
   备注: list row / duplicate modal 版本。

8.  
   页面/区域: Shared / job record row  
   位置: Field label  
   当前文本: `Company`  
   备注:

9.  
   页面/区域: Shared / job record row  
   位置: Field label  
   当前文本: `Location`  
   备注:

10.  
   页面/区域: Shared / job record row  
   位置: Timestamp template  
   当前文本: `Saved {date}`  
   备注: duplicate modal 和 Update by Email 也复用。

11.  
   页面/区域: Shared / job record row  
   位置: Field label  
   当前文本: `Job Description`  
   备注: 详情页 section 也复用。

12.  
   页面/区域: Shared / list view  
   位置: Range template  
   当前文本: `No records to show`  
   备注: Active / Rejected 共用。

13.  
   页面/区域: Shared / list view  
   位置: Range template  
   当前文本: `Showing {start}-{end} of {totalCount} records`  
   备注:

14.  
   页面/区域: Shared / list view  
   位置: Pagination template  
   当前文本: `Page {page} of {totalPages}`  
   备注:

15.  
   页面/区域: Shared / list view  
   位置: Pagination action  
   当前文本: `Previous`  
   备注:

16.  
   页面/区域: Shared / list view  
   位置: Pagination action  
   当前文本: `Next`  
   备注:

17.  
   页面/区域: Shared / review field labels  
   位置: Field label  
   当前文本: `Role Title`  
   备注: Review modal / detail panel 共用字段术语。

18.  
   页面/区域: Shared / review field labels  
   位置: Field label  
   当前文本: `Company`  
   备注:

19.  
   页面/区域: Shared / review field labels  
   位置: Field label  
   当前文本: `Location`  
   备注:

20.  
   页面/区域: Shared / review field labels  
   位置: Field label  
   当前文本: `Link`  
   备注:

21.  
   页面/区域: Shared / review field labels  
   位置: Field label  
   当前文本: `Job Description`  
   备注:

22.  
   页面/区域: Shared / extraction field origin  
   位置: Origin label  
   当前文本: `confirmed`  
   备注: 小写显示，和页面其他文案风格略不一致。

23.  
   页面/区域: Shared / extraction field origin  
   位置: Origin label  
   当前文本: `derived`  
   备注: 小写显示，且偏实现术语。

24.  
   页面/区域: Shared / extraction field origin  
   位置: Origin label  
   当前文本: `manual`  
   备注: 小写显示，且偏实现术语。

25.  
   页面/区域: Shared / extraction field origin  
   位置: Origin label  
   当前文本: `missing`  
   备注: 小写显示，且偏实现术语。

26.  
   页面/区域: Shared / search cycle labels  
   位置: Label  
   当前文本: `Search 01`  
   备注: Search log / detail field 可能出现。

27.  
   页面/区域: Shared / search cycle labels  
   位置: Label  
   当前文本: `Search 02`  
   备注: 目前主要用于新记录 detail field。

## Suggested Focus Areas For Review

1. 文案里几处大小写不完全一致：`Search Log` vs `Search log`。  
2. Review modal 里的 `confirmed / derived / manual / missing` 更像内部实现词，值得优先复查。  
3. 几条 LinkedIn / extraction warning 很长，信息完整，但读起来偏系统提示。  
4. Home 主输入区和 Search log 的语气目前都比较稳定，改的时候可以优先保住这种克制风格。  
5. `Update by Email` 一组文案功能性最强，后续如果要统一语气，这页值得单独收一轮。
