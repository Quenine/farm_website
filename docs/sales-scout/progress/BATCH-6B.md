# Batch 6B progress

Batch 6B implements the first production-oriented nationwide discovery and human-controlled outreach path. It has not been applied or deployed.

- The first Lagos pilot found real Geoapify business seeds. Broad Tavily results were unsuitable articles, directories, booking pages, and generic documents.
- Production discovery is now seed-first: Geoapify creates structured identities; at most two exact-name Tavily searches enrich only defensibly associated seeds; controlled official-site research may verify facts.
- All Nigerian states and the FCT are supported with arbitrary owner-entered cities/towns, optional coordinates, radius/result limits, and an enrichment cap.
- Territory matching records provider geography, campaign geography, coordinates, Haversine distance, and the match basis. A missing provider city remains null.
- Provider-listed and associated-search contacts remain `plausible` and visible for manual review. Official-site contacts may be `verified`. Plausible evidence is never silently promoted.
- Manual-review readiness and verified-contact outreach readiness are independent. Plausible contacts require owner confirmation before use.
- Outreach drafts are deterministic and editable. Approval, handoff, send confirmation, replies, no-response, opt-out, and cancellation are owner-controlled. Opening a link never records a send and no automatic external message is sent.
- The migration preserves DataForSEO records/functions as a disabled legacy adapter and adds service-role-only provider-neutral research/campaign/outreach RPCs.
- Production use still requires non-production preflight, rollback rehearsal, migration apply twice, behavioural verifier twice, Shields-only variables/deployment, and the owner smoke test in `PRODUCTION_RUNBOOK.md`.
- No provider, website, database, messaging, deployment, or environment operation was performed while implementing this batch. Paid orders remain the only revenue truth.
