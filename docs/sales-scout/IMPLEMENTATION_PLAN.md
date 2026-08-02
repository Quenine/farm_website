# Shields Farms Sales Scout — Implementation Plan

This plan is dependency-ordered. Each batch is intentionally deployable and verifiable independently. File names are expected areas, not a commitment to exact naming. Database changes must be repeat-safe and applied only to the Shields Farms Supabase project after backup and review.

Execution-order update: after Batch 2 persistence, implement the discovery-provider contract and first approved adapter next, before UI workflow batches. The former Batch 8 section remains the detailed scope but is executed immediately after the persistence foundation.

## Batch 0 — Architecture decision record and rollout guard

### Scope

- Confirm Sales Scout is Shields-only and owner-only for MVP.
- Confirm canonical status names, score threshold/rule version, and whether feature availability is controlled by a server-side environment flag or deployment identity.
- Confirm the production Shields database has the existing marketing prospect/activity migrations applied.
- Decide the forward-migration/baseline update convention before editing SQL.

### Expected areas

- No application behavior required.
- Future configuration may touch `.env.shields.example` and `src/config/site.ts`.
- Database inspection uses existing `database/verify-marketing-*.sql` patterns.

### Acceptance criteria

- Written decisions exist for feature enablement, migration convention, and actual database starting state.
- Noble Farms remains disabled and data-isolated.
- No credentials or production data are committed.

### Verification

```powershell
npm run marketing:checks
```

Run the applicable existing marketing verification SQL manually in the Shields Supabase SQL editor and retain its output. Do not claim this check unless it was actually run.

### Rollback

- No runtime change. Revert only the decision/config documentation if the rollout choice changes.

## Batch 1 — Pure domain rules

### Scope

- Add typed constants and pure functions for scout, outreach, and handover statuses.
- Implement Nigerian phone, social handle, email, website, and business-name normalization.
- Implement deterministic `ng-city-b2b-v1` scoring and eligibility using caller-supplied campaign city and country.
- Implement follow-up due-date and attempt-cap policy.
- Unit-test boundary cases without database access.

### Expected areas

- `src/lib/sales-scout/domain.ts`
- `src/lib/sales-scout/normalization.ts`
- `src/lib/sales-scout/scoring.ts`
- `src/lib/sales-scout/follow-ups.ts`
- `tests/sales-scout-domain.test.mjs` or the repository’s chosen TypeScript test approach
- `package.json` only if adding a script that uses already-installed tooling; no new dependency is needed

### Acceptance criteria

- Same facts always produce the same score and factor breakdown.
- Score is clamped 0–100 and qualification prerequisites are enforced.
- Normalizers cover Instagram/profile URLs and Nigerian local/international phone forms.
- Follow-up 1/2 dates and maximum attempt count are deterministic.
- Do-not-contact eligibility overrides score and status.

### Verification

```powershell
node --test tests/sales-scout-domain.test.mjs
npm run lint
npx tsc --noEmit
```

### Rollback

- Pure unused modules can be removed with no database or behavior impact.

## Batch 2 — Persistence foundation

### Scope

- Extend `marketing_prospects` with scout, score, geography, suppression, provenance, and handover fields.
- Add one-to-one `marketing_sales_scout_campaigns` configuration keyed by the existing generic `marketing_campaigns` identity; do not add Scout-only lifecycle fields to the shared campaign table.
- Create `marketing_prospect_channels`, `marketing_prospect_outreaches`, and `marketing_prospect_attributions`.
- Add indexes, exact unique keys, check constraints, timestamps, RLS/revokes/service-role grants, and comments.
- Extend prospect activity types/metadata for scout events.
- Add atomic database functions for suppression and send confirmation.
- Add repeat-safe SQL verification covering constraints and access posture.

### Expected areas

- New dated SQL migration under `database/`
- `database/schema.sql` only according to the Batch 0 migration convention
- New `database/verify-sales-scout-foundation.sql`
- Possibly `src/types/index.ts` if shared database-facing DTOs live there

### Acceptance criteria

