# Shields Farms Sales Scout — Product Specification

## Objective

Sales Scout is an owner-only workflow inside the existing Marketing Command Centre for finding and qualifying food businesses city by city across Nigeria, preparing personalized social outreach, recording human-sent messages and replies, handing interested prospects to the owner, and attributing verified paid orders to the prospecting effort. Lagos is the first campaign.

The MVP supports high-throughput prospect discovery and review in an auditable workflow while keeping every send human-controlled. It is not a social automation product.

## Users

- **Owner/admin:** the repository currently supports one authorized admin identity. This user reviews prospects and drafts, sends messages manually in the relevant social app, records replies, owns handovers, and confirms attribution.
- **Future scout/operator:** a possible later role with limited prospect and outreach access. It is not part of MVP because the current application has no role model beyond the configured owner/admin email.

## Initial campaign

- Market: Lagos, Nigeria
- Categories: Restaurant, Caterer, Hotel, Supermarket, Food Vendor
- Primary outreach platform: Instagram
- Additional discovery sources: Google, Facebook, TikTok, X, YouTube
- Official WhatsApp: use `siteConfig.whatsappPhone` as the application source of truth
- Offer context: all products are currently available
- Delivery statement: nationwide, subject to quantity, logistics, quotation, and confirmation

Availability is a campaign assumption, not a permanent product invariant. The current product catalogue remains authoritative when a quotation or order is prepared.

## Exact MVP workflow

1. The admin opens **Admin → Marketing → Sales Scout** and selects the Lagos campaign queue.
2. The admin manually adds a business found through a permitted public search or social profile. Required inputs are business name, category, city, country, discovery source, and at least one public profile URL or contact identifier.
3. The server normalizes identifiers, checks exact duplicate keys, shows possible fuzzy matches, and requires the admin to reuse, merge, or explicitly keep the candidate.
4. The admin verifies the public information, records qualification facts, and saves the deterministic score with its rule version and factor breakdown.
5. The admin marks an eligible prospect `qualified` and prepares a personalized Instagram draft. Draft content must identify Shields Farms, use verified business context, make no unverified claims, and preserve the delivery/quotation caveat.
6. A human reviews the draft. The application provides copy text and an external profile link; it does not log in, click Send, or call a DM API.
7. After manually sending in Instagram, the admin explicitly records the send time, sending account, final message text, and optional platform permalink/reference. Only this action changes outreach to `sent`.
8. The admin records replies and outcomes manually. A positive reply moves the prospect to `engaged`; a clear request for price, supply details, call, quotation, or trial order makes it eligible for owner handover.
9. The admin accepts the handover, contacts the prospect using the agreed channel, and records requirements/quotation activity using the existing prospect activity timeline.
10. Follow-ups appear in a due queue. Each follow-up is individually reviewed and manually sent. Rules stop reminders after a reply, opt-out, terminal outcome, or maximum attempt count.
11. When an order is created, the admin may link it to the prospect. Revenue and conversion metrics count only after the existing payment processor has verified the order as `paid`.

## Scope

### In scope

- Protected Sales Scout queue and prospect detail workflow under `/admin/marketing`
- Manual prospect entry and permitted import/provider candidates
- Lagos/category filters and campaign context
- Duplicate warnings and explicit resolution
- Deterministic, explainable qualification scoring
- Personalized message drafting and human approval
- Copy/open-profile/manual-send confirmation
- Reply, follow-up, opt-out, and handover records
- Linkage to existing inquiries, campaigns, products, orders, and paid-order reporting
- Audit-friendly timestamps and actor IDs for material actions

### Out of scope

- Automated unsolicited DMs or auto-send scheduling
- Platform credential storage, browser automation, fake accounts, CAPTCHA bypass, or rule-violating scraping
- Bulk message blasting, contact enrichment from private data, or purchased contact lists
- Autonomous AI qualification or sending
- Customer accounts, a general-purpose CRM, sales-team roles, commissions, telephony, or inbox synchronization
- Automatic quotation, delivery promise, price promise, or product availability promise
- New discovery-provider integration in MVP; only the boundary and manual adapter are defined

