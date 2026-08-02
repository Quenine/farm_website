import assert from "node:assert/strict";
import { access, readFile } from "node:fs/promises";
import test from "node:test";
import {
  buildGeoapifyPlacesUrl,
  buildGeoapifyTerritoryUrl,
  buildTavilyQueries,
  buildWebsiteResearchPlan,
  candidatesToCsv,
  classifyTavilyResultUrl,
  computeEvaluationMetrics,
  deduplicateCandidates,
  extractWebsiteFacts,
  geoapifyCategory,
  hasOfficialWebsite,
  hasPublicSocialProfile,
  isOutreachReady,
  isResearchReady,
  isPrivateOrReservedIp,
  mapGeoapifyPlacesResponse,
  mapTavilySearchResponse,
  mergeCandidates,
  mergeWebsiteFactsIntoCandidate,
  metricsToMarkdown,
  providerStatusReference,
  resolveGeoapifyTerritory,
  researchOfficialWebsite,
  robotsAllows,
  validatePublicWebsiteUrl,
  type EvaluationMetrics,
  type ResearchCandidate,
  type ResearchQuery,
} from "../src/lib/sales-scout/research/index.ts";
import {
  buildLiveExecutionPlan,
  parseResearchArgs,
  runResearchEvaluation,
  withOneRetry,
} from "../scripts/sales-scout-research-eval.ts";
import { ResearchProviderError } from "../src/lib/sales-scout/research/types.ts";

const observedAt = "2026-08-02T09:00:00.000Z";
const query: ResearchQuery = {
  territory: {
    country: "Nigeria",
    state: "Lagos",
    city: "Lagos",
    latitude: 6.5,
    longitude: 3.4,
    radiusKm: 20,
  },
  category: "Restaurant",
  limit: 5,
};

function candidate(patch: Partial<ResearchCandidate> = {}): ResearchCandidate {
  const sourceUrl = "https://fixture-business.example/";
  return {
    sourceIdentities: { manual_public_source: "fixture-1" },
    businessName: "Fixture Kitchen",
    normalizedBusinessName: "fixture kitchen",
    requestedCategory: "Restaurant",
    requestedTerritory: { ...query.territory },
    providerCategories: ["Restaurant"],
    country: "Nigeria",
    state: "Lagos",
    city: "Lagos",
    address: null,
    latitude: null,
    longitude: null,
    website: sourceUrl,
    phoneNumbers: ["+2348030001000"],
    emailAddresses: [],
    whatsAppNumbers: [],
    instagram: [],
    facebook: [],
    tiktok: [],
    x: [],
    youtube: [],
    publicDescription: null,
    evidence: [
      {
        source: "manual_public_source",
        sourceUrl,
        observedAt,
        field: "requestedCategory",
        value: "Restaurant",
        confidence: "high",
        verificationStatus: "verified",
      },
      {
        source: "manual_public_source",
        sourceUrl,
        observedAt,
        field: "country",
        value: "Nigeria",
        confidence: "high",
        verificationStatus: "verified",
      },
      {
        source: "manual_public_source",
        sourceUrl,
        observedAt,
        field: "state",
        value: "Lagos",
        confidence: "high",
        verificationStatus: "verified",
      },
      {
        source: "manual_public_source",
        sourceUrl,
        observedAt,
        field: "city",
        value: "Lagos",
        confidence: "high",
        verificationStatus: "verified",
      },
      {
        source: "official_website",
        sourceUrl,
        observedAt,
        field: "phone",
        value: "+2348030001000",
        confidence: "high",
        verificationStatus: "verified",
      },
      {
        source: "official_website",
        sourceUrl,
        observedAt,
        field: "website",
        value: sourceUrl,
        confidence: "high",
        verificationStatus: "verified",
      },
    ],
    discoverySources: ["manual_public_source", "official_website"],
    researchIssues: [],
    firstObservedAt: observedAt,
    lastObservedAt: observedAt,
    ...patch,
  };
}

function metricContext(mode: EvaluationMetrics["mode"] = "synthetic_fixture") {
  return {
    mode,
    queriesAttempted: 1,
    providerSuccesses: 1,
    providerFailures: 0,
    totalRawResults: 1,
    duplicatesMerged: 0,
    estimatedProviderCredits: 0,
    failureReferences: [],
  };
}