- Migration is repeat-safe on an empty baseline-compatible database and on the current Shields schema.
- Browser roles have no direct access to scout data.
- Exact duplicate channel identity cannot be inserted twice.
- A suppressed prospect cannot be transitioned to a sent outreach by the atomic function.
- A prospect can link to multiple orders; the same prospect/order link is unique.
- Existing marketing, order, payment, inventory, and delivery records are unchanged.

### Verification

```powershell
npm run lint
npx tsc --noEmit
npm run marketing:checks
```

Run `database/verify-sales-scout-foundation.sql` in a non-production Supabase project, then in Shields production only after backup/change approval.

### Rollback

- Prefer a forward corrective migration after shared deployment.
- Before production rollout, rollback may drop only the newly created empty tables/columns/functions after confirming no Sales Scout data exists.
- Never cascade-drop existing `marketing_prospects`, activities, orders, or campaigns.

## Batch 3 — Guarded data service and manual capture

### Scope

- Add a `server-only` Sales Scout data layer with explicit DTOs.
- Add Zod schemas and guarded Server Actions for candidate capture/update.
- Implement exact duplicate blocking and soft-match warnings with explicit resolution.
- Create/reuse/merge records while preserving suppression and existing activity history.
- Add source provenance and score recomputation on qualification-fact changes.

### Expected areas

- `src/lib/sales-scout/server.ts`
- `src/lib/sales-scout/schemas.ts`
- `app/admin/(protected)/marketing/sales-scout/actions.ts`
- Tests for actions/service functions using the existing verification style

### Acceptance criteria

- Every read/mutation performs `requireAdmin`.
- Only explicit DTO fields cross the Server/Client boundary.
- Exact duplicates cannot create a second prospect/channel.
- Soft matches require a recorded keep/merge decision.
- Merge never removes do-not-contact and retains material history.
- No outreach is sent or simulated.

### Verification

```powershell
npm run lint
npx tsc --noEmit
npm run marketing:checks
npm run build
```

### Rollback

- Remove routes/actions/service while retaining schema and captured records.
- Disable through the approved Shields-only rollout guard; do not delete prospect data.

## Batch 4 — Protected queue and prospect detail UI

### Scope

- Add Sales Scout to `MarketingNav`.
- Build server-rendered queue with city/category/status/source/score/follow-up filters.
- Build create/review/detail pages using existing admin components.
- Show score factor breakdown, duplicate warnings, sources/evidence, existing pipeline stage, scout status, handover, timeline, and suppression state.
- Add small client islands only for interaction.

### Expected areas

- `src/components/marketing-command-ui.tsx`
- `app/admin/(protected)/marketing/sales-scout/page.tsx`
- `app/admin/(protected)/marketing/sales-scout/new/page.tsx`
- `app/admin/(protected)/marketing/sales-scout/[id]/page.tsx`
- `src/components/sales-scout/*`
- `tests/browser/sales-scout-capture.spec.ts`

### Acceptance criteria

- Signed-out access redirects to admin login.
- Only Shields-enabled admin sees the navigation/route.
- Lagos and five-category defaults are visible but stored data is filterable.
- Capture, review, qualification, disqualification, and suppression work with accessible form feedback.
- Existing `/admin/marketing/prospects` continues to work unchanged.

### Verification

```powershell
npm run lint
npx tsc --noEmit
npm run build
npx playwright test tests/browser/sales-scout-capture.spec.ts
```

### Rollback

- Remove the nav entry and route pages or disable the rollout guard.
- Keep persisted records accessible through existing prospect administration where compatible.

## Batch 5 — Draft, approve, and manual-send workflow

### Scope

- Add draft creation/editing with required personalization facts and delivery caveat.
- Add human approval and cancellation.
- Add copy-to-clipboard/open-public-profile controls.
- Add explicit confirm-send form capturing actual final text, sender label, timestamp, and optional reference.
- Atomically enforce status order, frequency cap, and do-not-contact.

### Expected areas

- Sales Scout actions/service and detail page
- `src/components/sales-scout/outreach-editor.tsx`
- Database function/verification updates if gaps emerge
- `tests/browser/sales-scout-manual-outreach.spec.ts`

### Acceptance criteria

