# Shields Farms Sales Scout — Architecture

## Repository findings

### Runtime and framework

- Next.js `16.2.9`, React `19.2.4`, TypeScript 5, App Router.
- Next.js pages/layouts are Server Components by default. Interactive islands use `"use client"`.
- Mutations use Server Actions (`"use server"`) with `FormData`, Zod parsing, and `revalidatePath`.
- The local Next.js 16 guides in `node_modules/next/dist/docs/` confirm that Server Actions must be treated as public endpoints and authorization should be checked close to data access, not only in layouts or Proxy.

### Database and data access

- PostgreSQL hosted by Supabase; no separate ORM or generated schema client is present.
- `@supabase/supabase-js` and `@supabase/ssr` are used directly.
- Browser/server session clients use the anon key. Privileged server code uses a server-only service-role client.
- Sensitive operational tables enable RLS, revoke `anon`/`authenticated`, and are accessed through guarded server code; selected atomic workflows use `security definer` PostgreSQL functions restricted to `service_role`.
- Schema history is hand-authored repeat-safe SQL under `database/`; `database/schema.sql` is the baseline and dated SQL files are incremental/reconciliation scripts.

### Authentication and authorization

- Supabase email/password authentication.
- `requireAdmin()` validates the current Supabase user and compares its email with `ADMIN_EMAIL`.
- `proxy.ts` refreshes Supabase sessions and performs an early `/admin` redirect, while protected layout/data/action code performs the authoritative check.
- Current authorization is owner-only, not role-based. Sales Scout should use this unchanged for MVP.

### Admin routes and navigation

- Protected routes live under `app/admin/(protected)/...`; the public login is `app/admin/login`.
- Marketing is a sub-area at `/admin/marketing/*`, with a shared `MarketingNav`.
- The main admin navigation links to Marketing; the marketing sub-navigation links to Overview, Campaigns, Products, Prospects, Content & affiliate, Social, Data quality, and Self-check.
- Sales Scout belongs at `/admin/marketing/sales-scout`, linked from `MarketingNav`, rather than as a new top-level admin or separate application.

### UI, forms, and validation

- Tailwind CSS 4 utility classes, repository-local primitives in `src/components/ui.tsx`, admin shell/header components, `lucide-react`, `clsx`, and `tailwind-merge`.
- There is no external form library. Forms commonly use native inputs, Server Actions, `useActionState`, and occasional `useTransition`.
- Zod 4 schemas validate server inputs. Existing prospect actions already validate UUIDs, stage/activity enums, lengths, email, and numeric values.
- UI should reuse `AdminHeader`, `MarketingNav`, cards/tables/form styling, and existing action-state conventions.

### Tests

- ESLint and TypeScript/Next build through `npm run lint` and `npm run build`.
- Playwright is configured for browser tests under `tests/browser`.
- Existing Node `.mjs` verification scripts cover content, operational, and marketing flows; `npm run marketing:checks` exercises current marketing operations.
- SQL verification scripts under `database/verify-*.sql` are intended for Supabase SQL execution, not automatically run by the local test runner.

### Commerce, CRM, messaging, and analytics reuse

- `orders`, `order_items`, `payments`, and `inventory_movements` support Paystack checkout. Verified payment is processed idempotently and updates `orders.payment_status` to `paid`.
- Orders already store first/last-touch JSON attribution; marketing campaigns/clicks and paid-revenue reporting already exist.
- `marketing_prospects` is the existing lightweight CRM: business/contact fields, stage, requirements, value/frequency, source, campaign, follow-up, inquiry link, and one order link.
- `marketing_prospect_activities` records notes, phone/WhatsApp/email/meeting/proposal/quotation/follow-up/stage events and actor IDs.
- Existing prospect stages are `identified`, `contacted`, `responded`, `requirements_received`, `proposal_sent`, `negotiating`, `trial_order`, `recurring_customer`, `won`, `lost`.
- `contact_inquiries` supports business-supply and export inquiries and can be linked to a prospect.
- `marketing_social_activities` describes published marketing content and aggregate metrics. It is not a one-to-one prospect outreach log and should not be repurposed as one.
- Notifications and email infrastructure exist, but MVP outreach remains manual. Existing operational notifications can later flag due handovers/follow-ups without sending to prospects.
- Deployment conventions target Vercel with a separate Supabase project per brand. Shields and Noble data must remain isolated.

## Lean proposed architecture

Extend the existing Marketing Command Centre rather than build a second CRM:

