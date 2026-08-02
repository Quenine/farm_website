import assert from "node:assert/strict";
import { access, readFile } from "node:fs/promises";
import test from "node:test";
import {
  buildGeoapifyPlacesUrl,
  buildGeoapifyTerritoryUrl,
  buildTavilyQueries,
  candidatesToCsv,
  computeEvaluationMetrics,
  deduplicateCandidates,
  extractWebsiteFacts,
  geoapifyCategory,
  isOutreachReady,
  isPlausibleOfficialWebsite,
  mapGeoapifyPlacesResponse,
  mapTavilySearchResponse,
  mergeCandidates,
  metricsToMarkdown,
  robotsAllows,
  validatePublicWebsiteUrl,
  type ResearchCandidate,
  type ResearchQuery,
} from "../src/lib/sales-scout/research/index.ts";
import { parseResearchArgs, runResearchEvaluation } from "../scripts/sales-scout-research-eval.ts";

const observedAt="2026-08-02T09:00:00.000Z";
const query:ResearchQuery={territory:{country:"Nigeria",state:"Lagos",city:"Lagos",latitude:6.5,longitude:3.4,radiusKm:20},category:"Restaurant",limit:5};
function candidate(patch:Partial<ResearchCandidate>={}):ResearchCandidate{
  const sourceUrl="https://fixture-business.example/";
  return{sourceIdentities:{manual_public_source:"fixture-1"},businessName:"Fixture Kitchen",normalizedBusinessName:"fixture kitchen",requestedCategory:"Restaurant",providerCategories:["Restaurant"],country:"Nigeria",state:"Lagos",city:"Lagos",address:null,latitude:null,longitude:null,website:sourceUrl,phoneNumbers:["08030001000"],emailAddresses:[],whatsAppNumbers:[],instagram:[],facebook:[],tiktok:[],x:[],youtube:[],publicDescription:null,evidence:[{source:"manual_public_source",sourceUrl,observedAt,field:"requestedCategory",value:"Restaurant",confidence:"high",verificationStatus:"verified"},{source:"official_website",sourceUrl,observedAt,field:"phone",value:"08030001000",confidence:"high",verificationStatus:"verified"},{source:"official_website",sourceUrl,observedAt,field:"website",value:sourceUrl,confidence:"high",verificationStatus:"verified"}],discoverySources:["manual_public_source","official_website"],researchIssues:[],firstObservedAt:observedAt,lastObservedAt:observedAt,...patch};
}