- Copy/open actions do not mark an outreach sent.
- Unapproved drafts cannot be marked sent.
- Suppressed, disqualified, or capped prospects cannot be marked sent even with a forged action request.
- Every sent record contains the final human-confirmed text and actor/timestamp.
- No platform credentials, API sends, browser automation, or delivery claims exist.

### Verification

```powershell
npm run lint
npx tsc --noEmit
npm run build
npx playwright test tests/browser/sales-scout-manual-outreach.spec.ts
```

Run the Sales Scout SQL verification for suppression/send transition cases.

### Rollback

- Disable/remove the outreach UI and actions; retain immutable sent history.
- Do not roll sent records back to drafts.

## Batch 6 — Replies, follow-ups, and handover

### Scope

- Record concise reply summaries, sentiment/commercial signal, and time.
- Generate due tasks (not sends) from deterministic rules.
- Add due/overdue queue and completion/cancellation.
- Add handover readiness, owner acceptance, progress, completion, and decline.
- Map confirmed send/reply/commercial progress to compatible existing prospect stages and activity events.
- Optionally emit existing admin operational notifications for overdue owner work only.

### Expected areas

- Sales Scout service/actions/pages/components
- `src/lib/operational-notifications.ts` only if adding admin reminders
- Database transition functions and verification
- `tests/browser/sales-scout-follow-up-handover.spec.ts`

### Acceptance criteria

- Reply cancels pending no-response follow-ups.
- Exactly two follow-ups maximum can become due.
- Do-not-contact immediately blocks/cancels all outstanding attempts.
- Handover cannot become ready without a recorded commercial signal.
- Existing prospect activity timeline reflects material transitions.
- No notification sends a message to the prospect.

### Verification

```powershell
npm run lint
npx tsc --noEmit
npm run build
npx playwright test tests/browser/sales-scout-follow-up-handover.spec.ts
npm run operational:checks
```

### Rollback

- Turn off reminders and workflow UI while preserving reply/handover history.
- Use corrective state transitions with audit events; do not delete historical events.

## Batch 7 — Explicit order linking and verified-paid attribution

### Scope

- Add admin order search/link action with suggested phone/email matches but explicit confirmation.
- Upsert paid attribution after the existing verified Paystack processor succeeds.
- Add idempotent reconciliation for links created after payment or missed post-payment updates.
- Report attributed paid orders/revenue alongside, but separate from, existing first/last-touch campaign attribution.
- Mark scout `converted` only from authoritative paid state.

### Expected areas

- `src/lib/sales-scout/attribution.ts`
- Sales Scout actions/detail/reporting
- `src/lib/payments.ts` or the narrow callback/webhook post-success integration point
- `app/api/paystack/webhook/route.ts` and callback path only if required
- New attribution verification SQL/script
- Marketing overview reporting only after definitions are agreed

### Acceptance criteria

- Linking an unpaid order does not count revenue or conversion.
- Repeated webhook/callback/reconciliation calls create one attribution per prospect/order and do not affect inventory idempotency.
- Paid amount equals authoritative `orders.total_amount`; paid time is supported by a paid payment record.
- Existing web first/last-touch JSON remains unchanged.
- One prospect can have multiple paid orders and one order cannot be accidentally double-linked to the same prospect.
- Reports clearly label attribution as explicit/manual operational attribution.

### Verification

```powershell
npm run lint
npx tsc --noEmit
npm run build
npm run marketing:checks
```

Run the existing Paystack/payment idempotency checks available for the target environment plus the new Sales Scout attribution verification. Do not use live payments for routine verification.

### Rollback

- Remove the post-payment attribution hook and reporting first.
- Keep link/history rows; mark incorrect rows `invalidated` rather than deleting them.
- Do not modify or reverse payment/inventory data as part of Sales Scout rollback.

## Batch 8 — Discovery provider contract and manual import

### Scope

- Add the provider interface and `manual` adapter only.
- Support a bounded CSV/manual candidate import if operationally justified, using the same validation/dedupe/review path.
- Add provenance, cursor/error DTOs, and contract tests.
- Document the approval checklist for any future Google/social provider.

### Expected areas

- `src/lib/sales-scout/discovery/types.ts`
- `src/lib/sales-scout/discovery/manual.ts`
- Optional protected import action/UI
- Provider contract tests
- No new SDK or dependency

