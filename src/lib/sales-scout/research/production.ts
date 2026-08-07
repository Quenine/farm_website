import {
  canonicalizeWebsiteHostname,
  normalizeEmail,
  normalizeNigerianPhone,
  normalizeSocialIdentity,
  type SocialPlatform,
} from "../normalization.ts";
import { evaluateTerritoryMatch, type TerritoryMatchEvidence } from "../territory.ts";
import { deduplicateCandidates } from "./merge.ts";
import {
  hasAnyNormalizedPublicContact,
  hasAnyUsableContact,
  isDiscovered,
  isManualReviewReady,
  isOutreachReady,
} from "./quality.ts";
import { researchGeoapifyPlaceDetails, researchWithGeoapify } from "./geoapify.ts";
import { researchCandidateWithTavily } from "./tavily.ts";
import { researchWithSerpApi } from "./serpapi.ts";
import { MAX_PUBLIC_WEB_SEARCHES_PER_CANDIDATE, researchCandidateWithPublicWeb,
  type PublicWebSearchProvider } from "./public-web.ts";
import { assessNigeriaOpportunity, type OpportunityAssessment } from "./opportunity.ts";
import { ResearchProviderError } from "./types.ts";
import type {
  ProviderResult,
  ResearchCandidate,
  ResearchCategory,
  ResearchEvidence,
  ResearchTerritory,
} from "./types.ts";
import {
  buildWebsiteResearchPlan,
  mergeWebsiteFactsIntoCandidate,
  researchOfficialWebsite,
} from "./website.ts";

export const PRODUCTION_RESEARCH_LIMITS = {
  maximumCategories: 10,
  maximumResultsPerCategory: 100,
  maximumEnrichmentCandidates: 20,
  defaultEnrichmentCandidates: 6,
  tavilySearchesPerSeed: 2,
  maximumOfficialWebsites: 20,
  maximumPagesPerWebsite: 5,
  maximumGeoapifyPlaceDetailsPerCandidate: 1,
  maximumPublicWebSearchesPerCandidate: MAX_PUBLIC_WEB_SEARCHES_PER_CANDIDATE,
} as const;

export type ContactConfidence = "verified" | "plausible";
export type ContactRoute = "phone" | "whatsapp" | "email" | "website" | SocialPlatform;
export type PublicContact = {
  route: ContactRoute;
  displayValue: string;
  normalizedIdentity: string;
  profileUrl: string | null;
  sourceType: string;
  sourceUrl: string;
  observedAt: string;
  confidence: ContactConfidence;
};

export type ProductionResearchCandidate = {
  candidate: ResearchCandidate;
  territoryMatch: TerritoryMatchEvidence;
  contacts: PublicContact[];
  highestContactConfidence: ContactConfidence | "needs_research";
  discovered: boolean;
  manualReviewReady: boolean;
  outreachReady: boolean;
  enrichmentStatus: "not_selected" | "completed" | "partial" | "failed";
  opportunity: OpportunityAssessment;
};

export type ProductionResearchSummary = {
  candidates: ProductionResearchCandidate[];
  resolvedTerritory: ResearchTerritory;
  rawResultCount: number;
  structuredSeedCount: number;
  invalidSeedCount: number;
  discardedSourceDocumentCount: number;
  enrichmentAttemptedCount: number;
  enrichmentCompletedCount: number;
  officialWebsitesResearched: number;
  manualReviewReadyCount: number;
  outreachReadyCount: number;
  geoapifyPlaceDetailsCalls: number;
  publicWebSearchCalls: number;
  providerCredits: { geoapify: number; tavily: number; serpapi: number };
  warnings: string[];
};

type ResearchDeadline = { deadlineAtMs: number; now: () => number };

export type PipelineDependencies = {
  geoapify: (input: {
    territory: ResearchTerritory;
    category: ResearchCategory;
    limit: number;
    deadlineAtMs: number;
    now: () => number;
  }) => Promise<ProviderResult>;
  tavily: (candidate: ResearchCandidate, deadline: ResearchDeadline) => Promise<{
    candidate: ResearchCandidate;
    discardedSourceDocumentCount: number;
    estimatedCredits: number;
  }>;
  geoapifyDetails: (candidate: ResearchCandidate, deadline: ResearchDeadline) => Promise<ResearchCandidate>;
  publicWebSearch: PublicWebSearchProvider;
  website: (url: string, deadline: ResearchDeadline) => ReturnType<typeof researchOfficialWebsite>;
  now: () => number;
  minimumRequestBudgetMs: number;
};

