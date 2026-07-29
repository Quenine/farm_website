# Sales Scout Batch 2

## Scope completed

- Added the repeat-safe Sales Scout persistence foundation.
- Reconciled the same final structure into `database/schema.sql`.
- Added rollback-only SQL verification and focused architecture/plan corrections.

## Migration

`database/20260729000100_sales_scout_foundation.sql`

## Tables created

- `marketing_sales_scout_campaigns`
- `marketing_prospect_channels`
- `marketing_prospect_outreaches`
- `marketing_prospect_attributions`

## Existing tables extended

- `marketing_prospects`: nullable Scout qualification, geography, provenance, scoring, suppression, handover, and actor fields.
- `marketing_prospect_activities`: non-null JSONB metadata and `sales_scout` activity type.

## Functions

- Replaced the legacy-compatible six-argument `record_marketing_prospect_activity`.
- Added its explicit metadata overload.
- Added `set_sales_scout_do_not_contact`.
- Added `confirm_sales_scout_outreach_sent`.

## Verification

- `npm run sales-scout:checks`: 12 passed, 0 failed.
- `npm run marketing:checks`: passed.
- `npx tsc --noEmit`: passed with 0 errors.
- Static SQL audit and baseline/migration parity check: passed.
- Scoped ESLint: not applicable; Batch 2 changed no TypeScript.
- `git diff --check`: passed; line-ending conversion warnings only.
- `verify-sales-scout-foundation.sql` was not run because no database was contacted.

## Production status

- Migration was not applied remotely.
- Production backup has not been confirmed by Codex.

## Known limitations

- Discovery and UI remain unimplemented.
- No paid-attribution automation exists; commerce behaviour is unchanged.
- SQL behavioural verification still requires a human-run non-production database.

## Next batch prerequisites

- Human review of migration and verification SQL.
- Confirm a backup before any production application.
- Apply and run verification in a non-production Supabase project first.