### Acceptance criteria

- Provider candidates cannot bypass validation, dedupe, scoring, or human review.
- Every candidate retains provider/source URL and observed timestamp.
- Invalid rows fail safely with row-level feedback.
- No automated scraping, credential automation, CAPTCHA bypass, or social messaging exists.

### Verification

```powershell
npm run lint
npx tsc --noEmit
npm run build
node --test tests/sales-scout-discovery.test.mjs
```

### Rollback

- Remove/disable the import adapter and UI. Retain already accepted prospects and provenance.

## Batch 9 — End-to-end hardening and release

### Scope

- Add complete browser journey and forged-action authorization/suppression tests.
- Verify responsive/accessibility behavior and no-index/admin protections.
- Validate reporting definitions against seeded non-production data.
- Run Shields-only release checklist and production smoke test.

### Expected areas

- `tests/browser/sales-scout-e2e.spec.ts`
- Sales Scout verification script/SQL
- Existing Shields deployment/runbook references; avoid duplicating generic deployment documentation

### Acceptance criteria

- Capture → qualify → approve → manual-send confirm → reply → handover → order link → verified-paid attribution passes in a non-production environment.
- Signed-out and non-owner mutation attempts fail.
- Suppression and frequency cap resist direct action calls.
- Noble deployment does not expose the module.
- No application behavior outside the protected marketing module and narrow post-payment attribution hook regresses.

### Verification

```powershell
npm run lint
npx tsc --noEmit
npm run build
npm run marketing:checks
npm run operational:checks
npx playwright test
```

Run new SQL verification in the target Shields environment and record the result separately.

### Rollback

- Disable the rollout guard and remove the navigation entry.
- Remove the post-payment hook while leaving the schema/history intact.
- Prefer forward fixes for persisted production data; never roll back commerce, payment, or inventory transactions to undo Sales Scout.

## Recommended first implementation batch

After the planning-only run, start with **Batch 0**, then **Batch 1**. Batch 0 resolves the only deployment/schema assumptions that could make later work unsafe. Batch 1 proves the scoring, normalization, duplicate keys, and follow-up policy as pure code before any migration or UI commitment.


### Batch 4A correction note

Migration `00300` separates generic `campaign_id` from authoritative `scout_campaign_id` and supports in-place legacy CRM enrollment and exact-match channel enrichment. It remains unapplied. PostgreSQL behavioral verification and the production rollback dry-run review remain required before application.

## Batch 5
Discovery provider adapter, staged candidate review, duplicate checks, and guarded admin entry are dependency-ordered before any later outreach work.

## Batch 5A correction
Apply and rollback-test discovery persistence before Batch 5B adds the guarded application service and review UI.

The discovery migration requires a PostgreSQL rollback dry run with synthetic behavioural fixtures before Batch 5B services/UI.

## Batch 5B implemented
Guarded run orchestration, paginated staged review, server-side preview/capture, dismissal, and admin routes are implemented behind the disabled discovery flag.
## Batch 6A — provider-neutral nationwide research evaluation

Evaluate Geoapify, Tavily, and controlled official-website research against a configurable Nigerian territory/category matrix before changing production persistence. Fixture mode is mandatory for routine verification; live mode is explicitly confirmed, bounded, and writes only ignored local artifacts. Acceptance requires evidence-backed contacts, deterministic deduplication, no fabricated facts, no production writes, and documented pilot thresholds. A later batch may propose production integration only after reviewed live evaluation results.

## Batch 6B delivery and rollout

Implementation is complete for review in these independently verifiable slices: (1) additive repeat-safe schema/RPC migration and SQL safety artifacts; (2) nationwide campaign validation/UI; (3) seed-first production orchestration and persistence; (4) candidate contact-confidence/detail/capture workflow; (5) deterministic manual outreach, follow-up, outcomes, and suppression; (6) offline tests/static audits; (7) owner runbook. Deployment remains a separate controlled operation: run preflight, rollback rehearsal, apply and verify twice in non-production, configure server-only Shields variables, deploy Shields only, and complete the bounded limit-5 smoke test. Roll back application code first if needed and preserve new evidence before any approved schema reversal.