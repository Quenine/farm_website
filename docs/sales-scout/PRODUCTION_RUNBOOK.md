# Sales Scout Batch 6B production runbook

This is an owner-operated Shields deployment procedure. It does not authorize automatic outreach. Paid orders remain the only revenue truth.

1. From the reviewed commit, run `npm run sales-scout:checks`, `npm run marketing:checks`, the focused discovery/research/outreach tests, all three Sales Scout static audits, `npx tsc --noEmit`, `npm run build`, and `git diff --check`.
2. In the non-production Shields Supabase project, run `database/preflight-sales-scout-production-release.sql`. Resolve every raised exception before continuing.
3. Run `database/rollback-dry-run-sales-scout-production-release.sql`. It must finish with `ROLLBACK`; inspect that no durable schema change remains.
4. Apply `database/20260802000100_sales_scout_production_release.sql` once using the established migration procedure.
5. Execute `database/verify-sales-scout-production-release.sql`. It intentionally rolls back its verifier transaction.
6. Apply the same migration a second time to prove repeat safety. Static inspection is not equivalent to this execution.
7. Execute the verifier again and retain both migration/verifier transcripts.
8. In Shields Vercel Production only, set `SALES_SCOUT_ENABLED=true`, `SALES_SCOUT_DISCOVERY_ENABLED=true`, `GEOAPIFY_API_KEY`, and optional `TAVILY_API_KEY`. Values are server-only. Do not prefix provider keys with `NEXT_PUBLIC_`.
9. Confirm DataForSEO variables remain removed or unset. The legacy adapter remains readable but is not the production orchestrator.
10. Deploy the reviewed Shields commit only. Do not modify or deploy Noble configuration.
11. Smoke test as owner: create/select a Nigerian campaign; choose only structured categories; run discovery with result limit 5 and enrichment cap no higher than 6; review territory and contact confidence; capture one prospect; generate and edit a draft; approve it; open a manual handoff; manually send if appropriate; only then mark sent; record a reply or no-response outcome. Verify no handoff alone marks a send.
12. To roll back application code, redeploy the prior Shields commit. Before schema rollback, pause discovery, ensure no run is `running`, export new Sales Scout data, rehearse the exact rollback in non-production, and obtain owner approval. Preserve candidate/outreach evidence before dropping new columns or RPCs; the supplied rollback file is a transaction-only rehearsal, not a production data rollback.

Stop and roll back the application deployment if authorization, provider configuration, safe error handling, manual-send semantics, or service-role isolation differs from this runbook.