async function withMockedFetch(
  mock: typeof fetch,
  operation: () => Promise<void>,
) {
  const original = globalThis.fetch;
  globalThis.fetch = mock;
  try {
    await operation();
  } finally {
    globalThis.fetch = original;
  }
}

test("territory and category queries are deterministic and Nigeria-specific", () => {
  const territoryUrl = buildGeoapifyTerritoryUrl(query.territory);
  assert.match(territoryUrl.searchParams.get("text") ?? "", /Lagos, Lagos, Nigeria/);
  assert.equal(territoryUrl.searchParams.get("type"), "city");
  assert.equal(territoryUrl.searchParams.get("filter"), "countrycode:ng");
  assert.match(
    buildGeoapifyPlacesUrl(query, 3.4, 6.5, 1).searchParams.get("categories") ?? "",
    /catering\.restaurant/,
  );
  assert.deepEqual(buildTavilyQueries(query), [
    "Restaurant businesses in Lagos, Lagos, Nigeria official website",
    "Restaurant in Lagos, Lagos, Nigeria official Instagram Facebook contact",
  ]);
});

test("unsupported Geoapify categories are not guessed", () => {
  assert.equal(geoapifyCategory("Caterer"), null);
  assert.equal(geoapifyCategory("Food Processor"), null);
});

test("Geoapify territory resolution selects a matching Nigerian city", () => {
  const payload = {
    features: [
      { properties: {
        city: "Lagos", state: "Lagos", country_code: "gh", lon: 1, lat: 2,
      } },
      { properties: {
        locality: "Ibadan", state: "Oyo", country_code: "NG", lon: 3.947, lat: 7.3775,
      } },
    ],
  };
  assert.deepEqual(
    resolveGeoapifyTerritory(payload, {
      country: "Nigeria", state: "Oyo", city: "Ibadan",
    }),
    { longitude: 3.947, latitude: 7.3775 },
  );
  assert.throws(
    () => resolveGeoapifyTerritory(payload, {
      country: "Nigeria", state: "Enugu", city: "Enugu",
    }),
    (error) => error instanceof ResearchProviderError &&
      error.reference === "GEOAPIFY_TERRITORY_NOT_RESOLVED",
  );
});

test("Geoapify mapping preserves returned facts and their evidence", async () => {
  const payload = JSON.parse(await readFile(
    "scripts/fixtures/sales-scout-research/geoapify-places.json",
    "utf8",
  ));
  const mapped = mapGeoapifyPlacesResponse(
    payload,
    {
      ...query,
      category: "Supermarket",
      territory: { country: "Nigeria", state: "Oyo", city: "Ibadan" },
    },
    observedAt,
  );
  assert.equal(mapped[0].businessName, "Riverbend Market");
  assert.equal(mapped[0].city, "Ibadan");
  assert.ok(mapped[0].evidence.some((item) =>
    item.field === "city" && item.value === "Ibadan" &&
    item.verificationStatus === "verified"
  ));
  assert.ok(mapped[0].evidence.some((item) =>
    item.field === "providerCategory" && item.value === "commercial.supermarket"
  ));
  assert.ok(mapped[0].evidence.some((item) =>
    item.field === "requestedCategory" && item.verificationStatus === "verified"
  ));
  assert.equal(mapped[0].emailAddresses.length, 0);
  assert.equal(mapped[1].website, null);
  assert.equal(mapped[1].phoneNumbers.length, 0);
});

test("Tavily query territory remains context and never becomes candidate geography", async () => {
  const payload = JSON.parse(await readFile(
    "scripts/fixtures/sales-scout-research/tavily-search.json",
    "utf8",
  ));
  const mapped = mapTavilySearchResponse(
    payload,
    {
      ...query,
      territory: { country: "Nigeria", state: "Enugu", city: "Enugu" },
    },
    observedAt,
  );
  assert.equal(mapped[0].country, null);
  assert.equal(mapped[0].state, null);
  assert.equal(mapped[0].city, null);
  assert.equal(mapped[0].requestedTerritory.city, "Enugu");
  assert.ok(mapped[0].researchIssues.some((issue) => /territory.*unverified/i.test(issue)));
});

