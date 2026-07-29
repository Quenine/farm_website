# Sales Scout Batch 1

## Scope completed

- Aligned the plans for generic Nigerian city campaigns and configuration-sourced WhatsApp.
- Added pure status, normalization, scoring, and follow-up domain rules.
- Added dependency-free focused tests and a reusable check command.

## Files changed

- Three Sales Scout planning documents
- `src/lib/sales-scout/{domain,normalization,scoring,follow-ups}.ts`
- `tests/sales-scout-domain.test.ts`
- `package.json`

## Rule version

`ng-city-b2b-v1`, qualification threshold 60.

## Verification

- `npm run sales-scout:checks`: 12 passed, 0 failed.
- Scoped ESLint: passed with 0 errors.
- `npx tsc --noEmit`: passed with 0 errors.
- `git diff --check`: passed; line-ending conversion warnings only.

## Known limitations

- No persistence, UI, feature flag, provider adapter, or runtime integration.
- Social parsing intentionally rejects ambiguous or post-level URLs.
- Phone normalization checks Nigerian mobile structure, not carrier ownership.

## Batch 2 prerequisites

- Verify the actual Shields production schema and take a backup.
- Prepare one dated repeat-safe forward migration and reconcile `database/schema.sql`.
