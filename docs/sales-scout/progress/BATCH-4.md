# Sales Scout Batch 4

## Delivered

- Owner-reported Batch 3 production validation is recorded in `BATCH-3.md`.
- Added repeat-safe, still-unapplied migration `database/20260730000100_sales_scout_review_workflow.sql`.
- Generic `campaign_id` remains untouched; nullable `scout_campaign_id` is authoritative for Sales Scout and is backfilled only from valid Scout campaign extensions.
- Existing CRM records can be enrolled without fragmenting commercial history, and exact matches can enrich the existing record with genuinely new public channels.
- Added an atomic, service-role-only review transition with persisted qualification guards and audited status changes.
- Added rollback-only SQL verification for review transitions and preservation.
- Added a protected campaign queue with database filters, pagination, summary cards, campaign controls, bounded channel loading, and explicit DTOs.
- Added guided manual candidate entry with 1–5 public channel rows, normalization, duplicate/score preview, and explicit create-or-attach resolution.
- Added protected prospect detail with score factors, qualification failures, evidence editor, review decisions, do-not-contact, channels, and safe timeline.
- Added guarded Sales Scout navigation only when the private flag and exact Shields deployment policy both pass.
- Added focused schema/pure-logic tests and a guarded Playwright admin fixture spec.

## Boundaries

- No social outreach was sent or implemented.
- No automated discovery was performed.
- No order attribution was added.
- Migration `00300` was not applied remotely.
- Vercel environment settings were not changed.
- Browser tests requiring authenticated local Supabase data remain guarded unless `SALES_SCOUT_BROWSER_FIXTURE=true` is configured against a non-production fixture.

## Verification

- Sales Scout checks: 24 passed; marketing checks, scoped ESLint, TypeScript,
  production build, static SQL audit, migration parity, and diff check passed.
- The targeted Playwright run did not execute because the configured web server
  refused to start while another Next.js development server held the workspace lock.
  Authenticated database cases also remain guarded by the documented local fixture.
- PostgreSQL behavioural verification remains pending; static inspection and rollback-only SQL fixtures are not execution against PostgreSQL.

## Next batch

- Draft, approve, copy/open-profile, and explicitly confirm the manual-send workflow without automated social sending.
