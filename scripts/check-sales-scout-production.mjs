import assert from "node:assert/strict";
import fs from "node:fs";
import { execFileSync } from "node:child_process";

const productionFiles=[
  "src/lib/sales-scout/research/production.ts","src/lib/sales-scout/research/tavily.ts",
  "src/lib/sales-scout/discovery/server.ts","src/lib/sales-scout/territory.ts",
  "src/lib/sales-scout/outreach.ts","src/lib/sales-scout/outreach-server.ts",
  "src/components/sales-scout/outreach-controls.tsx","app/admin/(protected)/marketing/sales-scout/actions.ts",
];
const source=productionFiles.map(file=>fs.readFileSync(file,"utf8")).join("\n");
const productionSource=fs.readFileSync("src/lib/sales-scout/research/production.ts","utf8");
assert.match(source,/runSeedFirstProductionResearch/);assert.match(source,/geoapify_places/);assert.match(source,/researchCandidateWithTavily/);
assert.doesNotMatch(productionSource,/mapTavilySearchResponse|researchWithTavily/);
assert.match(source,/candidateTavilyAssociation/);assert.match(source,/maximumEnrichmentCandidates:\s*20/);assert.match(source,/slice\(0, 2\)/);
assert.match(source,/plausible/);assert.match(source,/verified/);assert.match(source,/isManualReviewReady/);assert.match(source,/isOutreachReady/);
assert.doesNotMatch(source,/NEXT_PUBLIC_(?:GEOAPIFY|TAVILY|DATAFORSEO)|puppeteer|selenium|captcha|social.*password/i);
assert.doesNotMatch(source,/sendMessage|messages\.send|directMessage|automatic.*send/i);
assert.match(source,/confirmOutreachSent/);assert.match(source,/confirmed:z\.literal\("yes"\)/);assert.match(source,/platform_delivery_claimed|No message is sent automatically/);
assert.match(source,/sequenceNumber:1\|2\|3/);assert.doesNotMatch(source,/sequenceNumber:4|sequence_number\s*[<=>]+\s*4/);
assert.match(source,/do_not_contact|doNotContact/);assert.match(source,/requireAdmin/);assert.match(source,/requireSalesScout/);
const campaignAction=source.match(/export async function saveCampaignAction[\s\S]*?\n\}/)?.[0]??"";assert.match(campaignAction,/saveSalesScoutCampaign/);assert.doesNotMatch(campaignAction,/runSalesScoutDiscovery|runDiscoveryAction/);
assert.doesNotMatch(source,/\.from\(["']marketing_(?:prospects|prospect_outreaches|sales_scout_campaigns)["']\)\s*\.(?:insert|update|delete)/);
assert.ok(fs.existsSync(".env.shields.example"));const env=fs.readFileSync(".env.shields.example","utf8");assert.match(env,/GEOAPIFY_API_KEY=/);assert.match(env,/TAVILY_API_KEY=/);assert.doesNotMatch(env,/NEXT_PUBLIC_(?:GEOAPIFY|TAVILY)/);
const changed=execFileSync("git",["status","--porcelain"],{encoding:"utf8"});assert.doesNotMatch(changed,/(?:^|\n).. (?:package(?:-lock)?\.json|\.env\.example|.*(?:storefront|inventory|checkout|payment|orders).*|.*noble.*)/i);
console.log("Sales Scout production/outreach static audit passed.");
