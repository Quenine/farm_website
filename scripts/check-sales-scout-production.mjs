import assert from "node:assert/strict";
import fs from "node:fs";
import { execFileSync } from "node:child_process";

const productionFiles=[
  "src/lib/sales-scout/research/production.ts",
  "src/lib/sales-scout/research/geoapify.ts",
  "src/lib/sales-scout/research/tavily.ts",
  "src/lib/sales-scout/research/website.ts",
  "src/lib/sales-scout/research/quality.ts",
  "src/lib/sales-scout/discovery/server.ts",
  "src/lib/sales-scout/territory.ts",
  "src/lib/sales-scout/outreach.ts",
  "src/lib/sales-scout/outreach-server.ts",
  "src/components/sales-scout/outreach-controls.tsx",
  "app/admin/(protected)/marketing/sales-scout/discover/page.tsx",
  "app/admin/(protected)/marketing/sales-scout/actions.ts",
];
const source=productionFiles.map((file)=>fs.readFileSync(file,"utf8")).join("\n");
const productionSource=fs.readFileSync("src/lib/sales-scout/research/production.ts","utf8");
const server=fs.readFileSync("src/lib/sales-scout/discovery/server.ts","utf8");
const geoapify=fs.readFileSync("src/lib/sales-scout/research/geoapify.ts","utf8");
const tavily=fs.readFileSync("src/lib/sales-scout/research/tavily.ts","utf8");
const website=fs.readFileSync("src/lib/sales-scout/research/website.ts","utf8");
const quality=fs.readFileSync("src/lib/sales-scout/research/quality.ts","utf8");
const outreach=fs.readFileSync("src/lib/sales-scout/outreach.ts","utf8");
const controls=fs.readFileSync("src/components/sales-scout/outreach-controls.tsx","utf8");
const migration=fs.readFileSync("database/20260802000100_sales_scout_production_release.sql","utf8");

assert.match(source,/runSeedFirstProductionResearch/);
assert.match(source,/geoapify_places/);
assert.match(source,/researchCandidateWithTavily/);
assert.doesNotMatch(productionSource,/mapTavilySearchResponse|researchWithTavily/);
assert.match(source,/candidateTavilyAssociation/);
assert.match(source,/maximumEnrichmentCandidates:\s*20/);
assert.match(source,/slice\(0, 2\)/);
assert.match(source,/plausible/);
assert.match(source,/verified/);
assert.match(source,/isManualReviewReady/);
assert.match(source,/isOutreachReady/);
assert.doesNotMatch(source,/NEXT_PUBLIC_(?:GEOAPIFY|TAVILY|DATAFORSEO)|puppeteer|selenium|captcha|social.*password/i);
assert.doesNotMatch(source,/sendMessage|messages\.send|directMessage|automatic.*send/i);

assert.match(server,/SALES_SCOUT_TAVILY_ENRICHMENT_ENABLED==="true"/);
assert.match(server,/isTavilyEnrichmentEnabled\(\)&&Boolean\(process\.env\.TAVILY_API_KEY/);
assert.doesNotMatch(server,/function isTavilyConfigured\(\)\{return Boolean\(process\.env\.TAVILY_API_KEY/);
assert.match(source,/Tavily enrichment disabled pending provider authorization/);

assert.match(geoapify,/const MAX_PAGES=5/);
assert.match(geoapify,/normalizeNigerianState\(state\)!==wantedState/);
assert.match(productionSource,/Math\.min\(5, Math\.ceil\(input\.resultLimit \/ 20\)\)/);
assert.match(productionSource,/maximumResultsPerCategory: 100/);
assert.match(productionSource,/GEOAPIFY_INVALID_SEED_IDENTITY/);
assert.doesNotMatch(server,/sourceIdentities\.geoapify_places!/);
assert.match(productionSource,/error\.reference === "GEOAPIFY_TERRITORY_NOT_RESOLVED"/);
assert.match(productionSource,/timeBudgetMs \?\? 45_000/);
assert.match(productionSource,/Math\.min\(50_000/);
assert.match(productionSource,/RESEARCH_TIME_BUDGET_REACHED/);

assert.match(tavily,/classification\.kind === "likely_official"/);
assert.match(tavily,/distinctPhones\.length <= 1/);
assert.match(tavily,/hasMultipleBusinessIdentities/);
assert.match(tavily,/classification\.kind === "social_profile"/);
assert.match(website,/hasTavilyLikelyOfficialWebsiteEvidence/);
assert.doesNotMatch(website,/researchIssues\.includes\("TAVILY_LIKELY_OFFICIAL_WEBSITE"\)/);

assert.match(server,/paginateContactEvidenceRows/);
assert.match(server,/DISCOVERY_FILTER_RESULT_LIMIT/);
assert.match(quality,/filtered\.slice\(from, from \+ pageSize\)/);
assert.doesNotMatch(server,/\.range\(from,from\+pageSize-1\)[\s\S]{0,500}rows=rows\.filter/);

assert.match(source,/confirmOutreachSent/);
assert.match(source,/confirmed:z\.literal\("yes"\)/);
assert.match(source,/platform_delivery_claimed|No message is sent automatically/);
assert.match(outreach,/\["replied","cancelled","blocked"\]/);
assert.match(outreach,/status==="no_response"/);
assert.doesNotMatch(source,/sequenceNumber:4|sequence_number\s*[<=>]+\s*4/);
assert.match(controls,/Public contact — review before use/);
assert.match(controls,/contactReviewed/);
assert.match(controls,/channelConfidence/);
assert.match(controls,/verified_at/);
assert.match(migration,/status in \('replied','cancelled','blocked'\)/);
assert.match(migration,/status='no_response'/);
assert.match(migration,/assigned_follow_up_at=null/);
assert.match(migration,/RESEARCH_RUN_STALE/);
assert.match(migration,/started_at<now\(\)-interval '15 minutes'/);

assert.match(source,/do_not_contact|doNotContact/);
assert.match(source,/requireAdmin/);
assert.match(source,/requireSalesScout/);
const campaignAction=source.match(/export async function saveCampaignAction[\s\S]*?\n\}/)?.[0]??"";
assert.match(campaignAction,/saveSalesScoutCampaign/);
assert.doesNotMatch(campaignAction,/runSalesScoutDiscovery|runDiscoveryAction/);
assert.doesNotMatch(source,/\.from\(["']marketing_(?:prospects|prospect_outreaches|sales_scout_campaigns)["']\)\s*\.(?:insert|update|delete)/);

assert.ok(fs.existsSync(".env.shields.example"));
const env=fs.readFileSync(".env.shields.example","utf8");
assert.match(env,/GEOAPIFY_API_KEY=/);
assert.match(env,/SALES_SCOUT_TAVILY_ENRICHMENT_ENABLED="false"/);
assert.match(env,/TAVILY_API_KEY=/);
assert.doesNotMatch(env,/NEXT_PUBLIC_(?:GEOAPIFY|TAVILY)/);
const changed=execFileSync("git",["status","--porcelain"],{encoding:"utf8"});
assert.doesNotMatch(changed,/(?:^|\n).. (?:package(?:-lock)?\.json|\.env\.example|.*(?:storefront|inventory|checkout|payment|orders).*|.*noble.*)/i);
console.log("Sales Scout production/outreach static audit passed.");
