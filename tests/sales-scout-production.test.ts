import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";
import {
  associateCandidateWithTavilyDocument,
  buildCandidateTavilyQueries,
} from "../src/lib/sales-scout/research/tavily.ts";
import {
  contactsForCandidate,
  productionResearchCostCeiling,
  runSeedFirstProductionResearch,
} from "../src/lib/sales-scout/research/production.ts";
import {
  paginateContactEvidenceRows,
} from "../src/lib/sales-scout/research/quality.ts";
import {
  resolveGeoapifyTerritory,
  mergeGeoapifyPlaceDetails,
} from "../src/lib/sales-scout/research/geoapify.ts";
import {
  matchPublicWebResult,
  mergePublicWebResult,
  researchCandidateWithPublicWeb,
} from "../src/lib/sales-scout/research/public-web.ts";
import { mapSerpApiResponse } from "../src/lib/sales-scout/research/serpapi.ts";
import { assessNigeriaOpportunity, canBecomeOutreachReady, reflectOwnerConfirmedContact } from "../src/lib/sales-scout/research/opportunity.ts";
import { isManualReviewReady } from "../src/lib/sales-scout/research/quality.ts";
import { researchOfficialWebsite } from "../src/lib/sales-scout/research/website.ts";
import {
  ResearchProviderError,
  type ResearchCandidate,
  type ResearchEvidence,
} from "../src/lib/sales-scout/research/types.ts";
import {
  evaluateTerritoryMatch,
  NIGERIAN_STATES_AND_FCT,
  normalizeNigerianState,
  salesScoutCampaignInputSchema,
  unsupportedStructuredCategories,
} from "../src/lib/sales-scout/territory.ts";

const observed = "2026-08-02T10:00:00.000Z";
const evidence = (
  field: string,
  value: string,
  status: "verified" | "plausible" = "verified",
): ResearchEvidence => ({
  source: "geoapify_places",
  sourceUrl: "https://www.geoapify.com/place-details/?id=seed-1",
  observedAt: observed,
  field,
  value,
  confidence: status === "verified" ? "high" : "medium",
  verificationStatus: status,
});

function seed(
  city: string | null = "Ikeja",
  identity: string | undefined = "seed-1",
): ResearchCandidate {
  return {
    sourceIdentities: identity ? { geoapify_places: identity } : {},
    businessName: "Example Kitchen Limited",
    normalizedBusinessName: "example kitchen",
    requestedCategory: "Restaurant",
    requestedTerritory: {
      country: "Nigeria",
      state: "Lagos",
      city: "Ikeja",
      latitude: 6.6018,
      longitude: 3.3515,
      radiusKm: 15,
    },
    providerCategories: ["catering.restaurant"],
    country: "Nigeria",
    state: "Lagos State",
    city,
    address: "12 Allen Avenue, Ikeja",
    latitude: 6.6018,
    longitude: 3.3515,
    website: null,
    phoneNumbers: ["07032821293"],
    emailAddresses: [],
    whatsAppNumbers: [],
    instagram: [],
    facebook: [],
    tiktok: [],
    x: [],
    youtube: [],
    publicDescription: null,
    evidence: [
      evidence("businessName", "Example Kitchen Limited"),
      evidence("requestedCategory", "Restaurant"),
      evidence("country", "Nigeria"),
      evidence("state", "Lagos State"),
      ...(city ? [evidence("city", city)] : []),
      evidence("phone", "07032821293", "plausible"),
    ],
    discoverySources: ["geoapify_places"],
    researchIssues: [],
    firstObservedAt: observed,
    lastObservedAt: observed,
  };
}

