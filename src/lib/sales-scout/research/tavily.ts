import {
  normalizeBusinessName,
  normalizeSocialIdentity,
  type SocialPlatform,
} from "../normalization.ts";
import type {
  ProviderResult,
  ResearchCandidate,
  ResearchEvidence,
  ResearchQuery,
} from "./types.ts";
import { providerStatusReference, ResearchProviderError } from "./types.ts";

const MAX_SEARCH_RESULTS = 20;
const MAX_EXTRACT_URLS = 5;
const DISCOVERY_HOST_MARKERS = [
  "google.", "bing.", "yahoo.", "duckduckgo.", "tripadvisor.", "yelp.",
  "foursquare.", "mapquest.", "openstreetmap.", "wikipedia.", "facebook.",
  "instagram.", "tiktok.", "x.com", "twitter.", "youtube.", "linkedin.",
  "medium.", "substack.", "nairaland.", "pinterest.", "reddit.", "quora.",
  "amazon.", "jumia.", "jiji.", "ubereats.", "glovo.", "doordash.",
  "businesslist.", "finelib.", "directory.", "yellowpages.", "zoominfo.",
  "bloomberg.", "reuters.", "guardian.", "punchng.", "vanguardngr.",
];
const DISCOVERY_PATH_MARKERS = [
  "/search", "/maps", "/place/", "/listing/", "/directory/", "/reviews/",
  "/article/", "/articles/", "/news/", "/blog/", "/profile/", "/company/",
];
const NAME_STOP_WORDS = new Set([
  "and", "the", "of", "nigeria", "ng", "limited", "ltd", "plc", "restaurant",
  "hotel", "supermarket", "caterer", "catering", "vendor", "food", "foods",
]);

export type TavilyUrlClassification =
  | { kind: "social_profile"; platform: SocialPlatform; normalizedIdentity: string }
  | { kind: "likely_official" }
  | { kind: "discovery_only" };

function hostnameLabel(url: URL) {
  const labels = url.hostname.toLowerCase().replace(/^www\./, "").split(".");
  return labels.length > 1 ? labels[labels.length - 2] : labels[0];
}

export function classifyTavilyResultUrl(
  businessName: string,
  input: string,
): TavilyUrlClassification {
  let url: URL;
  try {
    url = new URL(input);
  } catch {
    return { kind: "discovery_only" };
  }
  if (!["http:", "https:"].includes(url.protocol) || url.username || url.password) {
    return { kind: "discovery_only" };
  }
  const social = normalizeSocialIdentity(url.href);
  if (social) {
    return {
      kind: "social_profile",
      platform: social.platform,
      normalizedIdentity: social.identity,
    };
  }
  const host = url.hostname.toLowerCase().replace(/^www\./, "");
  if (
    DISCOVERY_HOST_MARKERS.some((marker) => host === marker.replace(/\.$/, "") || host.includes(marker)) ||
    DISCOVERY_PATH_MARKERS.some((marker) => url.pathname.toLowerCase().includes(marker))
  ) {
    return { kind: "discovery_only" };
  }
  const domainToken = normalizeBusinessName(hostnameLabel(url)).replaceAll(" ", "");
  const nameTokens = normalizeBusinessName(businessName)
    .split(" ")
    .filter((token) => token.length >= 3 && !NAME_STOP_WORDS.has(token));
  const supported = domainToken.length >= 4 &&
    (nameTokens.some((token) => domainToken.includes(token)) ||
      nameTokens.join("").length >= 5 && domainToken.includes(nameTokens.join("")));
  const homeLikePath = /^\/(?:index(?:\.html?)?|home)?\/?$/i.test(url.pathname);
  return supported && homeLikePath ? { kind: "likely_official" } : { kind: "discovery_only" };
}

export function buildTavilyQueries(query: ResearchQuery) {
  const place = `${query.territory.city}, ${query.territory.state}, Nigeria`;
  return [
    `${query.category} businesses in ${place} official website`,
    `${query.category} in ${place} official Instagram Facebook contact`,
  ];
}

type TavilySearchResult = { title?: unknown; url?: unknown; content?: unknown };