const defaultDependencies: PipelineDependencies = {
  geoapify: researchWithGeoapify,
  tavily: researchCandidateWithTavily,
  geoapifyDetails: researchGeoapifyPlaceDetails,
  publicWebSearch: researchWithSerpApi,
  website: researchOfficialWebsite,
  now: Date.now,
  minimumRequestBudgetMs: 1_000,
};

function contactEvidence(candidate: ResearchCandidate, field: string, value: string) {
  const normalizers: Record<string, (input: string) => string | null> = {
    phone: normalizeNigerianPhone,
    whatsapp: normalizeNigerianPhone,
    email: normalizeEmail,
    website: canonicalizeWebsiteHostname,
    instagram: (input) => normalizeSocialIdentity(input, "instagram")?.identity ?? null,
    facebook: (input) => normalizeSocialIdentity(input, "facebook")?.identity ?? null,
    tiktok: (input) => normalizeSocialIdentity(input, "tiktok")?.identity ?? null,
    x: (input) => normalizeSocialIdentity(input, "x")?.identity ?? null,
    youtube: (input) => normalizeSocialIdentity(input, "youtube")?.identity ?? null,
  };
  const normalize = normalizers[field];
  const identity = normalize?.(value) ?? null;
  if (!identity) return null;
  const evidence = candidate.evidence.filter((item) =>
    item.field === field && normalize(item.value) === identity);
  if (!evidence.length) return null;
  const verified = evidence.find((item) => item.verificationStatus === "verified");
  const source = verified ?? evidence[0];
  return { identity, source, confidence: verified ? "verified" as const : "plausible" as const };
}

export function contactsForCandidate(candidate: ResearchCandidate): PublicContact[] {
  const values: ReadonlyArray<readonly [ContactRoute, string]> = [
    ...candidate.phoneNumbers.map((value) => ["phone", value] as const),
    ...candidate.whatsAppNumbers.map((value) => ["whatsapp", value] as const),
    ...candidate.emailAddresses.map((value) => ["email", value] as const),
    ...(candidate.website ? [["website", candidate.website] as const] : []),
    ...candidate.instagram.map((value) => ["instagram", value] as const),
    ...candidate.facebook.map((value) => ["facebook", value] as const),
    ...candidate.tiktok.map((value) => ["tiktok", value] as const),
    ...candidate.x.map((value) => ["x", value] as const),
    ...candidate.youtube.map((value) => ["youtube", value] as const),
  ];
  const contacts = new Map<string, PublicContact>();
  for (const [route, value] of values) {
    const found = contactEvidence(candidate, route, value);
    if (!found) continue;
    const key = `${route}:${found.identity}`;
    const next: PublicContact = {
      route,
      displayValue: value,
      normalizedIdentity: found.identity,
      profileUrl: ["website", "instagram", "facebook", "tiktok", "x", "youtube"].includes(route)
        ? value : null,
      sourceType: found.source.source,
      sourceUrl: found.source.sourceUrl,
      observedAt: found.source.observedAt,
      confidence: found.confidence,
    };
    const current = contacts.get(key);
    if (!current || current.confidence === "plausible" && next.confidence === "verified") {
      contacts.set(key, next);
    }
  }
  return [...contacts.values()];
}

function withTerritoryEvidence(candidate: ResearchCandidate, territory: ResearchTerritory) {
  const territoryMatch = evaluateTerritoryMatch({
    providerCountry: candidate.country,
    providerState: candidate.state,
    providerCity: candidate.city,
    latitude: candidate.latitude,
    longitude: candidate.longitude,
    campaign: { ...territory, radiusKm: territory.radiusKm ?? 20 },
  });
  const evidence: ResearchEvidence = {
    source: "geoapify_places",
    sourceUrl: candidate.evidence.find((item) => item.source === "geoapify_places")?.sourceUrl ?? "https://www.geoapify.com/",
    observedAt: candidate.lastObservedAt,
    field: "territoryMatch",
    value: String(territoryMatch.matched),
    confidence: "high",
    verificationStatus: territoryMatch.matched ? "verified" : "unavailable",
  };
  return { candidate: { ...candidate, evidence: [...candidate.evidence, evidence] }, territoryMatch };
}