test("state aliases normalize and Geoapify resolves State suffixes conservatively", () => {
  assert.equal(NIGERIAN_STATES_AND_FCT.length, 37);
  assert.equal(normalizeNigerianState("Lagos State"), "Lagos");
  assert.equal(normalizeNigerianState("FCT"), "Federal Capital Territory");
  assert.equal(normalizeNigerianState("Abuja Federal Capital Territory"),
    "Federal Capital Territory");
  assert.deepEqual(resolveGeoapifyTerritory({
    features: [{ properties: {
      city: "Ibadan", state: "Oyo State", country_code: "NG", lon: 3.947, lat: 7.3775,
    } }],
  }, { country: "Nigeria", state: "Oyo", city: "Ibadan" }), {
    longitude: 3.947, latitude: 7.3775,
  });
  assert.throws(() => resolveGeoapifyTerritory({
    features: [{ properties: {
      city: "Ogbomosho", state: "Oyo State", country_code: "NG", lon: 4.2, lat: 8.1,
    } }],
  }, { country: "Nigeria", state: "Oyo", city: "Ibadan" }));
  const parsed = salesScoutCampaignInputSchema.parse({
    name: "Akure pilot", status: "draft", country: "Nigeria", state: "Ondo", city: "Iju",
    targetCategories: ["Restaurant"], productScope: null, deliverySummary: null,
    dailyReviewTarget: 10, latitude: null, longitude: null, radiusKm: 15,
    resultLimit: 100, maxEnrichmentCandidates: 2,
  });
  assert.equal(parsed.resultLimit, 100);
  assert.deepEqual(unsupportedStructuredCategories(["Restaurant", "School"]), ["School"]);
});

test("territory radius evidence supports a missing provider city without fabrication", () => {
  const match = evaluateTerritoryMatch({
    providerCountry: "Nigeria", providerState: "Lagos State", providerCity: null,
    latitude: 6.6018, longitude: 3.3515,
    campaign: { state: "Lagos", city: "Ikeja", latitude: 6.6018, longitude: 3.3515, radiusKm: 5 },
  });
  assert.equal(match.matched, true);
  assert.equal(match.basis, "coordinates_within_campaign_radius");
  assert.equal(match.provider.city, null);
});

test("Tavily contacts attach only to defensibly business-specific results", () => {
  const candidate = seed();
  assert.equal(buildCandidateTavilyQueries(candidate).length, 2);
  const official = associateCandidateWithTavilyDocument(candidate, {
    title: "Example Kitchen Limited contact",
    url: "https://examplekitchen.ng/",
    content: "Example Kitchen Limited, 12 Allen Avenue Ikeja. Call 07032821293.",
  }, observed);
  assert.deepEqual(official?.phoneNumbers, ["07032821293", "+2347032821293"]);

  for (const document of [
    {
      title: "Best restaurants in Lagos",
      url: "https://news.example/article/best-restaurants",
      content: "Example Kitchen Limited 07032821293; Second Hotel 08030001002; Third Restaurant 08030001003",
    },
    {
      title: "Example Kitchen Limited booking",
      url: "https://booking.example/example-kitchen",
      content: "Example Kitchen Limited 07032821293",
    },
    {
      title: "Example Kitchen Limited directory",
      url: "https://directory.example/listing/example-kitchen",
      content: "Example Kitchen Limited 07032821293",
    },
  ]) {
    const associated = associateCandidateWithTavilyDocument(candidate, document, observed);
    assert.deepEqual(associated?.phoneNumbers, candidate.phoneNumbers);
    assert.deepEqual(associated?.emailAddresses, []);
  }

  const social = associateCandidateWithTavilyDocument(candidate, {
    title: "Example Kitchen Limited",
    url: "https://instagram.com/examplekitchen",
    content: "Example Kitchen Limited 07032821293 sales@examplekitchen.ng",
  }, observed);
  assert.deepEqual(social?.phoneNumbers, candidate.phoneNumbers);
  assert.equal(social?.instagram.includes("https://instagram.com/examplekitchen"), true);
});

test("Geoapify contact remains plausible while official-site evidence becomes verified", () => {
  const candidate = seed();
  assert.equal(contactsForCandidate(candidate)[0]?.confidence, "plausible");
  const verified = {
    ...candidate,
    evidence: [...candidate.evidence, {
      ...evidence("phone", "07032821293"),
      source: "official_website" as const,
      sourceUrl: "https://examplekitchen.ng/contact",
    }],
  };
  assert.equal(contactsForCandidate(verified)[0]?.confidence, "verified");
});

