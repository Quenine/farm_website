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
import { researchWithGeoapify } from "./geoapify.ts";
import { researchCandidateWithTavily } from "./tavily.ts";
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
};

export type ProductionResearchSummary = {
  candidates: ProductionResearchCandidate[];
  resolvedTerritory: ResearchTerritory;
  structuredSeedCount: number;
  discardedSourceDocumentCount: number;
  enrichmentAttemptedCount: number;
  enrichmentCompletedCount: number;
  officialWebsitesResearched: number;
  manualReviewReadyCount: number;
  outreachReadyCount: number;
  providerCredits: { geoapify: number; tavily: number };
  warnings: string[];
};

type PipelineDependencies = {
  geoapify: (input: { territory: ResearchTerritory; category: ResearchCategory; limit: number }) => Promise<ProviderResult>;
  tavily: (candidate: ResearchCandidate) => Promise<{
    candidate: ResearchCandidate;
    discardedSourceDocumentCount: number;
    estimatedCredits: number;
  }>;
  website: typeof researchOfficialWebsite;
};

const defaultDependencies: PipelineDependencies = {
  geoapify: researchWithGeoapify,
  tavily: researchCandidateWithTavily,
  website: researchOfficialWebsite,
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
  return {
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
    maximumGeoapifyCalls: categories * Math.min(4, Math.ceil(input.resultLimit / 20)) +
      (input.coordinatesConfigured ? 0 : 1),
    maximumTavilySearches: enrichment * PRODUCTION_RESEARCH_LIMITS.tavilySearchesPerSeed,
    maximumOfficialWebsites: enrichment,
    maximumOfficialWebsitePages: enrichment * PRODUCTION_RESEARCH_LIMITS.maximumPagesPerWebsite,
    maximumStagedCandidates: Math.min(input.resultLimit * categories,
      input.resultLimit * PRODUCTION_RESEARCH_LIMITS.maximumCategories),
  };
}

export async function runSeedFirstProductionResearch(input: {
  territory: ResearchTerritory;
  categories: ResearchCategory[];
  resultLimit: number;
  maxEnrichmentCandidates: number;
  tavilyConfigured: boolean;
}, dependencies: PipelineDependencies = defaultDependencies): Promise<ProductionResearchSummary> {
  if (input.resultLimit < 1 || input.resultLimit > PRODUCTION_RESEARCH_LIMITS.maximumResultsPerCategory ||
      input.maxEnrichmentCandidates < 1 ||
      input.maxEnrichmentCandidates > PRODUCTION_RESEARCH_LIMITS.maximumEnrichmentCandidates) {
    throw new Error("PRODUCTION_RESEARCH_BOUNDS_INVALID");
  }
  const warnings: string[] = [];
  const rawSeeds: ResearchCandidate[] = [];
  let geoapifyCredits = 0;
  let resolvedTerritory = { ...input.territory };
  for (const category of input.categories) {
    const result = await dependencies.geoapify({ territory: resolvedTerritory, category, limit: input.resultLimit });
    if (result.failureReference) {
      warnings.push(result.failureReference);
      continue;
    }
    geoapifyCredits += result.estimatedCredits;
    if (result.resolvedTerritory) resolvedTerritory = { ...resolvedTerritory, ...result.resolvedTerritory };
    rawSeeds.push(...result.candidates);
  }
  const matched = rawSeeds.map((candidate) => withTerritoryEvidence(candidate, resolvedTerritory))
    .filter((item) => item.territoryMatch.matched);
  const preliminary = deduplicateCandidates(matched.map((item) => item.candidate)).candidates;
  const territoryByIdentity = new Map(matched.map((item) => [
    item.candidate.sourceIdentities.geoapify_places ?? item.candidate.normalizedBusinessName,
    item.territoryMatch,
  ]));
  const selected = new Set(preliminary.slice(0, input.maxEnrichmentCandidates)
    .map((candidate) => candidate.sourceIdentities.geoapify_places));
  let discardedSourceDocumentCount = 0;
  let enrichmentCompletedCount = 0;
  let tavilyCredits = 0;
  const enrichmentState = new Map<string | undefined, ProductionResearchCandidate["enrichmentStatus"]>();
  const enriched: ResearchCandidate[] = [];
  for (const seed of preliminary) {
    const identity = seed.sourceIdentities.geoapify_places;
    if (!selected.has(identity) || !input.tavilyConfigured) {
      enrichmentState.set(identity, "not_selected");
      enriched.push(seed);
      continue;
    }
    try {
      const result = await dependencies.tavily(seed);
      discardedSourceDocumentCount += result.discardedSourceDocumentCount;
      tavilyCredits += result.estimatedCredits;
      enrichmentCompletedCount += 1;
      enrichmentState.set(identity, "completed");
      enriched.push(result.candidate);
    } catch (error) {
      const reference = error instanceof Error ? error.message : "TAVILY_ENRICHMENT_FAILED";
      warnings.push(reference);
      enrichmentState.set(identity, "failed");
      enriched.push({ ...seed, researchIssues: [...seed.researchIssues, reference] });
    }
  }
  const websitePlan = buildWebsiteResearchPlan(enriched, input.maxEnrichmentCandidates);
  let websitesResearched = 0;
  for (const item of websitePlan) {
    try {
      const pages = await dependencies.website(item.url);
      websitesResearched += 1;
      for (const index of item.candidateIndexes) {
        for (const page of pages) {
          enriched[index] = mergeWebsiteFactsIntoCandidate(enriched[index], page.facts, page.url);
        }
      }
    } catch (error) {
      const reference = error instanceof Error ? error.message : "WEBSITE_RESEARCH_FAILED";
      warnings.push(reference);
      for (const index of item.candidateIndexes) {
        enriched[index] = { ...enriched[index], researchIssues: [...enriched[index].researchIssues, reference] };
        const identity = enriched[index].sourceIdentities.geoapify_places;
        if (enrichmentState.get(identity) === "completed") enrichmentState.set(identity, "partial");
      }
    }
  }
  if (discardedSourceDocumentCount > 0) warnings.push("TAVILY_SOURCE_DOCUMENTS_REJECTED");
  const finalCandidates = deduplicateCandidates(enriched).candidates.map((candidate) => {
    const identity = candidate.sourceIdentities.geoapify_places ?? candidate.normalizedBusinessName;
    const territoryMatch = territoryByIdentity.get(identity) ??
      withTerritoryEvidence(candidate, resolvedTerritory).territoryMatch;
    return decorate(candidate, territoryMatch,
      enrichmentState.get(candidate.sourceIdentities.geoapify_places) ?? "not_selected");
  });
  return {
    candidates: finalCandidates,
    resolvedTerritory,
    structuredSeedCount: preliminary.length,
    discardedSourceDocumentCount,
    enrichmentAttemptedCount: input.tavilyConfigured ? selected.size : 0,
    enrichmentCompletedCount,
    officialWebsitesResearched: websitesResearched,
    manualReviewReadyCount: finalCandidates.filter((candidate) => candidate.manualReviewReady).length,
    outreachReadyCount: finalCandidates.filter((candidate) => candidate.outreachReady).length,
    providerCredits: { geoapify: geoapifyCredits, tavily: tavilyCredits },
    warnings: [...new Set(warnings)],
  };
}
