# Product overview

Job Search Operating Desk turns messy job links, copied job text, uncertain extraction results, follow-up notes, and rejection emails into one focused personal workflow. It is built for one user: the job seeker.

## Why it exists

Personal job tracking wastes time on repetitive, messy work. This project is a quieter and more practical workspace: it supports imperfect input, keeps the active pool focused, and stays honest when data is incomplete.

## Highlights

- Paste a job link or copied job text
- Handle LinkedIn-style input realistically
- Review incomplete records instead of inventing fields
- Search the current Active working set and keep Rejected records separate
- Track stage and follow-up notes on each application
- Match rejection emails back to Active jobs
- Compare application outcomes by search cycle with a Sankey flow
- Preserve each completed search as a note plus a fixed summary image
- Track daily Apply / Connect / Follow counts

## Key workflows

### Capture from a job link

Paste a link and press Enter. The app detects the likely source, attempts extraction, validates required fields, checks for duplicates, and only saves to Active when the record is complete enough.

### Capture from pasted job text

Paste copied job text and press Enter. This is useful for LinkedIn Easy Apply, recruiter-shared descriptions, and postings where the original link is noisy or not worth storing. The `Link` field may remain empty in this flow.

### Review uncertain records

If required fields are missing or extraction confidence is low, the app pauses for manual review instead of pretending extraction succeeded.

### Manage the working set

Active records are searchable by company or role. Each record keeps its source, search cycle, stage, job description, and follow-up notes together. Rejected applications live in a separate archive.

### Update from a rejection email

Paste rejection email text or a `job title + company` query to find the most likely Active records and move the correct one into Rejected.

### Record a search cycle

The Search Log compares saved outcomes by cycle, then preserves the context behind each completed search with its goals, approach, interviewed companies, and one fixed summary image.

## Design principles

- The interface should never look more certain than the underlying data
- Extraction stays conservative and may route to manual review
- LinkedIn-style sources are handled realistically, not as fake scraping
- Search Log analytics come from saved records while the narrative snapshot remains fixed

## Daily goals

`Apply` resets on `America/New_York` midnight boundaries. New Active records automatically increment `Apply`, while `Connect` and `Follow` are updated manually.