test("pipeline keeps successful categories and rejects missing stable seed identities", async () => {
  let calls = 0;
  const result = await runSeedFirstProductionResearch({
    territory: {
      country: "Nigeria", state: "Lagos", city: "Ikeja",
      latitude: 6.6018, longitude: 3.3515, radiusKm: 15,
    },
    categories: ["Restaurant", "Hotel"],
    resultLimit: 5,
    maxEnrichmentCandidates: 1,
    tavilyConfigured: false,
  }, {
    geoapify: async () => {
      calls += 1;
      if (calls === 1) throw new ResearchProviderError("GEOAPIFY_SERVER_ERROR");
      return {
        provider: "geoapify_places",
        candidates: [seed(), seed("Ikeja", "")],
        rawResultCount: 2,
        estimatedCredits: 1,
      };
    },
    website: async () => [],
  });
  assert.equal(result.candidates.length, 1);
  assert.equal(result.invalidSeedCount, 1);
  assert.ok(result.warnings.includes("GEOAPIFY_SERVER_ERROR"));
  assert.ok(result.warnings.includes("GEOAPIFY_INVALID_SEED_IDENTITY"));
});

test("deadline stops new enrichment work and preserves discovered seeds", async () => {
  let clock = 0;
  let tavilyCalls = 0;
  const result = await runSeedFirstProductionResearch({
    territory: {
      country: "Nigeria", state: "Lagos", city: "Ikeja",
      latitude: 6.6018, longitude: 3.3515, radiusKm: 15,
    },
    categories: ["Restaurant"],
    resultLimit: 5,
    maxEnrichmentCandidates: 1,
    tavilyConfigured: true,
    timeBudgetMs: 45_000,
  }, {
    now: () => clock,
    minimumRequestBudgetMs: 1_000,
    geoapify: async () => {
      clock = 44_500;
      return {
        provider: "geoapify_places", candidates: [seed()],
        rawResultCount: 1, estimatedCredits: 1,
      };
    },
    tavily: async (candidate) => {
      tavilyCalls += 1;
      return { candidate, discardedSourceDocumentCount: 0, estimatedCredits: 1 };
    },
    website: async () => [],
  });
  assert.equal(tavilyCalls, 0);
  assert.equal(result.candidates.length, 1);
  assert.ok(result.warnings.includes("RESEARCH_TIME_BUDGET_REACHED"));
});

test("Tavily likely-official evidence reaches bounded website research", async () => {
  let websiteCalls = 0;
  const result = await runSeedFirstProductionResearch({
    territory: {
      country: "Nigeria", state: "Lagos", city: "Ikeja",
      latitude: 6.6018, longitude: 3.3515, radiusKm: 15,
    },
    categories: ["Restaurant"],
    resultLimit: 5,
    maxEnrichmentCandidates: 1,
    tavilyConfigured: true,
  }, {
    geoapify: async () => ({
      provider: "geoapify_places", candidates: [seed()],
      rawResultCount: 1, estimatedCredits: 1,
    }),
    tavily: async (candidate) => ({
      candidate: {
        ...candidate,
        website: "https://examplekitchen.ng/",
        evidence: [...candidate.evidence, {
          source: "tavily_search",
          sourceUrl: "https://examplekitchen.ng/",
          observedAt: observed,
          field: "website",
          value: "https://examplekitchen.ng/",
          confidence: "medium",
          verificationStatus: "plausible",
        }],
      },
      discardedSourceDocumentCount: 0,
      estimatedCredits: 1,
    }),
    website: async () => {
      websiteCalls += 1;
      return [];
    },
  });
  assert.equal(websiteCalls, 1);
  assert.equal(result.officialWebsitesResearched, 1);
});

test("contact filtering computes the correct count and second page", () => {
  const rows = Array.from({ length: 30 }, (_, index) => ({
    id: index,
    contact_evidence: [{ route: index % 2 === 0 ? "phone" : "email" }],
  }));
  const result = paginateContactEvidenceRows(rows, "has_phone", 2, 5);
  assert.equal(result.count, 15);
  assert.deepEqual(result.rows.map((row) => row.id), [10, 12, 14, 16, 18]);
});

