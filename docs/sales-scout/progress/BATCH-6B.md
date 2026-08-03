# Batch 6B progress

Batch 6B implements the first production-oriented nationwide discovery and human-controlled outreach path. It has not been applied or deployed.

- Production discovery is seed-first. Geoapify supplies structured place identities; records without a non-empty place ID are discarded before persistence.
- Geoapify supports five pages of 20 results, matching the campaign/schema maximum of 100 results per supported category. Nigerian state aliases and `State` suffixes are normalized while city matching stays exact.
- Safe failures are isolated per category so successful structured seeds survive. Stale provider-neutral research runs fail after 15 minutes, and the pipeline has a 45-second default and 50-second maximum total budget with partial-enrichment completion.
- Tavily enrichment is retained but server-gated by `SALES_SCOUT_TAVILY_ENRICHMENT_ENABLED=true` plus a key. The default is false pending independent provider authorization.
- Tavily directories, articles, lists, booking pages, and other discovery-only documents cannot contribute contacts. Social results contribute only their profile; likely-official website evidence can enter bounded official-site research.
- Provider-listed contacts remain `plausible`; official-site contacts may become `verified`. Captured plausible channels still require a local owner acknowledgement before opening a manual handoff.
- Contact filters use bounded owner-only filtering before pagination so displayed counts and later pages agree.
- Outreach drafts stop at any reply, cancellation, or block. A sent item must become `no_response` before the next sequence; no-response, cancellation, reply, opt-out, terminal prospect state, and inactive-channel suppression clear stale follow-up assignments.
- The corrected preflight requires only pre-migration objects. The post-migration verifier covers campaign save, stale recovery, provider compatibility, research idempotency, contact confidence, the three-step outreach ceiling, manual send confirmation, follow-up timing, outcomes, suppression, and service-role isolation inside `ROLLBACK`.
- Non-production still requires the preflight, rollback rehearsal, migration twice, verifier twice, Shields-only configuration/deployment, and the owner smoke test in `PRODUCTION_RUNBOOK.md`.
- No provider, website, database, messaging, deployment, or environment operation was performed during this hardening pass. Paid orders remain the only revenue truth.

- Batch 6B-H2 corrected the production verifier capture fixture with `scoredAt`, synchronized outreach draft/review state to persisted workflow transitions, made approved text explicitly copyable, and retained website timeouts through bounded body reads. Geoapify cost ceilings now conservatively include territory resolution per category when coordinates are absent. These remain static/offline changes pending the required non-production migration and PostgreSQL verifier execution.

- Corrected the production verifier to use lowercase public for PostgreSQL pseudo-role privilege checks and added a regression guard against uppercase PUBLIC.