## Statuses

### Prospect status

Scout status is narrower than the existing commercial pipeline `stage`. It describes research readiness; existing `marketing_prospects.stage` continues to describe the sales lifecycle.

| Status | Meaning |
| --- | --- |
| `new` | Candidate captured but not reviewed |
| `researching` | Public facts are being verified |
| `qualified` | Required facts pass and the current score meets the threshold |
| `disqualified` | Not a fit; reason required |
| `engaged` | A substantive reply has been recorded |
| `converted` | At least one linked order is verified paid |
| `closed` | No further scouting work; reason required |
| `do_not_contact` | Contact is prohibited until an explicit, audited removal |

### Outreach status

Each message attempt has its own state.

| Status | Meaning |
| --- | --- |
| `draft` | Generated or written but not yet approved |
| `approved` | Human-reviewed and ready to copy |
| `sent` | Human explicitly confirmed a manual send |
| `replied` | A reply to this thread has been recorded |
| `no_response` | Follow-up window elapsed with no reply |
| `cancelled` | Not sent; reason retained |
| `blocked` | Suppressed by do-not-contact, invalid profile, platform restriction, or policy |

### Handover status

| Status | Meaning |
| --- | --- |
| `not_ready` | No handover signal yet |
| `ready` | Explicit commercial interest recorded |
| `accepted` | Owner accepted responsibility |
| `in_progress` | Requirements, quotation, or trial-order work is active |
| `completed` | Handover resulted in a paid order or deliberately completed commercial process |
| `declined` | Owner declined; reason required |

## Business rules

### Qualification and deterministic lead score

The score is 0–100 and stores `score`, `score_version`, and a factor breakdown. MVP rule `ng-city-b2b-v1` receives the campaign city and country:

- Category is one of the five campaign categories: +20
- Verified presence or service in the selected campaign city: +20
- Active public business profile with activity within 90 days: +15
- Public evidence of recurring food procurement/use (menu, catering, hospitality, grocery, food production): +20
- At least one usable public contact route (social DM, business phone, email, or website form): +10
- Estimated demand indicator: high +15, medium +10, low +5, unknown +0
- Profile appears inactive/closed: −40
- Outside the campaign geography with no selected-city service evidence: −25
- Consumer-only/non-business account: −30

Clamp the result to 0–100. `qualified` requires score ≥60, an allowed category, selected campaign-city presence or service evidence, a usable contact route, and no do-not-contact flag. The admin may disqualify at any score but may not override a sub-60 prospect to `qualified` in MVP; facts should be corrected and the deterministic score recomputed.

### Duplicate detection

Normalize on write:

- Social handle: lowercase; remove leading `@`, whitespace, trailing slash, query string, and known profile URL wrappers; pair with platform.
- Website: lowercase hostname, remove `www.`, default ports, fragment, tracking parameters, and trailing slash.
- Phone: digits only and canonical Nigerian form where possible (`+234...`); preserve raw input separately.
- Email: trim and lowercase.
- Business/location comparison: Unicode normalize, lowercase, collapse punctuation/whitespace, remove common legal suffixes, and pair with city.

Hard duplicates are exact normalized platform+handle, phone, email, or canonical website hostname matches and must reuse/merge the existing prospect. A normalized business-name+city match or high name similarity is a soft warning requiring an explicit admin decision. Provider source IDs are unique within a provider. Do-not-contact survives merges and always wins.

### Follow-up rules

- Initial outreach may be recorded only from an `approved` draft and only for an eligible, non-suppressed prospect.
- First follow-up becomes due 3 calendar days after a sent initial message if no reply exists.
- Second and final follow-up becomes due 7 calendar days after the first follow-up if no reply exists.
- Maximum: one initial message plus two follow-ups per prospect/platform thread.
- No automatic sends. Due dates create tasks only.
- A reply cancels pending no-response follow-ups. A positive reply moves the prospect to `engaged`; a negative reply closes the thread.
- Any opt-out, “stop”, “not interested—do not contact”, platform complaint, or admin suppression immediately sets do-not-contact and blocks all pending/future outreach on every channel.