1. **Sales Scout routes:** Server Component list/detail pages under `/admin/marketing/sales-scout`.
2. **Small client islands:** filters, draft editing, confirmation dialogs, clipboard/open-profile controls, and action feedback.
3. **Sales Scout server module:** a `server-only` data access/service layer that calls `requireAdmin`, selects explicit DTO fields, applies scoring/deduplication/follow-up policies, and uses the existing privileged Supabase client.
4. **Server Actions:** thin Zod-validated commands for capture, qualification, draft approval, send confirmation, reply recording, suppression, handover, follow-up completion, merge, and order linking.
5. **PostgreSQL constraints/functions:** enforce exact identity uniqueness, status/check constraints, do-not-contact gating, attempt limits, and atomic state+audit changes where races matter.
6. **Existing commerce boundary:** attach attribution records to existing orders; observe the authoritative paid state rather than changing payment processing semantics.

Do not add a job queue, workflow engine, vector database, external CRM, background worker, or new dependency for MVP.

## Data model

### Reused entities

- `marketing_campaigns` 1 → many `marketing_prospects`
- `marketing_campaigns` 1 → 0..1 `marketing_sales_scout_campaigns`; the extension stores city, categories, review target, delivery summary, and Scout lifecycle without overloading the generic web/UTM campaign row.
- `contact_inquiries` 0..1 → many/linked prospect workflow (existing optional link)
- `marketing_prospects` 1 → many `marketing_prospect_activities`
- `orders` 1 → many `order_items`; `orders` 1 → many `payments`

### Extensions to `marketing_prospects`

Keep the existing commercial `stage` and add scout-specific facts:

- `scout_status`
- `city`, `country`, `location_evidence`
- `discovery_source`, `discovery_source_id`, `source_url`, `discovered_at`
- normalized `website_host`, `contact_email_normalized`, `contact_phone_normalized`
- `score`, `score_version`, `score_factors` JSONB, `scored_at`
- qualification evidence fields: profile activity date, recurring-demand evidence, demand band
- `do_not_contact_at`, `do_not_contact_reason`, `do_not_contact_source`, `do_not_contact_by`
- `handover_status`, `handover_ready_at`, `handover_accepted_at`, `handover_completed_at`, `handover_reason`
- `created_by`, with existing `created_at`/`updated_at`

Retain existing business/contact/requirements/follow-up/campaign/inquiry fields. The existing single `order_id` may remain for backward compatibility but is not the new attribution source of truth.

### `marketing_prospect_channels`

One prospect can have several public identities.

- `id`, `prospect_id`
- `platform` (`instagram`, `facebook`, `tiktok`, `x`, `youtube`, `website`, `email`, `phone`, `whatsapp`, `other`)
- raw `handle_or_value`, normalized `identity_key`, `profile_url`
- `is_primary`, `is_active`, `verified_at`
- `source`, `source_id`, `evidence`
- timestamps

Unique `(platform, identity_key)` when active/usable. This is the primary exact duplicate key and avoids adding one column per platform.

### `marketing_prospect_outreaches`

One row per actual message attempt/draft:

- `id`, `prospect_id`, `channel_id`
- `sequence_number` (1 initial, 2–3 follow-ups), `kind`
- `status`
- `draft_text`, `approved_text`, `sent_text`
- `personalization_facts` JSONB and `draft_source` (`human` or future assistant)
- `approved_at/by`, `sent_at/by`, `sender_account_label`
- `platform_reference`, `due_at`
- `reply_summary`, `reply_sentiment`, `replied_at`, `recorded_by`
- `cancel_reason`, timestamps

Unique `(prospect_id, channel_id, sequence_number)` prevents duplicate attempts. Database checks plus guarded commands prevent `sent` without approval/final text and prevent sends when suppressed.

### `marketing_prospect_attributions`

Many-to-many, auditable prospect/order association:

- `id`, `prospect_id`, `order_id`
- `relationship` (`sourced`, `influenced`, `manual`)
- `status` (`linked`, `paid`, `invalidated`)
- `linked_at/by`, `paid_at`, `paid_amount`
- `evidence`, `created_at`, `updated_at`
- unique `(prospect_id, order_id)`

The order/payment tables remain authoritative. Snapshot `paid_at` and `paid_amount` only after verified payment for stable reporting, while reconciliation can always compare them with the order/payment source.

### Audit strategy

Extend the existing prospect activity vocabulary for scout state, outreach, suppression, handover, merge, and attribution events, or add a generic `metadata` JSONB column. Prefer the existing timeline over a second generic audit table. Never store platform credentials or raw private inbox content; a concise reply summary and commercial signal are sufficient for MVP.