function decorate(candidate: ResearchCandidate, territoryMatch: TerritoryMatchEvidence,
  enrichmentStatus: ProductionResearchCandidate["enrichmentStatus"]): ProductionResearchCandidate {
  const contacts = contactsForCandidate(candidate);
  const base:Omit<ProductionResearchCandidate,"opportunity"> = {
    candidate,
    territoryMatch,
    contacts,
    highestContactConfidence: contacts.some((contact) => contact.confidence === "verified")
      ? "verified" : contacts.length ? "plausible" : "needs_research",
    discovered: isDiscovered(candidate),
    manualReviewReady: isManualReviewReady(candidate) && hasAnyNormalizedPublicContact(candidate),
    outreachReady: isOutreachReady(candidate) && hasAnyUsableContact(candidate),
    enrichmentStatus,
  };
  return { ...base, opportunity: assessNigeriaOpportunity({ candidate, contacts, territoryMatch }) };
}

export function productionResearchCostCeiling(input: {
  categories: number;
  coordinatesConfigured: boolean;
  resultLimit: number;
  maxEnrichmentCandidates: number;
}) {
  const categories = Math.min(PRODUCTION_RESEARCH_LIMITS.maximumCategories, Math.max(1, input.categories));
  const enrichment = Math.min(PRODUCTION_RESEARCH_LIMITS.maximumEnrichmentCandidates,
    Math.max(1, input.maxEnrichmentCandidates));
  return {
    maximumGeoapifyCalls: categories * (
      Math.min(5, Math.ceil(input.resultLimit / 20)) +
      (input.coordinatesConfigured ? 0 : 1)
    ),
    maximumTavilySearches: enrichment * PRODUCTION_RESEARCH_LIMITS.tavilySearchesPerSeed,
    maximumGeoapifyPlaceDetailsCalls: enrichment,
    maximumPublicWebSearchCalls: enrichment * MAX_PUBLIC_WEB_SEARCHES_PER_CANDIDATE,
    maximumOfficialWebsites: enrichment,
    maximumOfficialWebsitePages: enrichment * PRODUCTION_RESEARCH_LIMITS.maximumPagesPerWebsite,
    maximumStagedCandidates: Math.min(input.resultLimit * categories,
      input.resultLimit * PRODUCTION_RESEARCH_LIMITS.maximumCategories),
  };
}

function structuredSeedIdentity(candidate: ResearchCandidate) {
  return candidate.sourceIdentities.geoapify_places?.trim() || null;
}