test("website timeout covers a slow HTML body and clears its timer", async () => {
  const originalFetch = globalThis.fetch;
  let scheduled: (() => void) | undefined;
  let cleared = 0;
  globalThis.fetch = (async (input, init) => {
    if (String(input).endsWith("/robots.txt")) {
      return {
        status: 404,
        ok: false,
        headers: new Headers(),
        arrayBuffer: async () => new ArrayBuffer(0),
      } as Response;
    }
    const signal = init?.signal as AbortSignal;
    return {
      status: 200,
      ok: true,
      headers: new Headers({ "content-type": "text/html" }),
      arrayBuffer: () => new Promise<ArrayBuffer>((_resolve, reject) => {
        signal.addEventListener("abort", () => reject(new DOMException("aborted", "AbortError")));
        scheduled?.();
      }),
    } as Response;
  }) as typeof fetch;
  try {
    await assert.rejects(
      researchOfficialWebsite("https://93.184.216.34/", {
        deadlineAtMs: 100,
        now: () => 0,
        setTimeout: (callback: () => void) => {
          scheduled = callback;
          return 0 as unknown as ReturnType<typeof setTimeout>;
        },
        clearTimeout: () => {
          cleared += 1;
        },
      }),
      (error: unknown) => error instanceof ResearchProviderError &&
        error.reference === "WEBSITE_TIMEOUT",
    );
    assert.ok(cleared >= 2);
  } finally {
    globalThis.fetch = originalFetch;
  }
});
test("production limits align at one hundred results and five Geoapify pages", () => {
  assert.deepEqual(productionResearchCostCeiling({
    categories: 2,
    coordinatesConfigured: false,
    resultLimit: 100,
    maxEnrichmentCandidates: 6,
  }), {
    maximumGeoapifyCalls: 12,
    maximumTavilySearches: 12,
    maximumGeoapifyPlaceDetailsCalls: 6,
    maximumPublicWebSearchCalls: 24,
    maximumOfficialWebsites: 6,
    maximumOfficialWebsitePages: 30,
    maximumStagedCandidates: 200,
  });
  assert.rejects(() => runSeedFirstProductionResearch({
    territory: { country: "Nigeria", state: "Lagos", city: "Ikeja" },
    categories: ["Restaurant"],
    resultLimit: 101,
    maxEnrichmentCandidates: 6,
    tavilyConfigured: false,
  }));
});

test("Nigeria-first readiness accepts phone, Instagram, Facebook, or website without requiring a website", () => {
  const variants = [
    { phoneNumbers:["07032821293"], field:"phone", value:"07032821293" },
    { instagram:["https://instagram.com/examplekitchen"], field:"instagram", value:"https://instagram.com/examplekitchen" },
    { facebook:["https://facebook.com/examplekitchen"], field:"facebook", value:"https://facebook.com/examplekitchen" },
    { website:"https://examplekitchen.ng", field:"website", value:"https://examplekitchen.ng" },
  ];
  for (const variant of variants) {
    const candidate = { ...seed(), website:null, phoneNumbers:[], instagram:[], facebook:[],
      ...variant, evidence:[...seed().evidence.filter((item)=>item.field!=="phone"),
        evidence(variant.field, variant.value, "plausible")] } as ResearchCandidate;
    assert.equal(isManualReviewReady(candidate), true, variant.field);
    assert.equal(contactsForCandidate(candidate).length, 1, variant.field);
  }
});

test("phone and Instagram remain separate evidence-backed contact routes", () => {
  const instagram="https://instagram.com/examplekitchen";
  const candidate={...seed(),instagram:[instagram],evidence:[...seed().evidence,evidence("instagram",instagram,"plausible")]};
  assert.deepEqual(contactsForCandidate(candidate).map((contact)=>contact.route).sort(),["instagram","phone"]);
  assert.deepEqual(candidate.whatsAppNumbers,[]);
});