test("Tavily URLs distinguish likely official, discovery-only, and social results", () => {
  assert.equal(
    classifyTavilyResultUrl(
      "Coal City Kitchen",
      "https://coalcitykitchen.example/",
    ).kind,
    "likely_official",
  );
  assert.equal(
    classifyTavilyResultUrl(
      "Coal City Kitchen",
      "https://directory.example/listing/coal-city",
    ).kind,
    "discovery_only",
  );
  assert.equal(
    classifyTavilyResultUrl(
      "Coal City Kitchen",
      "https://news.example/article/coal-city-kitchen",
    ).kind,
    "discovery_only",
  );
  assert.equal(
    classifyTavilyResultUrl(
      "Coal City Kitchen",
      "https://instagram.com/coalcitykitchen",
    ).kind,
    "social_profile",
  );
});

test("Tavily search and social URLs do not become verified websites", () => {
  const mapped = mapTavilySearchResponse({
    results: [
      {
        title: "Coal City Kitchen directory",
        url: "https://directory.example/listing/coal-city",
      },
      {
        title: "Coal City Kitchen",
        url: "https://instagram.com/coalcitykitchen",
      },
    ],
  }, query, observedAt);
  assert.equal(mapped[0].website, null);
  assert.equal(mapped[1].website, null);
  assert.equal(mapped[1].instagram.length, 1);
  assert.equal(mapped[1].evidence.find((item) => item.field === "instagram")
    ?.verificationStatus, "plausible");
  assert.equal(hasPublicSocialProfile(mapped[1]), false);
});

test("official website and social metrics require same-candidate verified evidence", () => {
  const social = "https://instagram.com/fixturekitchen";
  const verified = candidate({
    instagram: [social],
    evidence: [
      ...candidate().evidence,
      {
        source: "official_website",
        sourceUrl: candidate().website!,
        observedAt,
        field: "instagram",
        value: social,
        confidence: "high",
        verificationStatus: "verified",
      },
    ],
  });
  const plausible = candidate({
    sourceIdentities: { manual_public_source: "fixture-2" },
    website: "https://other.example/",
    instagram: [social],
    evidence: candidate().evidence.filter((item) =>
      !["website", "phone"].includes(item.field)
    ),
  });
  assert.equal(hasOfficialWebsite(verified), true);
  assert.equal(hasPublicSocialProfile(verified), true);
  assert.equal(hasOfficialWebsite(plausible), false);
  assert.equal(hasPublicSocialProfile(plausible), false);
  const metrics = computeEvaluationMetrics([verified, plausible], metricContext());
  assert.equal(metrics.withOfficialWebsite, 1);
  assert.equal(metrics.withSocialProfile, 1);
});

test("contact evidence coverage cannot leak between candidates", () => {
  const sharedPhone = "+2348030001000";
  const supported = candidate({
    website: null,
    phoneNumbers: [sharedPhone],
    evidence: candidate().evidence.filter((item) => item.field !== "website"),
  });
  const unsupported = candidate({
    sourceIdentities: { manual_public_source: "fixture-2" },
    businessName: "Other Kitchen",
    normalizedBusinessName: "other kitchen",
    website: null,
    phoneNumbers: [sharedPhone],
    evidence: candidate().evidence.filter((item) =>
      item.field !== "website" && item.field !== "phone"
    ),
  });
  const metrics = computeEvaluationMetrics([supported, unsupported], metricContext());
  assert.equal(metrics.withPhone, 1);
  assert.equal(metrics.withAnyUsableContact, 1);
  assert.equal(metrics.evidenceCoveragePercent, 50);
});

test("website research plan deduplicates eligible hosts and remains bounded", () => {
  const geoEvidence = {
    source: "geoapify_places" as const,
    sourceUrl: "https://geoapify.example/place",
    observedAt,
    field: "website",
    value: "https://shared.example/",
    confidence: "medium" as const,
    verificationStatus: "plausible" as const,
  };
  const first = candidate({
    website: "https://shared.example/",
    evidence: [...candidate().evidence, geoEvidence],
  });
  const second = candidate({
    sourceIdentities: { geoapify_places: "second" },
    website: "https://shared.example/contact",
    evidence: [...candidate().evidence, { ...geoEvidence, value: "https://shared.example/contact" }],
  });
  const plan = buildWebsiteResearchPlan([first, second], 1);
  assert.equal(plan.length, 1);
  assert.deepEqual(plan[0].candidateIndexes, [0, 1]);
});

