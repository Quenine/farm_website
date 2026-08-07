import { providerStatusReference, ResearchProviderError } from "./types.ts";
import type { PublicWebSearchProvider, PublicWebSearchResult } from "./public-web.ts";

type Fetcher = typeof fetch;

export function buildSerpApiUrl(query: string, location: string, key = "configured") {
  const url = new URL("https://serpapi.com/search");
  url.searchParams.set("engine", "google");
  url.searchParams.set("q", query);
  url.searchParams.set("location", location);
  url.searchParams.set("gl", "ng");
  url.searchParams.set("hl", "en");
  url.searchParams.set("safe", "active");
  url.searchParams.set("output", "json");
  url.searchParams.set("api_key", key);
  return url;
}

export function mapSerpApiResponse(payload: unknown) {
  const object = payload && typeof payload === "object" ? payload as Record<string, unknown> : {};
  if (typeof object.error === "string" && object.error.trim()) {
    throw new ResearchProviderError("SERPAPI_RESPONSE_ERROR");
  }
  const metadata = object.search_metadata && typeof object.search_metadata === "object"
    ? object.search_metadata as Record<string, unknown> : {};
  const callReference = typeof metadata.id === "string" && metadata.id.trim()
    ? metadata.id.trim() : "completed-search";
  const rows = Array.isArray(object.organic_results) ? object.organic_results : [];
  const results: PublicWebSearchResult[] = rows.flatMap((row) => {
    if (!row || typeof row !== "object") return [];
    const item = row as Record<string, unknown>;
    if (typeof item.link !== "string" || !/^https?:\/\//i.test(item.link)) return [];
    return [{
      position: typeof item.position === "number" ? item.position : null,
      title: typeof item.title === "string" ? item.title : "",
      link: item.link,
      snippet: typeof item.snippet === "string" ? item.snippet : "",
    }];
  });
  return { callReference, results: results.slice(0, 10) };
}

export function createSerpApiProvider(fetcher: Fetcher = fetch): PublicWebSearchProvider {
  return async ({ query, territory, deadlineAtMs, now }) => {
    if (typeof window !== "undefined") throw new ResearchProviderError("SERPAPI_SERVER_ONLY");
    const key = process.env.SERPAPI_API_KEY?.trim();
    if (!key) throw new ResearchProviderError("SERPAPI_NOT_CONFIGURED");
    const remaining = Math.max(1, deadlineAtMs - now());
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), Math.min(12_000, remaining));
    try {
      let response: Response;
      try {
        response = await fetcher(buildSerpApiUrl(query,
          `${territory.city}, ${territory.state}, Nigeria`, key), {
          signal: controller.signal,
          headers: { Accept: "application/json" },
        });
      } catch (error) {
        if (error instanceof DOMException && error.name === "AbortError") {
          throw new ResearchProviderError("SERPAPI_TIMEOUT");
        }
        throw new ResearchProviderError("SERPAPI_NETWORK_FAILURE");
      }
      if (!response.ok) throw new ResearchProviderError(providerStatusReference("SERPAPI", response.status));
      let payload: unknown;
      try { payload = await response.json(); }
      catch { throw new ResearchProviderError("SERPAPI_INVALID_JSON"); }
      const mapped = mapSerpApiResponse(payload);
      return { provider: "serpapi", query, ...mapped };
    } finally {
      clearTimeout(timeout);
    }
  };
}

export const researchWithSerpApi = createSerpApiProvider();