export function mapTavilySearchResponse(
  payload: unknown,
  query: ResearchQuery,
  observedAt: string,
): ResearchCandidate[] {
  const results =
    payload && typeof payload === "object" && Array.isArray((payload as { results?: unknown }).results)
      ? (payload as { results: TavilySearchResult[] }).results
      : [];
  return results.flatMap((result) => {
    if (typeof result.title !== "string" || typeof result.url !== "string") return [];
    let url: URL;
    try {
      url = new URL(result.url);
    } catch {
      return [];
    }
    if (!["http:", "https:"].includes(url.protocol)) return [];
    const name = result.title.replace(/\s*(?:\||–)\s*.*$|\s+-\s+.*$/, "").trim();
    if (!name) return [];
    const content = typeof result.content === "string" ? result.content.trim() : null;
    const classification = classifyTavilyResultUrl(name, url.href);
    const social = { instagram: [] as string[], facebook: [] as string[], tiktok: [] as string[],
      x: [] as string[], youtube: [] as string[] };
    let website: string | null = null;
    const evidence: ResearchEvidence[] = [
      {
        source: "tavily_search" as const, sourceUrl: url.href, observedAt,
        field: "businessName", value: name, confidence: "medium" as const,
        verificationStatus: "plausible" as const,
      },
      {
        source: "tavily_search" as const, sourceUrl: url.href, observedAt,
        field: "requestedCategory", value: query.category, confidence: "low" as const,
        verificationStatus: "plausible" as const,
      },
    ];
    const researchIssues = [
      "Requested territory is query context only; candidate country, state, and city remain unverified.",
    ];
    if (classification.kind === "social_profile") {
      social[classification.platform].push(url.href);
      evidence.push({
        source: "tavily_search", sourceUrl: url.href, observedAt,
        field: classification.platform, value: url.href, confidence: "low",
        verificationStatus: "plausible",
      });
      researchIssues.push("Social profile is a plausible search result and is not verified as official.");
    } else if (classification.kind === "likely_official") {
      website = url.href;
      evidence.push({
        source: "tavily_search", sourceUrl: url.href, observedAt,
        field: "website", value: url.href, confidence: "medium",
        verificationStatus: "plausible",
      });
      researchIssues.push("TAVILY_LIKELY_OFFICIAL_WEBSITE");
    } else {
      researchIssues.push("Search result URL is discovery evidence and is not treated as an official website.");
    }
    return [{
      sourceIdentities: { tavily_search: url.href },
      businessName: name,
      normalizedBusinessName: normalizeBusinessName(name),
      requestedCategory: query.category,
      requestedTerritory: { ...query.territory },
      providerCategories: [],
      country: null,
      state: null,
      city: null,
      address: null,
      latitude: null,
      longitude: null,
      website,
      phoneNumbers: [],
      emailAddresses: [],
      whatsAppNumbers: [],
      ...social,
      publicDescription: content,
      evidence,
      discoverySources: ["tavily_search"],
      researchIssues,
      firstObservedAt: observedAt,
      lastObservedAt: observedAt,
    }];
  });
}

async function tavilyRequest(path: "search" | "extract", body: Record<string, unknown>) {
  if (typeof window !== "undefined") throw new ResearchProviderError("TAVILY_SERVER_ONLY");
  const key = process.env.TAVILY_API_KEY?.trim();
  if (!key) throw new ResearchProviderError("TAVILY_NOT_CONFIGURED");
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 20_000);
  try {
    let response: Response;
    try {
      response = await fetch(`https://api.tavily.com/${path}`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
        body: JSON.stringify(body),
        signal: controller.signal,
      });
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") {
        throw new ResearchProviderError("TAVILY_TIMEOUT");
      }
      throw new ResearchProviderError("TAVILY_NETWORK_FAILURE");
    }
    if (!response.ok) {
      throw new ResearchProviderError(providerStatusReference("TAVILY", response.status));
    }
    try {
      return await response.json() as unknown;
    } catch {
      throw new ResearchProviderError("TAVILY_INVALID_JSON");
    }
  } finally {
    clearTimeout(timeout);
  }
}

export async function researchWithTavily(query: ResearchQuery): Promise<ProviderResult> {
  const candidates: ResearchCandidate[] = [];
  let rawResultCount = 0;
  let credits = 0;
  for (const searchQuery of buildTavilyQueries(query)) {
    const payload = await tavilyRequest("search", {
      query: searchQuery,
      search_depth: "basic",
      max_results: Math.min(MAX_SEARCH_RESULTS, Math.max(1, query.limit)),
      include_answer: false,
      include_raw_content: false,
    });
    credits += 1;
    const mapped = mapTavilySearchResponse(payload, query, new Date().toISOString());
    rawResultCount += mapped.length;
    candidates.push(...mapped);
    if (candidates.length >= query.limit) break;
  }
  return {
    provider: "tavily_search",
    candidates: candidates.slice(0, query.limit),
    rawResultCount,
    estimatedCredits: credits,
  };
}

export async function extractWithTavily(urls: string[]) {
  if (urls.length < 1 || urls.length > MAX_EXTRACT_URLS) {
    throw new ResearchProviderError("TAVILY_EXTRACT_URL_LIMIT");
  }
  return tavilyRequest("extract", {
    urls,
    extract_depth: "basic",
    include_images: false,
  });
}