test("private, bracketed, and IPv4-mapped destinations are rejected", () => {
  for (const address of [
    "127.0.0.2",
    "[::1]",
    "::ffff:127.0.0.1",
    "::ffff:7f00:1",
    "::ffff:10.0.0.1",
    "::ffff:0a00:1",
    "fc00::1",
    "fe80::1",
    "2001:db8::1",
  ]) assert.equal(isPrivateOrReservedIp(address), true, address);
  assert.throws(() => validatePublicWebsiteUrl("http://[::1]/"));
  assert.throws(() =>
    validatePublicWebsiteUrl("https://public.example/", ["::ffff:0a00:1"])
  );
  assert.doesNotThrow(() =>
    validatePublicWebsiteUrl("https://public.example/", ["8.8.8.8"])
  );
});

test("robots disallow applies without blocking public contact", async () => {
  const robots = await readFile(
    "scripts/fixtures/sales-scout-research/robots.txt",
    "utf8",
  );
  assert.equal(robotsAllows(robots, "/private/customer"), false);
  assert.equal(robotsAllows(robots, "/contact"), true);
});

test("official website loads robots before its first content page", async () => {
  const calls: string[] = [];
  await withMockedFetch(
    (async (input) => {
      const url = new URL(String(input));
      calls.push(url.href);
      if (url.pathname === "/robots.txt") {
        return new Response("User-agent: *\nDisallow:", {
          status: 200,
          headers: { "content-type": "text/plain" },
        });
      }
      return new Response("<html><body>Allowed</body></html>", {
        status: 200,
        headers: { "content-type": "text/html" },
      });
    }) as typeof fetch,
    async () => {
      const pages = await researchOfficialWebsite("http://93.184.216.34/");
      assert.equal(pages.length, 1);
    },
  );
  assert.deepEqual(calls, [
    "http://93.184.216.34/robots.txt",
    "http://93.184.216.34/",
  ]);
});

test("robots denial and unavailable rules prevent content fetching", async () => {
  for (const fixture of [
    { status: 200, body: "User-agent: *\nDisallow: /blocked",
      reference: "WEBSITE_ROBOTS_DISALLOWED" },
    { status: 403, body: "", reference: "WEBSITE_ROBOTS_UNAVAILABLE" },
  ]) {
    const calls: string[] = [];
    await withMockedFetch(
      (async (input) => {
        const url = new URL(String(input));
        calls.push(url.href);
        return new Response(fixture.body, {
          status: fixture.status,
          headers: { "content-type": "text/plain" },
        });
      }) as typeof fetch,
      async () => {
        await assert.rejects(
          researchOfficialWebsite("http://93.184.216.34/blocked"),
          (error) => error instanceof ResearchProviderError &&
            error.reference === fixture.reference,
        );
      },
    );
    assert.deepEqual(calls, ["http://93.184.216.34/robots.txt"]);
  }
});

test("cross-origin redirect loads destination robots before redirected content", async () => {
  const calls: string[] = [];
  await withMockedFetch(
    (async (input) => {
      const url = new URL(String(input));
      calls.push(url.href);
      if (url.hostname === "93.184.216.34" && url.pathname === "/robots.txt") {
        return new Response("User-agent: *\nDisallow:", {
          status: 200,
          headers: { "content-type": "text/plain" },
        });
      }
      if (url.hostname === "93.184.216.34") {
        return new Response(null, {
          status: 302,
          headers: { location: "http://8.8.8.8/blocked" },
        });
      }
      if (url.pathname === "/robots.txt") {
        return new Response("User-agent: *\nDisallow: /blocked", {
          status: 200,
          headers: { "content-type": "text/plain" },
        });
      }
      throw new Error("redirected content must not be fetched");
    }) as typeof fetch,
    async () => {
      await assert.rejects(
        researchOfficialWebsite("http://93.184.216.34/start"),
        (error) => error instanceof ResearchProviderError &&
          error.reference === "WEBSITE_ROBOTS_DISALLOWED",
      );
    },
  );
  assert.deepEqual(calls, [
    "http://93.184.216.34/robots.txt",
    "http://93.184.216.34/start",
    "http://8.8.8.8/robots.txt",
  ]);
});

