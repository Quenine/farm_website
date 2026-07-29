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
- Hardened channel insertion so uniqueness conflicts cannot leave a new prospect
  without channels; concurrent exact identities are requeried deterministically.
- Added atomic qualification persistence and its `scout_scored` activity.

## Persistence contract

- `capture_sales_scout_candidate(jsonb,text,uuid,uuid)` requires an actor and an
  explicit `create_new` or `attach_to_existing` resolution.
- Exact identity matches return the existing prospect without mutation.
- Attaching adds only non-conflicting channels and preserves all existing prospect
  qualification, pipeline, suppression, and handover state.
- New captures create an identified/new prospect, normalized channels, deterministic
  score provenance, and one Sales Scout activity in a single transaction.
- New captures use the `scout_captured` event; attachments use `candidate_attached`.
- `update_sales_scout_qualification_facts(jsonb,uuid)` locks and validates the Scout
  prospect, preserves pipeline/suppression/handover state, updates qualification
  fields, and records `scout_scored` in one transaction.
- Capture never creates outreach and does not touch orders, payments, or inventory.

## Configuration

- Shields example configuration enables `SALES_SCOUT_ENABLED` and uses the official
  WhatsApp/business number `+2347032821293`.
- The guard remains closed unless both the private flag and an exact Shields Farms
  canonical hostname match. Noble Farms is therefore excluded.

## Verification boundary

- `database/verify-sales-scout-ingestion.sql` is rollback-only and now checks both
  functions, score shape, campaign integrity, capture conflicts, state-preserving
  attachment and qualification, activities, and absence of outreach/attribution.
- PostgreSQL verification was not executed by Codex; it still requires the approved
  database application workflow.
- Migration `00200` has not been applied remotely.

## Deferred

- No admin UI, automated discovery provider, outbound messaging, scraping,
  attribution automation, or commerce behavior is included.
