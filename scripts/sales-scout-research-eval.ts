import { readFile } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";
import {
  buildWebsiteResearchPlan,
  computeEvaluationMetrics,
  deduplicateCandidates,
  extractWebsiteFacts,
  geoapifyCategory,
  isRetryableProviderReference,
  mapGeoapifyPlacesResponse,
  mapTavilySearchResponse,
  mergeWebsiteFactsIntoCandidate,
  researchOfficialWebsite,
  researchWithGeoapify,
  researchWithTavily,
  writeEvaluationOutputs,
  type ResearchCandidate,
  type ResearchCategory,
  type ResearchQuery,
  type ResearchTerritory,
  RESEARCH_CATEGORIES,
  ResearchProviderError,
} from "../src/lib/sales-scout/research/index.ts";

type Matrix = { territories: ResearchTerritory[]; categories: ResearchCategory[] };
type Options = {
  matrix: string;
  city?: string;
  state?: string;
  category?: ResearchCategory;
  limitPerQuery: number;
  maxQueries: number;
  maxWebsites: number;
  outputDir?: string;
  live: boolean;
  confirmLive: boolean;
};
type DiscoveryTotals = {
  candidates: ResearchCandidate[];
  failures: string[];
  credits: number;
  raw: number;
  successes: number;
};
export type LiveExecutionPlan = {
  matrixQueryCount: number;
  maximumGeoapifyCalls: number;
  maximumTavilySearches: number;
  maximumWebsites: number;
  conservativeMaximumEstimatedProviderCredits: number;
};

const DEFAULT_MATRIX = "scripts/fixtures/sales-scout-research/nationwide-matrix.json";
const FIXTURE_DIR = "scripts/fixtures/sales-scout-research";
const FIXTURE_OBSERVED_AT = "2026-08-02T09:00:00.000Z";

function argumentToken(name: string) {
  return name.replace(/^--/, "").toUpperCase().replaceAll("-", "_");
}

function valueAfter(args: string[], index: number, name: string) {
  const value = args[index + 1];
  if (!value || value.startsWith("--")) {
    throw new Error(`RESEARCH_ARGUMENT_MISSING_${argumentToken(name)}`);
  }
  return value;
}

function boundedInteger(
  value: string,
  name: string,
  minimum: number,
  maximum: number,
) {
  const number = Number(value);
  if (!Number.isInteger(number) || number < minimum || number > maximum) {
    throw new Error(`RESEARCH_ARGUMENT_INVALID_${argumentToken(name)}`);
  }
  return number;
}

export function parseResearchArgs(args: string[]): Options {
  const live = args.includes("--live");
  const confirmLive = args.includes("--confirm-live");
  const options: Options = {
    matrix: DEFAULT_MATRIX,
    limitPerQuery: 5,
    maxQueries: live ? 12 : 50,
    maxWebsites: 20,
    live,
    confirmLive,
  };
  for (let index = 0; index < args.length; index += 1) {
    const name = args[index];
    if (name === "--live" || name === "--confirm-live") continue;
    if (name === "--matrix") {
      options.matrix = valueAfter(args, index, name);
    } else if (name === "--city") {
      options.city = valueAfter(args, index, name);
    } else if (name === "--state") {
      options.state = valueAfter(args, index, name);
    } else if (name === "--category") {
      const value = valueAfter(args, index, name) as ResearchCategory;
      if (!RESEARCH_CATEGORIES.includes(value)) {
        throw new Error("RESEARCH_ARGUMENT_INVALID_CATEGORY");
      }
      options.category = value;
    } else if (name === "--limit-per-query") {
      options.limitPerQuery = boundedInteger(valueAfter(args, index, name), name, 1, 20);
    } else if (name === "--max-queries") {
      options.maxQueries = boundedInteger(valueAfter(args, index, name), name, 1, 50);
    } else if (name === "--max-websites") {
      options.maxWebsites = boundedInteger(valueAfter(args, index, name), name, 1, 50);
    } else if (name === "--output-dir") {
      options.outputDir = valueAfter(args, index, name);
    } else {
      throw new Error("RESEARCH_ARGUMENT_UNKNOWN");
    }
    index += 1;
  }
  if (live !== confirmLive) {
    throw new Error("RESEARCH_LIVE_REQUIRES_EXPLICIT_CONFIRMATION");
  }
  if (
    live &&
    !process.env.GEOAPIFY_API_KEY?.trim() &&
    !process.env.TAVILY_API_KEY?.trim()
  ) {
    throw new Error("RESEARCH_LIVE_PROVIDER_NOT_CONFIGURED");
  }
  return options;
}