test("website extraction normalizes contacts, socials, and structured location", async () => {
  const html = await readFile(
    "scripts/fixtures/sales-scout-research/official-homepage.html",
    "utf8",
  );
  const facts = extractWebsiteFacts(
    html,
    "https://sunrisefoods.example/",
    observedAt,
  );
  assert.deepEqual(facts.phoneNumbers, ["+2348030002001"]);
  assert.deepEqual(facts.emailAddresses, ["sales@sunrisefoods.example"]);
  assert.deepEqual(facts.whatsAppNumbers, ["+2348030002001"]);
  assert.equal(facts.instagram.length, 1);
  assert.equal(facts.facebook.length, 1);
  assert.equal(facts.tiktok.length, 1);
  assert.equal(facts.x.length, 1);
  assert.equal(facts.youtube.length, 1);
  assert.equal(facts.city, "Lagos");
  assert.equal(facts.state, "Lagos");
  assert.equal(facts.country, "NG");
  assert.deepEqual(facts.schemaTypes, ["Restaurant"]);
  assert.ok(facts.evidence.some((item) =>
    item.field === "schemaType" && item.value === "Restaurant" &&
    item.verificationStatus === "verified"
  ));
  assert.ok(facts.evidence.every((item) => item.sourceUrl));
});

test("malformed canonical tags do not crash website extraction", () => {
  const facts = extractWebsiteFacts(
    '<link rel="canonical" href="http://["><a href="tel:08030001000">Call</a>',
    "https://safe.example/",
    observedAt,
  );
  assert.equal(facts.canonicalUrl, "https://safe.example/");
  assert.deepEqual(facts.phoneNumbers, ["+2348030001000"]);
});

test("official schema types verify only conservative category mappings", () => {
  const factsForType = (schemaType: string) => extractWebsiteFacts(
    `<script type="application/ld+json">${JSON.stringify({
      "@context": "https://schema.org",
      "@type": schemaType,
      address: {
        "@type": "PostalAddress",
        addressLocality: "Lagos",
        addressRegion: "Lagos",
        addressCountry: "NG",
      },
    })}</script>`,
    "https://fixture-business.example/",
    observedAt,
  );
  const withoutVerifiedCategory = (
    requestedCategory: ResearchCandidate["requestedCategory"],
  ) => candidate({
    requestedCategory,
    evidence: candidate().evidence.filter((item) =>
      item.field !== "requestedCategory"
    ),
  });

  const restaurant = mergeWebsiteFactsIntoCandidate(
    withoutVerifiedCategory("Restaurant"),
    factsForType("Restaurant"),
    "https://fixture-business.example/",
  );
  assert.ok(restaurant.evidence.some((item) =>
    item.field === "requestedCategory" &&
    item.value === "Restaurant" &&
    item.verificationStatus === "verified"
  ));

  const supermarket = mergeWebsiteFactsIntoCandidate(
    withoutVerifiedCategory("Supermarket"),
    factsForType("https://schema.org/GroceryStore"),
    "https://fixture-business.example/",
  );
  assert.deepEqual(
    supermarket.evidence.filter((item) =>
      item.field === "schemaType"
    ).map((item) => item.value),
    ["GroceryStore"],
  );
  assert.ok(supermarket.evidence.some((item) =>
    item.field === "requestedCategory" &&
    item.value === "Supermarket" &&
    item.verificationStatus === "verified"
  ));

  const unsupported = mergeWebsiteFactsIntoCandidate(
    withoutVerifiedCategory("Food Vendor"),
    factsForType("GroceryStore"),
    "https://fixture-business.example/",
  );
  assert.equal(unsupported.evidence.some((item) =>
    item.field === "requestedCategory" &&
    item.value === "Food Vendor" &&
    item.verificationStatus === "verified"
  ), false);
});

test("Tavily candidate becomes research-ready only after verified website facts", () => {
  const discovered = mapTavilySearchResponse({
    results: [{
      title: "Ready Kitchen | Official Website",
      url: "https://readykitchen.example/",
      content: "Discovery snippet only.",
    }],
  }, query, observedAt)[0];
  assert.equal(isResearchReady(discovered), false);
  assert.equal(isOutreachReady(discovered), false);

  const facts = extractWebsiteFacts(
    `<script type="application/ld+json">${JSON.stringify({
      "@context": "https://schema.org",
      "@type": "Restaurant",
      address: {
        "@type": "PostalAddress",
        addressLocality: "Lagos",
        addressRegion: "Lagos",
        addressCountry: "NG",
      },
    })}</script><a href="tel:+2348030005000">Call</a>`,
    "https://readykitchen.example/",
    observedAt,
  );
  const enriched = mergeWebsiteFactsIntoCandidate(
    discovered,
    facts,
    "https://readykitchen.example/",
  );
  assert.equal(isResearchReady(enriched), true);
  assert.equal(isOutreachReady(enriched), true);
});

