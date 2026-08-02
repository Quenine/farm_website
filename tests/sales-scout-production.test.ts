import assert from "node:assert/strict";
import test from "node:test";
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
} from "../src/lib/sales-scout/research/geoapify.ts";
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

test("production limits align at one hundred results and five Geoapify pages", () => {
  assert.deepEqual(productionResearchCostCeiling({
    categories: 2,
    coordinatesConfigured: false,
    resultLimit: 100,
    maxEnrichmentCandidates: 6,
  }), {
    maximumGeoapifyCalls: 11,
    maximumTavilySearches: 12,
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
