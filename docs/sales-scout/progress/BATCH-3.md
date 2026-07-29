# Sales Scout Batch 3

## Scope completed

- Added a server-only, Shields-only rollout guard using `SALES_SCOUT_ENABLED`
  and the canonical site hostname.
- Added strict discovery candidate, duplicate-resolution, and qualification schemas.
- Added a network-free manual discovery provider behind a provider interface.
- Added deterministic normalization, exact lookup keys, soft duplicate warnings,
  campaign-aware score previews, and explicit duplicate resolution.
- Added authenticated server services and narrow Server Actions for campaign reads,
  preview, transactional capture, and qualification fact updates.
- Added one repeat-safe ingestion RPC migration and reconciled it into the baseline.

## Persistence contract

- `capture_sales_scout_candidate(jsonb,text,uuid,uuid)` requires an actor and an
  explicit `create_new` or `attach_to_existing` resolution.
- Exact identity matches return the existing prospect without mutation.
- Attaching adds only non-conflicting channels and preserves all existing prospect
  qualification, pipeline, suppression, and handover state.
- New captures create an identified/new prospect, normalized channels, deterministic
  score provenance, and one Sales Scout activity in a single transaction.
- Capture never creates outreach and does not touch orders, payments, or inventory.

## Configuration

- Shields example configuration enables `SALES_SCOUT_ENABLED` and uses the official
  WhatsApp/business number `+2347032821293`.
- The guard remains closed unless both the private flag and an exact Shields Farms
  canonical hostname match. Noble Farms is therefore excluded.

## Verification boundary

- `database/verify-sales-scout-ingestion.sql` is rollback-only and checks privileges,
  actor enforcement, create, exact-repeat, attach preservation, channels, and the
  absence of outreach side effects.
- PostgreSQL verification was not executed by Codex; it still requires the approved
  database application workflow.

## Deferred

- No admin UI, automated discovery provider, outbound messaging, scraping,
  attribution automation, or commerce behavior is included.