test("transitive deduplication is order-independent", () => {
  const a = candidate({
    sourceIdentities: { manual_public_source: "a" },
    businessName: "Alpha",
    normalizedBusinessName: "alpha",
    website: "https://shared.example/",
    phoneNumbers: [],
  });
  const b = candidate({
    sourceIdentities: { manual_public_source: "b" },
    businessName: "Bridge",
    normalizedBusinessName: "bridge",
    website: "https://shared.example/contact",
    phoneNumbers: ["+2348030009999"],
  });
  const c = candidate({
    sourceIdentities: { manual_public_source: "c" },
    businessName: "Charlie",
    normalizedBusinessName: "charlie",
    website: "https://charlie.example/",
    phoneNumbers: ["08030009999"],
  });
  for (const permutation of [
    [a, b, c], [a, c, b], [b, a, c], [b, c, a], [c, a, b], [c, b, a],
  ]) {
    const result = deduplicateCandidates(permutation);
    assert.equal(result.candidates.length, 1);
    assert.equal(result.duplicatesMerged, 2);
  }
});

test("conflicting evidence is retained with a research issue", () => {
  const merged = mergeCandidates(
    candidate(),
    candidate({
      address: "Different public address",
      website: "https://other.example/",
      phoneNumbers: ["+2348030001000"],
    }),
  );
  assert.ok(merged.researchIssues.some((issue) => issue.includes("Conflicting website")));
  assert.ok(merged.evidence.length >= 6);
});

test("outreach readiness requires verified relevance and contact", () => {
  assert.equal(isOutreachReady(candidate()), true);

  const unverifiedTerritory = candidate({
    evidence: candidate().evidence.filter((item) => item.field !== "city"),
  });
  assert.equal(isOutreachReady(unverifiedTerritory), false);

  const unverifiedCategory = candidate({
    evidence: candidate().evidence.filter((item) =>
      item.field !== "requestedCategory"
    ),
  });
  assert.equal(isOutreachReady(unverifiedCategory), false);

  const unverifiedContact = candidate({
    evidence: candidate().evidence.map((item) =>
      ["phone", "website"].includes(item.field)
        ? { ...item, verificationStatus: "plausible" }
        : item
    ),
  });
  assert.equal(isOutreachReady(unverifiedContact), false);
  assert.equal(isResearchReady(candidate()), true);
});
test("provider status mapping and retry eligibility are narrow", async () => {
  assert.equal(providerStatusReference("GEOAPIFY", 400), "GEOAPIFY_BAD_REQUEST");
  assert.equal(providerStatusReference("TAVILY", 401), "TAVILY_UNAUTHORIZED");
  assert.equal(providerStatusReference("TAVILY", 403), "TAVILY_FORBIDDEN");
  assert.equal(providerStatusReference("GEOAPIFY", 429), "GEOAPIFY_RATE_LIMITED");
  assert.equal(providerStatusReference("TAVILY", 503), "TAVILY_SERVER_ERROR");

  let retryableCalls = 0;
  const result = await withOneRetry(async () => {
    retryableCalls += 1;
    if (retryableCalls === 1) throw new ResearchProviderError("TAVILY_RATE_LIMITED");
    return "ok";
  });
  assert.equal(result, "ok");
  assert.equal(retryableCalls, 2);

  let unauthorizedCalls = 0;
  await assert.rejects(withOneRetry(async () => {
    unauthorizedCalls += 1;
    throw new ResearchProviderError("TAVILY_UNAUTHORIZED");
  }));
  assert.equal(unauthorizedCalls, 1);
});

test("CSV escaping handles commas, quotes, and newlines", () => {
  assert.match(
    candidatesToCsv([candidate({ businessName: 'Kitchen, "One"\nLagos' })]),
    /"Kitchen, ""One""\nLagos"/,
  );
});