test("Geoapify Place Details merges alternate contacts but never infers WhatsApp", () => {
  const enriched = mergeGeoapifyPlaceDetails({ ...seed(), phoneNumbers:[], emailAddresses:[] }, {
    features:[{properties:{feature_type:"details",website:"https://details.example/",contact:{
      phone:"08030001000",phone_other:["08030001001"],email:"hello@details.example",
    }}}],
  }, observed);
  assert.deepEqual(enriched.phoneNumbers,["+2348030001000","+2348030001001"]);
  assert.deepEqual(enriched.emailAddresses,["hello@details.example"]);
  assert.deepEqual(enriched.whatsAppNumbers,[]);
});

test("explicit wa.me evidence creates WhatsApp while an ordinary phone does not", () => {
  const withoutContacts={...seed(),phoneNumbers:[],evidence:seed().evidence.filter((item)=>item.field!=="phone")};
  const ordinary=mergePublicWebResult(withoutContacts,{
    position:1,title:"Example Kitchen Limited Ikeja Restaurant",link:"https://examplekitchen.ng/contact",
    snippet:"Call 08030001000 in Ikeja for restaurant bookings.",
  },observed).candidate;
  assert.deepEqual(ordinary.phoneNumbers,["+2348030001000"]);
  assert.deepEqual(ordinary.whatsAppNumbers,[]);
  const explicit=mergePublicWebResult(withoutContacts,{
    position:1,title:"Example Kitchen Limited Ikeja Restaurant",link:"https://wa.me/2348030001000",
    snippet:"Example Kitchen Limited restaurant in Ikeja, Lagos.",
  },observed).candidate;
  assert.deepEqual(explicit.whatsAppNumbers,["+2348030001000"]);
});

test("entity matching rejects same-name wrong-city social and accepts corroborated local social", () => {
  const candidate={...seed(),phoneNumbers:[],evidence:seed().evidence.filter((item)=>item.field!=="phone")};
  const wrong={position:1,title:"Example Kitchen Limited Victoria Island",link:"https://instagram.com/examplekitchen",
    snippet:"Restaurant in Victoria Island, Lagos"};
  assert.equal(matchPublicWebResult(candidate,wrong).status,"rejected");
  assert.deepEqual(mergePublicWebResult(candidate,wrong,observed).candidate.instagram,[]);
  const local={...wrong,title:"Example Kitchen Limited Ikeja Restaurant",snippet:"Restaurant in Ikeja, Lagos"};
  assert.equal(matchPublicWebResult(candidate,local).status,"verified");
  assert.deepEqual(mergePublicWebResult(candidate,local,observed).candidate.instagram,[local.link]);
});

test("bounded public-web research stops at useful evidence and enforces four calls", async () => {
  const candidate={...seed(),phoneNumbers:[],evidence:seed().evidence.filter((item)=>item.field!=="phone")};
  let calls=0;
  const exhausted=await researchCandidateWithPublicWeb(candidate,async({query})=>{
    calls+=1;return{provider:"serpapi",query,results:[],callReference:`call-${calls}`};
  },{deadlineAtMs:Date.parse(observed)+60_000,now:()=>Date.parse(observed)});
  assert.equal(calls,4);assert.equal(exhausted.actualCalls,4);
  calls=0;
  const found=await researchCandidateWithPublicWeb(candidate,async({query})=>{
    calls+=1;return{provider:"serpapi",query,callReference:"found",results:[{
      position:1,title:"Example Kitchen Limited Ikeja Restaurant",link:"https://facebook.com/examplekitchen",
      snippet:"Restaurant in Ikeja, Lagos",
    }]};
  },{deadlineAtMs:Date.parse(observed)+60_000,now:()=>Date.parse(observed)});
  assert.equal(calls,1);assert.equal(found.candidate.facebook.length,1);
});

