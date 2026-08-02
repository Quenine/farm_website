import { normalizeBusinessName } from "../normalization.ts";
import type { ProviderResult, ResearchCandidate, ResearchQuery } from "./types.ts";
import { ResearchProviderError } from "./types.ts";

const MAX_SEARCH_RESULTS = 20;
const MAX_EXTRACT_URLS = 5;

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
    const name = result.title.replace(/s*[|–-].*$/, "").trim();
    if (!name) return [];
    const content = typeof result.content === "string" ? result.content.trim() : null;
    return [{
      sourceIdentities: { tavily_search: url.href },
      businessName: name,
      normalizedBusinessName: normalizeBusinessName(name),
      requestedCategory: query.category,
      providerCategories: [],
      country: query.territory.country,
      state: query.territory.state,
      city: query.territory.city,
      address: null,
      latitude: null,
      longitude: null,
      website: url.href,
      phoneNumbers: [],
      emailAddresses: [],
      whatsAppNumbers: [],
      instagram: [],
      facebook: [],
      tiktok: [],
      x: [],
      youtube: [],
      publicDescription: content,
      evidence: [
        { source: "tavily_search", sourceUrl: url.href, observedAt, field: "businessName", value: name, confidence: "medium", verificationStatus: "plausible" },
        { source: "tavily_search", sourceUrl: url.href, observedAt, field: "requestedCategory", value: query.category, confidence: "low", verificationStatus: "plausible" },
      ],
      discoverySources: ["tavily_search"],
      researchIssues: ["Search-result snippets are discovery evidence only; contacts require source verification."],
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
    const response = await fetch(`https://api.tavily.com/${path}`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
    if (!response.ok) throw new ResearchProviderError("TAVILY_REQUEST_FAILED");
    return response.json() as Promise<unknown>;
  } catch (error) {
    if (error instanceof ResearchProviderError) throw error;
    throw new ResearchProviderError(error instanceof DOMException && error.name === "AbortError" ? "TAVILY_TIMEOUT" : "TAVILY_REQUEST_FAILED");
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
  return { provider: "tavily_search", candidates: candidates.slice(0, query.limit), rawResultCount, estimatedCredits: credits };
}

export async function extractWithTavily(urls: string[]) {
  if (urls.length < 1 || urls.length > MAX_EXTRACT_URLS) throw new ResearchProviderError("TAVILY_EXTRACT_URL_LIMIT");
  return tavilyRequest("extract", { urls, extract_depth: "basic", include_images: false });
}