test("summary metrics disclose synthetic fixture mode", () => {
  const metrics = computeEvaluationMetrics([candidate()], metricContext());
  const markdown = metricsToMarkdown(metrics);
  assert.equal(metrics.outreachReady, 1);
  assert.equal(metrics.evidenceCoveragePercent, 100);
  assert.match(markdown, /Mode: synthetic fixture/);
  assert.match(markdown, /These numbers validate pipeline behaviour only/);
  assert.match(markdown, /They do not measure real Nigerian provider coverage/);
  assert.match(markdown, /Contribution by source/);
});

test("fixture-mode CLI exercises mappers, extraction, deduplication, and outputs", async () => {
  const output = "tmp/sales-scout-research/test-fixture";
  const result = await runResearchEvaluation([
    "--max-queries", "4",
    "--max-websites", "4",
    "--output-dir", output,
  ]);
  assert.equal(result.metrics.mode, "synthetic_fixture");
  assert.equal(result.metrics.queriesAttempted, 4);
  assert.equal(
    result.metrics.outreachReady,
    result.candidates.filter(isOutreachReady).length,
  );
  assert.ok(result.candidates.some((item) =>
    item.discoverySources.includes("geoapify_places") &&
    item.discoverySources.includes("tavily_search") &&
    item.discoverySources.includes("official_website")
  ));
  assert.ok(result.candidates.some((item) =>
    item.evidence.some((evidence) =>
      evidence.source === "official_website" && evidence.field === "phone"
    )
  ));
  await Promise.all([
    "candidates.json", "candidates.csv", "summary.md",
  ].map((file) => access(`${output}/${file}`)));
  const summary = await readFile(`${output}/summary.md`, "utf8");
  assert.match(summary, /Mode: synthetic fixture/);
  assert.match(summary, /pipeline behaviour only/);
});

test("live execution plan includes one retry and remains bounded", () => {
  const withCoordinates = query;
  const withoutCoordinates: ResearchQuery = {
    ...query,
    territory: { country: "Nigeria", state: "Oyo", city: "Ibadan" },
  };
  assert.deepEqual(
    buildLiveExecutionPlan([withCoordinates, withoutCoordinates], 20, {
      geoapify: true,
      tavily: false,
    }),
    {
      matrixQueryCount: 2,
      maximumGeoapifyCalls: 6,
      maximumTavilySearches: 0,
      maximumWebsites: 20,
      maximumHtmlPages: 100,
      conservativeMaximumProviderCreditsIncludingOneRetry: 6,
    },
  );
  assert.deepEqual(
    buildLiveExecutionPlan([withCoordinates, withoutCoordinates], 3, {
      geoapify: false,
      tavily: true,
    }),
    {
      matrixQueryCount: 2,
      maximumGeoapifyCalls: 0,
      maximumTavilySearches: 8,
      maximumWebsites: 3,
      maximumHtmlPages: 15,
      conservativeMaximumProviderCreditsIncludingOneRetry: 8,
    },
  );
  const both = buildLiveExecutionPlan(
    [withCoordinates, withoutCoordinates],
    4,
    { geoapify: true, tavily: true },
  );
  assert.equal(both.maximumGeoapifyCalls, 6);
  assert.equal(both.maximumTavilySearches, 8);
  assert.equal(both.conservativeMaximumProviderCreditsIncludingOneRetry, 14);
  assert.equal(both.maximumHtmlPages, 20);

  assert.equal(parseResearchArgs(["--max-websites", "50"]).maxWebsites, 50);
  assert.throws(
    () => parseResearchArgs(["--max-websites", "51"]),
    /RESEARCH_ARGUMENT_INVALID_MAX_WEBSITES/,
  );
});
test("live mode requires both explicit switches and a configured provider", () => {
  assert.throws(
    () => parseResearchArgs(["--live"]),
    /RESEARCH_LIVE_REQUIRES_EXPLICIT_CONFIRMATION/,
  );
  assert.throws(
    () => parseResearchArgs(["--confirm-live"]),
    /RESEARCH_LIVE_REQUIRES_EXPLICIT_CONFIRMATION/,
  );
});

test("provider keys never appear in safe errors", () => {
  const secret = "fixture-secret-key";
  process.env.GEOAPIFY_API_KEY = secret;
  try {
    assert.throws(
      () => parseResearchArgs([
        "--live", "--confirm-live", "--limit-per-query", "0",
      ]),
      (error) => error instanceof Error && !error.message.includes(secret),
    );
  } finally {
    delete process.env.GEOAPIFY_API_KEY;
  }
});