function slug(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

async function loadMatrix(file: string): Promise<Matrix> {
  const parsed = JSON.parse(await readFile(file, "utf8")) as Matrix;
  if (!Array.isArray(parsed.territories) || !Array.isArray(parsed.categories)) {
    throw new Error("RESEARCH_MATRIX_INVALID");
  }
  return parsed;
}

function buildQueries(matrix: Matrix, options: Options) {
  const territories = matrix.territories.filter((item) =>
    (!options.city || item.city === options.city) &&
    (!options.state || item.state === options.state)
  );
  const categories = matrix.categories.filter((item) =>
    !options.category || item === options.category
  );
  return territories
    .flatMap((territory) => categories.map((category) => ({
      territory,
      category,
      limit: options.limitPerQuery,
    })))
    .slice(0, options.maxQueries);
}

export function buildLiveExecutionPlan(
  queries: ResearchQuery[],
  maxWebsites: number,
  providers: { geoapify: boolean; tavily: boolean },
): LiveExecutionPlan {
  const geoapifyQueries = providers.geoapify
    ? queries.filter((query) => Boolean(geoapifyCategory(query.category))).length
    : 0;
  const maximumGeoapifyCalls = geoapifyQueries * 2;
  const maximumTavilySearches = providers.tavily ? queries.length * 2 : 0;
  return {
    matrixQueryCount: queries.length,
    maximumGeoapifyCalls,
    maximumTavilySearches,
    maximumWebsites: maxWebsites,
    conservativeMaximumEstimatedProviderCredits:
      maximumGeoapifyCalls + maximumTavilySearches,
  };
}

function printLiveExecutionPlan(plan: LiveExecutionPlan) {
  console.log(`Matrix query count: ${plan.matrixQueryCount}`);
  console.log(`Maximum Geoapify calls: ${plan.maximumGeoapifyCalls}`);
  console.log(`Maximum Tavily searches: ${plan.maximumTavilySearches}`);
  console.log(`Maximum websites to research: ${plan.maximumWebsites}`);
  console.log(
    "Conservative maximum estimated provider credits: " +
      plan.conservativeMaximumEstimatedProviderCredits,
  );
}

export async function withOneRetry<T>(operation: () => Promise<T>) {
  try {
    return await operation();
  } catch (error) {
    if (
      error instanceof ResearchProviderError &&
      isRetryableProviderReference(error.reference)
    ) {
      return operation();
    }
    throw error;
  }
}

async function discoverLiveCandidateBatch(query: ResearchQuery): Promise<DiscoveryTotals> {
  const candidates: ResearchCandidate[] = [];
  const failures: string[] = [];
  let credits = 0;
  let raw = 0;
  let successes = 0;
  if (process.env.GEOAPIFY_API_KEY?.trim() && geoapifyCategory(query.category)) {
    try {
      const result = await withOneRetry(() => researchWithGeoapify(query));
      candidates.push(...result.candidates);
      credits += result.estimatedCredits;
      raw += result.rawResultCount;
      successes += 1;
    } catch (error) {
      failures.push(
        error instanceof ResearchProviderError ? error.reference : "GEOAPIFY_FAILED",
      );
    }
  }
  if (process.env.TAVILY_API_KEY?.trim()) {
    try {
      const result = await withOneRetry(() => researchWithTavily(query));
      candidates.push(...result.candidates);
      credits += result.estimatedCredits;
      raw += result.rawResultCount;
      successes += 1;
    } catch (error) {
      failures.push(
        error instanceof ResearchProviderError ? error.reference : "TAVILY_FAILED",
      );
    }
  }
  return { candidates, failures, credits, raw, successes };
}

async function discoverLiveCandidates(queries: ResearchQuery[]) {
  const total: DiscoveryTotals = {
    candidates: [],
    failures: [],
    credits: 0,
    raw: 0,
    successes: 0,
  };
  for (const query of queries) {
    const result = await discoverLiveCandidateBatch(query);
    total.candidates.push(...result.candidates);
    total.failures.push(...result.failures);
    total.credits += result.credits;
    total.raw += result.raw;
    total.successes += result.successes;
  }
  return total;
}

async function enrichLiveCandidates(
  candidates: ResearchCandidate[],
  maxWebsites: number,
) {
  const enriched = [...candidates];
  const plan = buildWebsiteResearchPlan(enriched, maxWebsites);
  for (const item of plan) {
    try {
      const pages = await researchOfficialWebsite(item.url);
      for (const candidateIndex of item.candidateIndexes) {
        let candidate = enriched[candidateIndex];
        for (const page of pages) {
          candidate = mergeWebsiteFactsIntoCandidate(candidate, page.facts, page.url);
        }
        enriched[candidateIndex] = candidate;
      }
    } catch (error) {
      const reference = error instanceof ResearchProviderError
        ? error.reference
        : "WEBSITE_RESEARCH_FAILED";
      for (const candidateIndex of item.candidateIndexes) {
        enriched[candidateIndex] = {
          ...enriched[candidateIndex],
          researchIssues: [
            ...new Set([...enriched[candidateIndex].researchIssues, reference]),
          ],
        };
      }
    }
  }
  return enriched;
}

type FixtureTemplates = {
  geoapifyPlaces: { features: Array<{ properties: Record<string, unknown> }> };
  tavilySearch: { results: Array<Record<string, unknown>> };
  websiteHtml: string;
};

async function loadFixtureTemplates(): Promise<FixtureTemplates> {
  const [geoapifyText, tavilyText, websiteHtml] = await Promise.all([
    readFile(path.join(FIXTURE_DIR, "geoapify-places.json"), "utf8"),
    readFile(path.join(FIXTURE_DIR, "tavily-search.json"), "utf8"),
    readFile(path.join(FIXTURE_DIR, "official-homepage.html"), "utf8"),
  ]);
  return {
    geoapifyPlaces: JSON.parse(geoapifyText) as FixtureTemplates["geoapifyPlaces"],
    tavilySearch: JSON.parse(tavilyText) as FixtureTemplates["tavilySearch"],
    websiteHtml,
  };
}

function fixtureIdentity(query: ResearchQuery, index: number) {
  const name = `${query.territory.city} ${query.category} Scout ${index + 1}`;
  const host = `${slug(name)}.example`;
  return { name, host, website: `https://${host}/` };
}

function buildGeoapifyFixturePayload(
  template: FixtureTemplates["geoapifyPlaces"],
  query: ResearchQuery,
  index: number,
) {
  const identity = fixtureIdentity(query, index);
  const category = geoapifyCategory(query.category);
  if (!category) return null;
  const original = template.features[0]?.properties ?? {};
  const suffix = String(1_000 + index).slice(-4);
  return {
    features: [{
      properties: {
        ...original,
        place_id: `geo-fixture-${slug(identity.name)}`,
        name: identity.name,
        categories: [category],
        formatted: `1 Research Road, ${query.territory.city}, ${query.territory.state}, Nigeria`,
        city: query.territory.city,
        state: query.territory.state,
        country: "Nigeria",
        country_code: "ng",
        lon: query.territory.longitude ?? 3.4,
        lat: query.territory.latitude ?? 6.5,
        website: identity.website,
        contact: { phone: `0803000${suffix}` },
      },
    }],
  };
}

function buildTavilyFixturePayload(
  template: FixtureTemplates["tavilySearch"],
  query: ResearchQuery,
  index: number,
) {
  const identity = fixtureIdentity(query, index);
  const directory = template.results[1] ?? {};
  return {
    results: [
      {
        ...(template.results[0] ?? {}),
        title: `${identity.name} | Official Website`,
        url: identity.website,
        content: `Synthetic discovery snippet for ${query.category}.`,
      },
      {
        ...directory,
        title: `${identity.name} directory listing`,
        url: `https://directory.example/listing/${slug(identity.name)}`,
      },
    ],
  };
}

function adaptWebsiteFixture(
  template: string,
  query: ResearchQuery,
  index: number,
) {
  const identity = fixtureIdentity(query, index);
  return template
    .replaceAll("sunrisefoods.example", identity.host)
    .replaceAll("Sunrise Foods", identity.name)
    .replaceAll("sunrisefoodsng", slug(identity.name))
    .replaceAll('"addressLocality":"Lagos"', `"addressLocality":"${query.territory.city}"`)
    .replaceAll('"addressRegion":"Lagos"', `"addressRegion":"${query.territory.state}"`);
}

async function fixtureDiscovery(queries: ResearchQuery[]) {
  const templates = await loadFixtureTemplates();
  const candidates: ResearchCandidate[] = [];
  let successes = 0;
  for (const [index, query] of queries.entries()) {
    const geoapifyPayload = buildGeoapifyFixturePayload(templates.geoapifyPlaces, query, index);
    if (geoapifyPayload) {
      candidates.push(...mapGeoapifyPlacesResponse(
        geoapifyPayload,
        query,
        FIXTURE_OBSERVED_AT,
      ));
      successes += 1;
    }
    candidates.push(...mapTavilySearchResponse(
      buildTavilyFixturePayload(templates.tavilySearch, query, index),
      query,
      FIXTURE_OBSERVED_AT,
    ));
    successes += 1;
  }
  return { candidates, successes, templates };
}

function enrichFixtureCandidates(
  candidates: ResearchCandidate[],
  queries: ResearchQuery[],
  templates: FixtureTemplates,
  maxWebsites: number,
) {
  const enriched = [...candidates];
  const plan = buildWebsiteResearchPlan(enriched, maxWebsites);
  for (const item of plan) {
    const index = queries.findIndex((query, queryIndex) =>
      fixtureIdentity(query, queryIndex).host === item.hostname
    );
    if (index < 0) continue;
    const facts = extractWebsiteFacts(
      adaptWebsiteFixture(templates.websiteHtml, queries[index], index),
      item.url,
      FIXTURE_OBSERVED_AT,
    );
    for (const candidateIndex of item.candidateIndexes) {
      enriched[candidateIndex] = mergeWebsiteFactsIntoCandidate(
        enriched[candidateIndex],
        facts,
        item.url,
      );
    }
  }
  return enriched;
}

export async function runResearchEvaluation(args: string[]) {
  const options = parseResearchArgs(args);
  const matrix = await loadMatrix(options.matrix);
  const queries = buildQueries(matrix, options);
  if (!queries.length) throw new Error("RESEARCH_QUERY_MATRIX_EMPTY");

  let rawCandidates: ResearchCandidate[];
  let failures: string[] = [];
  let credits = 0;
  let rawResults = 0;
  let providerSuccesses = 0;
  let fixtureTemplates: FixtureTemplates | null = null;

  if (options.live) {
    const plan = buildLiveExecutionPlan(queries, options.maxWebsites, {
      geoapify: Boolean(process.env.GEOAPIFY_API_KEY?.trim()),
      tavily: Boolean(process.env.TAVILY_API_KEY?.trim()),
    });
    printLiveExecutionPlan(plan);
    const discovery = await discoverLiveCandidates(queries);
    rawCandidates = discovery.candidates;
    failures = discovery.failures;
    credits = discovery.credits;
    rawResults = discovery.raw;
    providerSuccesses = discovery.successes;
  } else {
    console.log(`Mode: synthetic fixture; matrix query count: ${queries.length}`);
    const fixture = await fixtureDiscovery(queries);
    rawCandidates = fixture.candidates;
    rawResults = rawCandidates.length;
    providerSuccesses = fixture.successes;
    fixtureTemplates = fixture.templates;
  }

  const preliminary = deduplicateCandidates(rawCandidates);
  const enriched = options.live
    ? await enrichLiveCandidates(preliminary.candidates, options.maxWebsites)
    : enrichFixtureCandidates(
        preliminary.candidates,
        queries,
        fixtureTemplates!,
        options.maxWebsites,
      );
  const final = deduplicateCandidates(enriched);
  const duplicatesMerged =
    preliminary.duplicatesMerged + final.duplicatesMerged;
  const metrics = computeEvaluationMetrics(final.candidates, {
    mode: options.live ? "live" : "synthetic_fixture",
    queriesAttempted: queries.length,
    providerSuccesses,
    providerFailures: failures.length,
    totalRawResults: rawResults,
    duplicatesMerged,
    estimatedProviderCredits: credits,
    failureReferences: failures,
  });
  const runId = `run-${new Date().toISOString().replace(/[:.]/g, "-")}`;
  const outputDir = options.outputDir ??
    path.join("tmp", "sales-scout-research", runId);
  await writeEvaluationOutputs(outputDir, final.candidates, metrics);
  console.log(`Evaluation output: ${outputDir}`);
  return { outputDir, candidates: final.candidates, metrics };
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href
) {
  runResearchEvaluation(process.argv.slice(2)).catch((error) => {
    console.error(error instanceof Error ? error.message : "RESEARCH_EVALUATION_FAILED");
    process.exitCode = 1;
  });
}