## Status interaction

- `scout_status` governs discovery/qualification/contact safety.
- Existing `marketing_prospects.stage` governs commercial progress after contact.
- Outreach status belongs to each attempt, not the prospect.
- Handover status belongs to the prospect.
- On confirmed initial send: existing stage may transition from `identified` to `contacted`.
- On recorded substantive reply: stage may transition to `responded`; positive reply also sets scout status `engaged`.
- Requirements/quotation/trial/won progression continues through existing atomic stage functions.
- A verified paid attributed order sets attribution `paid` and scout status `converted`. It does not automatically mark every commercial stage or handover complete without an explicit domain rule.

## Authorization and data protection

- Every page loader and Server Action calls `requireAdmin`; protected layout/Proxy are defense in depth only.
- All scout tables enable RLS and revoke browser roles. Only guarded server-side service-role operations may access them.
- Select explicit columns into DTOs; do not pass entire database rows or internal notes unnecessarily to Client Components.
- Validate UUIDs, enums, URLs, lengths, timestamps, and state transitions with Zod and database constraints.
- Use atomic database functions for send confirmation, suppression, merges, and paid attribution where check-then-write races matter.
- Record actor ID from the authenticated Supabase user.
- Owner-only is the MVP permission model. Adding scouts later requires a real membership/role table and per-command authorization; it must not be approximated with a second environment-variable email.

## Service boundaries

### `sales-scout` domain service

Owns normalization, dedupe candidate queries, score calculation, eligibility, state transitions, follow-up scheduling, and handover rules. The generic `ng-city-b2b-v1` scorer receives campaign city and country; Lagos is only the first campaign. Pure scoring/normalization functions should be independently testable.

### Existing prospect service

Continue using existing stage labels and atomic activity/stage functions. New scout commands should write compatible timeline entries rather than bypassing the commercial history.

### Outreach service

Owns draft/approve/confirm-send/reply lifecycle. It never sends to a platform. A manual sender adapter returns instructions/link data only.

### Attribution service

Owns explicit prospect-order linking, paid-state reconciliation, and reporting. It reads existing commerce state; it does not initialize or verify Paystack transactions.

## Future discovery-provider boundary

Define an interface without installing or calling providers in MVP:

```ts
type DiscoveryQuery = {
  city: string;
  country: string;
  categories: string[];
  cursor?: string;
};

type DiscoveryCandidate = {
  provider: string;
  providerId: string;
  businessName: string;
  category?: string;
  city?: string;
  country?: string;
  profileUrl?: string;
  websiteUrl?: string;
  publicPhone?: string;
  publicEmail?: string;
  evidence: Array<{ url: string; observedAt: string; fact: string }>;
};

interface ProspectDiscoveryProvider {
  readonly id: string;
  discover(query: DiscoveryQuery): Promise<{
    candidates: DiscoveryCandidate[];
    nextCursor?: string;
  }>;
}
```

Providers return candidates, never persist prospects or send messages. A separate ingestion service validates, normalizes, deduplicates, records provenance, and requires human review. The initial adapter is `manual`, accepting admin-entered public facts. Future adapters require an explicit terms/privacy review, bounded rate limits, retry/error behavior, and source-specific verification before implementation.

Discovery and review may be high-throughput, but sending remains individually human-reviewed and manual. Any response-channel copy must read the official WhatsApp from `siteConfig.whatsappPhone`, never a Sales Scout hardcoded number.

## Paid-order attribution integration

The safest integration point is immediately after the existing idempotent payment processor returns a verified paid result, or an idempotent reconciliation command invoked from the same callback/webhook paths:

1. Checkout/order creation remains unchanged.
2. Admin explicitly links an existing order to a prospect before or after payment.
3. On verified paid state, upsert the unique attribution row from `orders.total_amount` and the matching paid payment timestamp.
4. Reporting counts only attribution rows whose linked order is currently paid.
5. A reconciliation routine can repair a missed post-payment update without reprocessing inventory.

Do not infer identity by name alone. A normalized phone/email match may be shown as a suggested link, but the owner confirms it. Existing first/last-touch attribution remains web-campaign attribution and is not overwritten by Sales Scout.

## Risks and trade-offs