export async function runSeedFirstProductionResearch(input: {
  territory: ResearchTerritory;
  categories: ResearchCategory[];
  resultLimit: number;
  maxEnrichmentCandidates: number;
  tavilyConfigured: boolean;
  publicWebConfigured?: boolean;
  geoapifyPlaceDetailsConfigured?: boolean;
  timeBudgetMs?: number;
  deadlineAtMs?: number;
}, dependencyOverrides: Partial<PipelineDependencies> = {}): Promise<ProductionResearchSummary> {
  if (input.resultLimit < 1 || input.resultLimit > PRODUCTION_RESEARCH_LIMITS.maximumResultsPerCategory ||
      input.maxEnrichmentCandidates < 1 ||
      input.maxEnrichmentCandidates > PRODUCTION_RESEARCH_LIMITS.maximumEnrichmentCandidates) {
    throw new Error("PRODUCTION_RESEARCH_BOUNDS_INVALID");
  }

  const dependencies = { ...defaultDependencies, ...dependencyOverrides };
  const timeBudgetMs = Math.min(50_000, Math.max(1, input.timeBudgetMs ?? 45_000));
  const deadlineAtMs = Math.min(input.deadlineAtMs ?? Number.POSITIVE_INFINITY,
    dependencies.now() + timeBudgetMs);
  const deadline = { deadlineAtMs, now: dependencies.now };
  const hasRequestBudget = () =>
    deadlineAtMs - dependencies.now() >= dependencies.minimumRequestBudgetMs;
  const warnings: string[] = [];
  const markBudgetReached = () => {
    if (!warnings.includes("RESEARCH_TIME_BUDGET_REACHED")) {
      warnings.push("RESEARCH_TIME_BUDGET_REACHED");
    }
  };

  const rawSeeds: ResearchCandidate[] = [];
  let rawFeatureCount = 0;
  let invalidSeedCount = 0;
  let geoapifyCredits = 0;
  let resolvedTerritory = { ...input.territory };
  for (const category of input.categories) {
    if (!hasRequestBudget()) {
      markBudgetReached();
      break;
    }
    let result: ProviderResult;
    try {
      result = await dependencies.geoapify({
        territory: resolvedTerritory,
        category,
        limit: input.resultLimit,
        ...deadline,
      });
    } catch (error) {
      if (!(error instanceof ResearchProviderError)) throw error;
      if (error.reference === "GEOAPIFY_TERRITORY_NOT_RESOLVED") throw error;
      warnings.push(error.reference);
      continue;
    }
    if (result.failureReference) {
      warnings.push(result.failureReference);
      continue;
    }
    geoapifyCredits += result.estimatedCredits;
    rawFeatureCount += result.rawResultCount;
    if (result.resolvedTerritory) {
      resolvedTerritory = { ...resolvedTerritory, ...result.resolvedTerritory };
    }
    const validSeeds = result.candidates.filter((candidate) => {
      const valid = structuredSeedIdentity(candidate) !== null;
      if (!valid) invalidSeedCount += 1;
      return valid;
    });
    rawSeeds.push(...validSeeds);
  }
  if (invalidSeedCount > 0) warnings.push("GEOAPIFY_INVALID_SEED_IDENTITY");
  if (!rawSeeds.length) {
    if (rawFeatureCount === 0) throw new ResearchProviderError("GEOAPIFY_ZERO_FEATURES");
    if (invalidSeedCount > 0) throw new ResearchProviderError("GEOAPIFY_CANDIDATES_MISSING_STABLE_IDENTITIES");
    throw new ResearchProviderError("GEOAPIFY_FEATURES_MAPPED_ZERO_NAMED_CANDIDATES");
  }

  const matched = rawSeeds.map((candidate) => withTerritoryEvidence(candidate, resolvedTerritory))
    .filter((item) => item.territoryMatch.matched);
  if (!matched.length) throw new ResearchProviderError("GEOAPIFY_CANDIDATES_REJECTED_TERRITORY");
  const preliminary = deduplicateCandidates(matched.map((item) => item.candidate)).candidates;
  if (!preliminary.length) {
    throw new ResearchProviderError("GEOAPIFY_CANDIDATES_EMPTY_AFTER_DEDUP_FILTER");
  }
  const territoryByIdentity = new Map(matched.flatMap((item) => {
    const identity = structuredSeedIdentity(item.candidate);
    return identity ? [[identity, item.territoryMatch] as const] : [];
  }));
  const selected = new Set(preliminary.slice(0, input.maxEnrichmentCandidates)
    .flatMap((candidate) => {
      const identity = structuredSeedIdentity(candidate);
      return identity ? [identity] : [];
    }));

  let discardedSourceDocumentCount = 0;
  let enrichmentAttemptedCount = 0;
  let enrichmentCompletedCount = 0;
  let tavilyCredits = 0;
  let geoapifyPlaceDetailsCalls = 0;
  let publicWebSearchCalls = 0;
  const enrichmentState = new Map<string, ProductionResearchCandidate["enrichmentStatus"]>();
  const enriched: ResearchCandidate[] = [];
  for (const seed of preliminary) {
    const identity = structuredSeedIdentity(seed);
    if (!identity) continue;
    if (!selected.has(identity)) {
      enrichmentState.set(identity, "not_selected");
      enriched.push(seed);
      continue;
    }
    if (!hasRequestBudget()) {
      markBudgetReached();
      enrichmentState.set(identity, "not_selected");
      enriched.push(seed);
      continue;
    }
    enrichmentAttemptedCount += 1;
    let current = seed;
    let completedAny = false;
    if (input.geoapifyPlaceDetailsConfigured) {
      try {
        geoapifyPlaceDetailsCalls += 1;
        geoapifyCredits += 1;
        current = await dependencies.geoapifyDetails(current, deadline);
        completedAny = true;
      } catch (error) {
        const reference = error instanceof ResearchProviderError
          ? error.reference : "GEOAPIFY_PLACE_DETAILS_FAILED";
        warnings.push(reference);
        current = { ...current, researchIssues: [...current.researchIssues, reference] };
      }
    }
    try {
      if (input.publicWebConfigured && hasRequestBudget()) {
        const result = await researchCandidateWithPublicWeb(current, dependencies.publicWebSearch, deadline);
        current = result.candidate;
        publicWebSearchCalls += result.actualCalls;
        warnings.push(...result.failureReferences);
        completedAny = completedAny || result.actualCalls > 0;
      } else if (input.tavilyConfigured && hasRequestBudget()) {
        const result = await dependencies.tavily(current, deadline);
        current = result.candidate;
        discardedSourceDocumentCount += result.discardedSourceDocumentCount;
        tavilyCredits += result.estimatedCredits;
        completedAny = true;
      }
      if (completedAny) enrichmentCompletedCount += 1;
      enrichmentState.set(identity, completedAny ? "completed" : "not_selected");
      enriched.push(current);
    } catch (error) {
      const reference = error instanceof ResearchProviderError
        ? error.reference
        : error instanceof Error ? error.message : "PUBLIC_RESEARCH_FAILED";
      warnings.push(reference);
      enrichmentState.set(identity, completedAny ? "partial" : "failed");
      enriched.push({ ...current, researchIssues: [...current.researchIssues, reference] });
    }
  }

  const websitePlan = buildWebsiteResearchPlan(enriched, input.maxEnrichmentCandidates);
  let websitesResearched = 0;
  for (const item of websitePlan) {
    if (!hasRequestBudget()) {
      markBudgetReached();
      break;
    }
    try {
      const pages = await dependencies.website(item.url, deadline);
      websitesResearched += 1;
      for (const index of item.candidateIndexes) {
        for (const page of pages) {
          enriched[index] = mergeWebsiteFactsIntoCandidate(enriched[index], page.facts, page.url);
        }
      }
      if (!hasRequestBudget()) markBudgetReached();
    } catch (error) {
      const reference = error instanceof ResearchProviderError
        ? error.reference
        : error instanceof Error ? error.message : "WEBSITE_RESEARCH_FAILED";
      warnings.push(reference);
      for (const index of item.candidateIndexes) {
        enriched[index] = {
          ...enriched[index],
          researchIssues: [...enriched[index].researchIssues, reference],
        };
        const identity = structuredSeedIdentity(enriched[index]);
        if (identity && enrichmentState.get(identity) === "completed") {
          enrichmentState.set(identity, "partial");
        }
      }
    }
  }

  if (discardedSourceDocumentCount > 0) warnings.push("TAVILY_SOURCE_DOCUMENTS_REJECTED");
  const finalCandidates = deduplicateCandidates(enriched).candidates.flatMap((candidate) => {
    const identity = structuredSeedIdentity(candidate);
    if (!identity) return [];
    const territoryMatch = territoryByIdentity.get(identity) ??
      withTerritoryEvidence(candidate, resolvedTerritory).territoryMatch;
    return [decorate(candidate, territoryMatch,
      enrichmentState.get(identity) ?? "not_selected")];
  });
  return {
    candidates: finalCandidates,
    resolvedTerritory,
    rawResultCount: rawFeatureCount,
    structuredSeedCount: preliminary.length,
    invalidSeedCount,
    discardedSourceDocumentCount,
    enrichmentAttemptedCount,
    enrichmentCompletedCount,
    officialWebsitesResearched: websitesResearched,
    manualReviewReadyCount: finalCandidates.filter((candidate) => candidate.manualReviewReady).length,
    outreachReadyCount: finalCandidates.filter((candidate) => candidate.outreachReady).length,
    providerCredits: { geoapify: geoapifyCredits, tavily: tavilyCredits, serpapi: publicWebSearchCalls },
    geoapifyPlaceDetailsCalls,
    publicWebSearchCalls,
    warnings: [...new Set(warnings)],
  };
}
