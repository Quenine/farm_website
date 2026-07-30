# Sales Scout Batch 4

## Delivered

- Owner-reported Batch 3 production validation is recorded in `BATCH-3.md`.
- Sales Scout database migrations are owner-reported as present in Shields production; Batch 4C made no SQL changes.
- Generic `campaign_id` remains untouched; nullable `scout_campaign_id` is authoritative for Sales Scout and is backfilled only from valid Scout campaign extensions.
- Existing CRM records can be enrolled without fragmenting commercial history, and exact matches can enrich the existing record with genuinely new public channels.
- Added an atomic, service-role-only review transition with persisted qualification guards and audited status changes.
- Added rollback-only SQL verification for review transitions and preservation.
- Added a protected campaign queue with database filters, pagination, summary cards, campaign controls, bounded channel loading, and explicit DTOs.
- Added guided manual candidate entry with 1–5 public channel rows, normalization, duplicate/score preview, and explicit create-or-attach resolution.
- Added protected prospect detail with score factors, qualification failures, evidence editor, review decisions, do-not-contact, channels, and safe timeline.
- Added guarded Sales Scout navigation only when the private flag and exact Shields deployment policy both pass.
- Added focused schema/pure-logic tests and a guarded Playwright admin fixture spec.
- Candidate capture now validates create/attach resolution against the freshly rerun server preview before invoking SQL.
- Replaced raw preview JSON with structured candidate, channel, qualification, exact-match, and soft-match sections.
- Observation time initializes from browser-local time after mount; request tokens prevent stale asynchronous previews from restoring capture controls.
- Rollback-only SQL verification now checks all three migration functions consistently and proves genuine campaign separation/conflict behavior with exact messages.
- Added an explicit campaign-activation first-use flow: inactive campaigns no longer expose a dead Add candidate link.
- Campaign controls now use action-oriented labels, show current status, confirm completion, return feedback, and refresh affected routes immediately.
- Candidate setup lists configured campaigns when none is active and supports Activate and continue/Reactivate campaign without navigating in circles.
- Active queue links preserve campaign selection in the candidate form; activation remains manual and starts neither discovery nor outreach.

## Boundaries

- No social outreach was sent or implemented.
- No automated discovery was performed.
- No order attribution was added.
- Batch 4C did not add or modify SQL and ran no database commands.
- Vercel environment settings were not changed.
- Browser tests requiring authenticated local Supabase data remain guarded unless `SALES_SCOUT_BROWSER_FIXTURE=true` is configured against a non-production fixture.

## Verification

- Sales Scout checks: 31 passed; marketing checks, scoped ESLint, TypeScript,
  production build, static SQL audit, migration parity, and diff check passed.
- The targeted Playwright run was not executed: `SALES_SCOUT_BROWSER_FIXTURE` and `SALES_SCOUT_BROWSER_DRAFT_FIXTURE` were not configured. The authenticated cases remain guarded for a non-production fixture.
- PostgreSQL behavioural verification remains pending; static inspection and rollback-only SQL fixtures are not execution against PostgreSQL.

## Next batch

- Draft, approve, copy/open-profile, and explicitly confirm the manual-send workflow without automated social sending.