- **Existing CRM overlap:** Building separate scout prospects would fragment history. Extending `marketing_prospects` is leaner, but the existing table needs additional constraints and clearer separation between scout status and commercial stage.
- **One-order limitation:** `marketing_prospects.order_id` cannot represent repeat customers. A junction table is necessary; dual fields require a temporary compatibility rule.
- **Status complexity:** Replacing current stages would break working screens/functions. Parallel scout/handover/outreach statuses are justified but must be presented clearly in UI.
- **Admin model:** Owner-only authorization fits MVP but cannot safely support operators. Roles are a later, separate architecture change.
- **Discovery compliance:** Google/social “discovery” is not blanket permission to scrape. Provider work remains blocked until each source has an approved method and terms review.
- **Manual truth:** Send/reply records are operator assertions. The UI and reporting must label them as manually recorded, not platform-verified.
- **Attribution uncertainty:** Explicit linkage supports operational attribution, not proof of sole causality. Preserve relationship/evidence and keep web attribution separate.
- **Availability/delivery:** Campaign copy must not hard-code perpetual availability or guaranteed nationwide fulfillment; catalogue, quantity, logistics, quotation, and confirmation remain authoritative.
- **Refunds:** Paid attribution cannot net refunds accurately until the commerce system has an authoritative refund/reversal lifecycle.
- **Repository drift:** Baseline and dated SQL already overlap. Implementation must choose one canonical forward migration and update the baseline deliberately, with verification against the actual Shields Supabase schema.
- **Brand deployment:** This repository can serve Noble and Shields. Sales Scout data and rollout must be enabled only in the Shields deployment/project unless explicitly approved for another brand.

## Unnecessary complexity to avoid

- A separate `/sales-scout` app or authentication system
- Replacing the existing prospect pipeline
- Reusing aggregate `marketing_social_activities` as person-level outreach
- A generic workflow engine or event bus
- AI/vector scoring for a deterministic MVP
- Background cron for follow-up sending; due dates and a queue page are enough
- Direct platform APIs before the manual workflow proves useful and an approved provider exists


### Campaign identity and CRM attachment

`marketing_prospects.campaign_id` remains the generic CRM/marketing relationship. `scout_campaign_id` is the authoritative Sales Scout relationship and references the campaign extension with restricted deletion. Attaching a legacy CRM prospect enrolls that record in place, preserving its commercial stage, generic campaign, activity, suppression, inquiry and order history. Exact matches may add only genuinely new public channels; a no-op repeat creates no activity.

## Batch 5 discovery
DataForSEO Business Listings is isolated behind a server-only adapter. Results are staged in provider-keyed rows before human review; evidence is validated and no automated outreach is performed.

## Batch 5A discovery foundation
DataForSEO listings are provider research records, not capture-ready prospects. Canonical provider identity is separate from per-run membership, with no fabricated geography, category, demand, or contact facts.

Batch 5A correction retains provider category IDs and check_url verification URLs, maps only exact configured category IDs, and stores research gaps for owner review.

## Batch 5B owner discovery
Owner-triggered DataForSEO runs stage canonical provider listings for review. Capture reuses the authoritative ingestion RPC; dismissal changes only staged review state. No outreach is automated.
## Batch 6A research evaluation boundary

Provider-neutral research lives under `src/lib/sales-scout/research/` and is intentionally separate from staged discovery and CRM persistence. Geoapify supplies conservative place discovery, Tavily supplies bounded web discovery, and controlled official-site research supplies verified public contact evidence. Evaluation outputs are ignored local artifacts only. Deterministic identity merging, evidence preservation, contact quality, and SSRF/robots controls must pass before any later production-provider proposal.

## Batch 6B production extension

`research/production.ts` is the provider-neutral seed-first orchestrator. It bounds Geoapify calls, candidate-specific Tavily searches, unique official sites, and HTML pages; preserves partial seeds; and decorates every candidate with territory, contact-confidence, and readiness evidence. `territory.ts` owns Nigerian state/FCT normalization and Haversine matching. `discovery/server.ts` is the protected application boundary and uses only provider-neutral research RPCs for run persistence. DataForSEO files and historic rows remain dormant and readable.

Migration `20260802000100_sales_scout_production_release.sql` extends existing campaign/run/candidate tables instead of adding a second CRM. JSONB arrays retain multi-route contact and evidence records while compatibility phone/website columns remain. Provider constraints enumerate only legacy DataForSEO and the new research method. Campaign, completion, capture-evidence, and outreach writes use actor-required, service-role-only RPCs. Existing RLS remains enabled with no client policy.

Outreach reuses prospect channels, outreaches, activities, commercial stage, follow-up, and do-not-contact fields. Deterministic draft generation is pure; handoff URL creation is pure; every mutation is owner-authorized server code backed by transactional SQL. No provider key enters client code and no handoff invokes an external send API.