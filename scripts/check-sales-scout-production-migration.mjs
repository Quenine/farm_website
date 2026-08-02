import assert from "node:assert/strict";
import fs from "node:fs";

const file="database/20260802000100_sales_scout_production_release.sql";
const sql=fs.readFileSync(file,"utf8");
const preflight=fs.readFileSync("database/preflight-sales-scout-production-release.sql","utf8");
const verifier=fs.readFileSync("database/verify-sales-scout-production-release.sql","utf8");

assert.match(sql,/^begin;/m);
assert.match(sql,/commit;\s*$/);
assert.match(sql,/geoapify_tavily_research/);
assert.match(sql,/dataforseo_business_listings/);
const newRpcs=[
  "start_sales_scout_research_run",
  "complete_sales_scout_research_run",
  "fail_sales_scout_research_run",
  "save_sales_scout_campaign",
  "save_sales_scout_outreach_draft",
  "approve_sales_scout_outreach_draft",
  "confirm_sales_scout_outreach_sent",
  "record_sales_scout_outreach_outcome",
];
for(const rpc of newRpcs)assert.match(sql,new RegExp("create or replace function public\\."+rpc+"\\("));
for(const rpc of newRpcs)assert.doesNotMatch(preflight,new RegExp("\\b"+rpc+"\\b"));
for(const object of[
  "max_enrichment_candidates","research_method","contact_evidence",
  "marketing_sales_scout_candidates_readiness_idx",
  "marketing_prospects_suppress_scout_outreach",
  "marketing_channels_suppress_scout_outreach",
])assert.doesNotMatch(preflight,new RegExp("\\b"+object+"\\b"));
assert.match(preflight,/capture_sales_scout_candidate/);

for(const field of[
  "structured_seed_count","discarded_source_document_count","manual_review_ready_count",
  "outreach_ready_count","territory_match_evidence","contact_evidence",
  "research_evidence","manual_review_ready","outreach_ready",
])assert.match(sql,new RegExp("\\b"+field+"\\b"));
assert.match(sql,/completion_payload_fingerprint/);
assert.match(sql,/completion payload differs from completed run/);
assert.match(sql,/seen_count=marketing_sales_scout_discovery_candidates\.seen_count\+1/);
assert.match(sql,/marketing_sales_scout_discovery_run_candidates/);
assert.match(sql,/RESEARCH_RUN_STALE/);
assert.match(sql,/provider='geoapify_tavily_research'/);
assert.match(sql,/research_method='seed_first_candidate_specific'/);
assert.match(sql,/jsonb_typeof\(v_item->'providerSourceId'\)<>'string'/);
assert.match(sql,/revoke all on function[\s\S]*from public,anon,authenticated/);
assert.match(sql,/grant execute on function[\s\S]*to service_role/);
assert.doesNotMatch(sql,/grant execute[\s\S]{0,300}to (?:anon|authenticated|public)/);
assert.match(sql,/p_actor_id is null/);
assert.match(sql,/p_sequence_number not between 1 and 3/);
assert.match(sql,/status in \('replied','cancelled','blocked'\)/);
assert.match(sql,/assigned_follow_up_at=null/);
assert.match(sql,/suppress_sales_scout_outreach_for_inactive_channel/);
assert.match(sql,/jsonb_typeof\(p_payload->'candidates'\)/);

for(const phrase of[
  "campaign save verification failed","stale research-run recovery failed",
  "research completion idempotency failed","DataForSEO compatibility row failed",
  "plausible contact persistence failed","verified contact persistence failed",
  "initial three-day follow-up failed","no-response left stale follow-up",
  "reply suppression failed","cancellation left stale follow-up",
  "opt-out suppression failed","fourth outreach was accepted",
])assert.ok(verifier.includes(phrase),phrase);
const captureFixture = verifier.match(
  /v_capture:=jsonb_build_object\([\s\S]*?\n  \);\r?\n  v_result:=public\.capture_sales_scout_candidate/,
)?.[0] ?? "";
for (const field of ["'score'", "'ruleVersion'", "'factors'", "'scoredAt'"]) {
  assert.ok(captureFixture.includes(field), `capture fixture missing ${field}`);
}
assert.match(verifier,/has_function_privilege\('service_role'/);
assert.match(verifier,/rollback;\s*$/);
assert.ok(fs.existsSync("database/rollback-dry-run-sales-scout-production-release.sql"));
console.log("Sales Scout production migration static verification passed.");