test("public-search provider failure retains the structured candidate", async () => {
  const candidate={...seed(),phoneNumbers:[],evidence:seed().evidence.filter((item)=>item.field!=="phone")};
  const result=await runSeedFirstProductionResearch({territory:candidate.requestedTerritory,categories:["Restaurant"],resultLimit:5,maxEnrichmentCandidates:1,tavilyConfigured:false,publicWebConfigured:true,geoapifyPlaceDetailsConfigured:false},{
    geoapify:async()=>({provider:"geoapify_places",candidates:[candidate],rawResultCount:1,estimatedCredits:1}),
    publicWebSearch:async()=>{throw new ResearchProviderError("SERPAPI_SERVER_ERROR");},website:async()=>[],
  });
  assert.equal(result.candidates.length,1);
  assert.ok(result.candidates[0].candidate.researchIssues.includes("SERPAPI_SERVER_ERROR"));
});

test("opportunity factors are deterministic, website absence is not penalized, and DNC blocks outreach", () => {
  const candidate=seed();const territory=evaluateTerritoryMatch({providerCountry:"Nigeria",providerState:"Lagos",providerCity:"Ikeja",latitude:6.6018,longitude:3.3515,campaign:{...candidate.requestedTerritory,radiusKm:candidate.requestedTerritory.radiusKm??15}});
  const without=assessNigeriaOpportunity({candidate,contacts:contactsForCandidate(candidate),territoryMatch:territory});
  const withWebsite={...candidate,website:"https://examplekitchen.ng",evidence:[...candidate.evidence,evidence("website","https://examplekitchen.ng","plausible")]};
  const withSite=assessNigeriaOpportunity({candidate:withWebsite,contacts:contactsForCandidate(withWebsite),territoryMatch:territory});
  assert.deepEqual(assessNigeriaOpportunity({candidate,contacts:contactsForCandidate(candidate),territoryMatch:territory}),without);
  assert.equal(without.score,withSite.score);
  assert.equal(canBecomeOutreachReady({baseReady:true,doNotContact:true}),false);
  assert.equal(assessNigeriaOpportunity({candidate,contacts:contactsForCandidate(candidate),territoryMatch:territory,doNotContact:true}).score,0);
  const confirmed=reflectOwnerConfirmedContact(without);assert.ok(confirmed.score>=without.score);
  assert.match(confirmed.recommendedNextAction,/capture and qualify/);
});

test("Casper and Gambini's Ikeja regression surfaces Instagram and remains review-ready", async () => {
  const fixture=JSON.parse(await readFile("scripts/fixtures/sales-scout-research/casper-gambinis-ikeja.json","utf8")) as {businessName:string;city:string;state:string;address:string;placeId:string;organicResults:Array<{position:number;title:string;link:string;snippet:string}>};
  const candidate={...seed(),sourceIdentities:{geoapify_places:fixture.placeId},businessName:fixture.businessName,normalizedBusinessName:"casper gambini s",city:fixture.city,state:fixture.state,address:fixture.address,phoneNumbers:[],website:null,evidence:seed().evidence.filter((item)=>item.field!=="phone").map((item)=>item.field==="businessName"?{...item,value:fixture.businessName}:item)};
  const mapped=mapSerpApiResponse({search_metadata:{id:"fixture-search"},organic_results:fixture.organicResults});
  const result=await runSeedFirstProductionResearch({territory:candidate.requestedTerritory,categories:["Restaurant"],resultLimit:5,maxEnrichmentCandidates:1,tavilyConfigured:false,publicWebConfigured:true,geoapifyPlaceDetailsConfigured:false},{
    geoapify:async()=>({provider:"geoapify_places",candidates:[candidate],rawResultCount:1,estimatedCredits:1}),
    publicWebSearch:async({query})=>({provider:"serpapi",query,callReference:mapped.callReference,results:mapped.results}),website:async()=>[],
  });
  assert.equal(result.candidates.length,1);assert.equal(result.candidates[0].candidate.website,null);
  assert.equal(result.candidates[0].candidate.instagram.length,1);assert.equal(result.candidates[0].manualReviewReady,true);
  assert.ok(result.candidates[0].opportunity.score>0);assert.ok(result.candidates[0].opportunity.factors.length>0);
});
