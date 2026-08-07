# Sales Scout Batch 6B production runbook

This is an owner-operated Shields deployment procedure. It does not authorize automatic outreach. Paid orders remain the only revenue truth. Tavily enrichment remains disabled unless the owner independently confirms in writing that the intended use is permitted under the applicable provider contract.

1. From the reviewed commit, run the repository checks, focused discovery/research/outreach tests, fixture evaluation, Sales Scout static audits, scoped ESLint, TypeScript, the production build, and `git diff --check`.
2. In the non-production Shields Supabase project, run `database/preflight-sales-scout-production-release.sql`. The corrected preflight checks only prerequisites that must exist before migration `20260802000100`.
3. Run `database/rollback-dry-run-sales-scout-production-release.sql`. It must finish with `ROLLBACK`; inspect that no durable schema change remains.
4. Apply `database/20260802000100_sales_scout_production_release.sql` once using the established migration procedure.
5. Execute `database/verify-sales-scout-production-release.sql`. It exercises campaign, research, compatibility, confidence, outreach, suppression, privilege, and follow-up behavior inside a transaction that rolls back.
6. Apply the same migration a second time to prove repeat safety. Static inspection is not equivalent to executing it twice.
7. Execute the verifier again and retain both migration/verifier transcripts.
8. Configure Shields only: `SALES_SCOUT_ENABLED=true`, `SALES_SCOUT_DISCOVERY_ENABLED=true`, `GEOAPIFY_API_KEY`, `SALES_SCOUT_PUBLIC_WEB_RESEARCH_ENABLED=true`, `SERPAPI_API_KEY`, and `SALES_SCOUT_TAVILY_ENRICHMENT_ENABLED=false`. Leave `TAVILY_API_KEY` unset. All provider variables are server-only; never prefix them with `NEXT_PUBLIC_`.
9. Confirm DataForSEO variables remain removed or unset. Its legacy rows and adapter remain compatible but are not the production orchestrator.
10. Deploy the reviewed Shields commit only. Do not modify or deploy Noble configuration.
11. Begin with one active campaign, one structured category, result limit 5, and enrichment disabled. The initial path is Geoapify structured seeds plus bounded research of likely official websites supplied by Geoapify.
12. The displayed Geoapify ceiling conservatively includes one territory-resolution call for each category when campaign coordinates are absent. Website request timeouts cover headers and bounded HTML body reads.
13. As owner, review provider-listed contacts manually, capture one prospect, edit and approve one draft, confirm any plausible public contact before opening its handoff, send manually if appropriate, and only then mark it sent. Confirm a handoff never records a send.
14. To roll back application code, redeploy the prior Shields commit. Before schema rollback, pause discovery, ensure no run is `running`, export new Sales Scout data, rehearse the exact rollback in non-production, and obtain owner approval. Preserve candidate/outreach evidence before dropping new columns or RPCs; the supplied rollback file is a transaction-only rehearsal, not a production data rollback.

Geoapify does not guarantee phone, email, social, or website coverage. Stop rollout if authorization, provider configuration, safe error handling, manual-send semantics, service-role isolation, follow-up cleanup, or verifier behavior differs from this runbook.