### Do-not-contact

Suppression is prospect-wide, not platform-specific. Store active flag/status, reason category, free-text note, source, timestamp, and actor. Never delete suppression as part of merge or normal cleanup. Removal requires the owner, a reason, and a new audit event; historical outreach remains unchanged. All draft approval, send confirmation, and follow-up actions must re-check suppression server-side.

### Manual social sending

The system may generate/edit text, copy it to the clipboard, and open the prospect’s public profile in a new tab. It must not authenticate to the platform, simulate user actions, or claim delivery. The admin returns to Sales Scout and confirms what was actually sent. Store the final sent text, platform, account label, sent timestamp, and optional reference. “Open profile” and “copy” are not sends and must not affect metrics.

### Handover and attribution

Handover readiness requires a recorded reply containing an explicit commercial signal. The owner accepts the handover before it becomes `in_progress`. Link any resulting existing `orders` row to the prospect without changing checkout or payment behavior. A conversion is counted only when `orders.payment_status = 'paid'`; paid amount comes from `orders.total_amount`, and paid time comes from the verified `payments.paid_at`. Refund/reversal treatment is deferred because the current commerce model has no complete refund lifecycle.

## Success metrics

- Number of unique qualified prospects by city/category
- Qualification rate from reviewed candidates
- Human-approved initial messages and manually confirmed sends
- Reply rate: prospects with a recorded reply / prospects with a confirmed sent initial message
- Positive-reply and handover-ready rates
- Follow-ups due, completed, and overdue
- Do-not-contact rate and blocked-send count
- Accepted handovers and time from reply to acceptance
- Prospect-attributed verified paid orders and paid revenue
- Duplicate prevention/merge rate

These are operational counts, not claims of platform delivery or causality. Paid revenue is not profit.

## Safety and outreach safeguards

- Owner-only authorization in MVP; every mutation independently calls the existing admin guard.
- Server-only service-role access; no prospect or outreach tables exposed to browser Supabase clients.
- Human review and manual send confirmation on every message.
- No bulk-send control and no automated platform credentials.
- Minimal public business data only; avoid sensitive/private personal data.
- Fact-based personalization; no fabricated familiarity, deceptive identity, urgency, price, availability, or delivery guarantees.
- Frequency cap and prospect-wide suppression enforced at the server/data boundary.
- Preserve source URL, evidence timestamp, score explanation, sent text, reply summary, and actor/timestamps for auditability.
- External discovery adapters must respect provider terms, robots/access rules where applicable, rate limits, and data provenance. A provider being technically accessible does not authorize collection.
- The official WhatsApp from `siteConfig.whatsappPhone` is presented as a voluntary response/handover channel, not used for automated unsolicited messaging.

## Batch 6B production workflow

The owner configures a Nigeria-only campaign by state/FCT and arbitrary city/town, then explicitly starts bounded structured discovery. Geoapify supplies business seeds; Tavily and official websites may enrich only those seeds. Candidates expose `plausible` and `verified` public contacts separately. `MANUAL_REVIEW_READY` requires a defensible structured seed, territory match, and any normalized public contact; `OUTREACH_READY` additionally requires a verified contact. The owner previews duplicates, captures or attaches the candidate, edits and approves a deterministic draft, opens a handoff, sends manually, explicitly records the send, and records replies, no response, opt-out, or cancellation. At most three attempts are permitted. Handoffs never send or record a send. Paid orders remain the only revenue truth.

Structured discovery currently supports Restaurant, Hotel, and Supermarket. Other permitted campaign categories are saved with an explicit connector-pending warning and never fall back to broad Tavily prospect generation. Production activation requires the Batch 6B migration, server-only provider variables, Shields-only deployment, and the runbook smoke test.