test("territory and category queries are deterministic and Nigeria-specific",()=>{
  assert.match(buildGeoapifyTerritoryUrl(query.territory).searchParams.get("text")??"",/Lagos, Lagos, Nigeria/);
  assert.match(buildGeoapifyPlacesUrl(query,3.4,6.5,1).searchParams.get("categories")??"",/catering\.restaurant/);
  assert.deepEqual(buildTavilyQueries(query),["Restaurant businesses in Lagos, Lagos, Nigeria official website","Restaurant in Lagos, Lagos, Nigeria official Instagram Facebook contact"]);
});
test("unsupported Geoapify categories are not guessed",()=>{assert.equal(geoapifyCategory("Caterer"),null);assert.equal(geoapifyCategory("Food Processor"),null);});
test("Geoapify mapping preserves only present fields",async()=>{
  const payload=JSON.parse(await readFile("scripts/fixtures/sales-scout-research/geoapify-places.json","utf8"));
  const mapped=mapGeoapifyPlacesResponse(payload,{...query,category:"Supermarket"},observedAt);
  assert.equal(mapped[0].businessName,"Riverbend Market");assert.equal(mapped[0].emailAddresses.length,0);assert.equal(mapped[1].website,null);assert.equal(mapped[1].phoneNumbers.length,0);
});
test("Tavily mapping treats snippets as plausible discovery evidence",async()=>{
  const payload=JSON.parse(await readFile("scripts/fixtures/sales-scout-research/tavily-search.json","utf8"));
  const mapped=mapTavilySearchResponse(payload,{...query,territory:{country:"Nigeria",state:"Enugu",city:"Enugu"}},observedAt);
  assert.equal(mapped[0].city,"Enugu");assert.equal(mapped[0].phoneNumbers.length,0);assert.equal(mapped[0].evidence[1].verificationStatus,"plausible");
});
test("official website selection rejects profiles, credentials, and private URLs",()=>{
  assert.equal(isPlausibleOfficialWebsite("https://business.example/contact"),true);
  assert.equal(isPlausibleOfficialWebsite("https://instagram.com/business"),false);
  for(const url of ["http://localhost/","http://10.0.0.1/","https://user:pass@example.com/"])assert.equal(isPlausibleOfficialWebsite(url),false);
});
test("private IP and redirect targets are rejected",()=>{
  assert.throws(()=>validatePublicWebsiteUrl("http://127.0.0.2/"),/Research provider operation failed/);
  assert.throws(()=>validatePublicWebsiteUrl("https://public.example/",["169.254.1.2"]));
  assert.doesNotThrow(()=>validatePublicWebsiteUrl("https://public.example/",["8.8.8.8"]));
});
test("robots disallow applies without blocking public contact",async()=>{
  const robots=await readFile("scripts/fixtures/sales-scout-research/robots.txt","utf8");
  assert.equal(robotsAllows(robots,"/private/customer"),false);assert.equal(robotsAllows(robots,"/contact"),true);
});
test("website extraction finds normalized public contacts and socials",async()=>{
  const html=await readFile("scripts/fixtures/sales-scout-research/official-homepage.html","utf8");
  const facts=extractWebsiteFacts(html,"https://sunrisefoods.example/",observedAt);
  assert.equal(facts.phoneNumbers.length,1);assert.equal(facts.emailAddresses[0],"sales@sunrisefoods.example");assert.equal(facts.whatsAppNumbers.length,1);
  assert.equal(facts.instagram.length,1);assert.equal(facts.facebook.length,1);assert.equal(facts.tiktok.length,1);assert.equal(facts.x.length,1);assert.equal(facts.youtube.length,1);
});
test("JSON-LD description and address create source evidence",async()=>{
  const html=await readFile("scripts/fixtures/sales-scout-research/official-homepage.html","utf8");
  const facts=extractWebsiteFacts(html,"https://sunrisefoods.example/",observedAt);
  assert.match(facts.publicDescription??"",/synthetic Nigerian restaurant/i);assert.match(facts.addresses[0],/Unity Road/);assert.ok(facts.evidence.every((item)=>item.sourceUrl));
});
test("deduplication follows exact identities, website, phone, then name and city",()=>{
  const sameWebsite=candidate({sourceIdentities:{tavily_search:"other"},phoneNumbers:[]});
  const result=deduplicateCandidates([candidate(),sameWebsite]);assert.equal(result.candidates.length,1);assert.equal(result.duplicatesMerged,1);
  assert.equal(deduplicateCandidates([candidate(),candidate({sourceIdentities:{manual_public_source:"fixture-2"},businessName:"Fixture Kitchen Annex",normalizedBusinessName:"fixture kitchen annex",website:"https://annex.example/",phoneNumbers:[]})]).candidates.length,2);
});
test("conflicting evidence is retained with a research issue",()=>{
  const merged=mergeCandidates(candidate(),candidate({address:"Different public address",website:"https://other.example/",phoneNumbers:["08030001000"]}));
  assert.ok(merged.researchIssues.some((issue)=>issue.includes("Conflicting website")));assert.ok(merged.evidence.length>=3);
});
test("outreach readiness requires verified public contact evidence",()=>{
  assert.equal(isOutreachReady(candidate()),true);
  assert.equal(isOutreachReady(candidate({evidence:candidate().evidence.map((item)=>({...item,verificationStatus:"plausible"}))})),false);
});
test("CSV escaping handles commas, quotes, and newlines",()=>{assert.match(candidatesToCsv([candidate({businessName:'Kitchen, "One"\nLagos'})]),/"Kitchen, ""One""\nLagos"/);});
test("summary metrics include evidence and source contribution",()=>{
  const metrics=computeEvaluationMetrics([candidate()],{queriesAttempted:1,providerSuccesses:1,providerFailures:0,totalRawResults:1,duplicatesMerged:0,estimatedProviderCredits:0,failureReferences:[]});
  assert.equal(metrics.outreachReady,1);assert.equal(metrics.evidenceCoveragePercent,100);assert.match(metricsToMarkdown(metrics),/Contribution by source/);
});
test("fixture-mode CLI writes all outputs without provider configuration",async()=>{
  const output="tmp/sales-scout-research/test-fixture";
  const result=await runResearchEvaluation(["--max-queries","4","--output-dir",output]);
  assert.equal(result.metrics.queriesAttempted,4);await Promise.all(["candidates.json","candidates.csv","summary.md"].map((file)=>access(`${output}/${file}`)));
});
test("live mode requires both explicit switches and a configured provider",()=>{
  assert.throws(()=>parseResearchArgs(["--live"]),/RESEARCH_LIVE_REQUIRES_EXPLICIT_CONFIRMATION/);
  assert.throws(()=>parseResearchArgs(["--confirm-live"]),/RESEARCH_LIVE_REQUIRES_EXPLICIT_CONFIRMATION/);
});
test("provider keys never appear in safe errors",()=>{
  const secret="fixture-secret-key";process.env.GEOAPIFY_API_KEY=secret;
  try{assert.throws(()=>parseResearchArgs(["--live","--confirm-live","--limit-per-query","0"]),(error)=>error instanceof Error&&!error.message.includes(secret));}
  finally{delete process.env.GEOAPIFY_API_KEY;}
});
