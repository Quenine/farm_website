import { normalizeBusinessName } from "../normalization.ts";
import type {
  ProviderResult,
  ResearchCandidate,
  ResearchCategory,
  ResearchQuery,
  ResearchEvidence,
  ResearchTerritory,
} from "./types.ts";
import { ResearchProviderError } from "./types.ts";

const CATEGORY_MAP: Partial<Record<ResearchCategory, string>> = {
  Restaurant: "catering.restaurant",
  Hotel: "accommodation.hotel",
  Supermarket: "commercial.supermarket",
};
const MAX_LIMIT = 20;
const MAX_PAGES = 4;

export function geoapifyCategory(category: ResearchCategory) {
  return CATEGORY_MAP[category] ?? null;
}

export function buildGeoapifyTerritoryUrl(territory: ResearchTerritory, key = "configured") {
  const url = new URL("https://api.geoapify.com/v1/geocode/search");
  url.searchParams.set("text", `${territory.city}, ${territory.state}, Nigeria`);
  url.searchParams.set("filter", "countrycode:ng");
  url.searchParams.set("limit", "5");
  url.searchParams.set("apiKey", key);
  return url;
}

export function buildGeoapifyPlacesUrl(
  query: ResearchQuery,
  longitude: number,
  latitude: number,
  page: number,
  key = "configured",
) {
  const category = geoapifyCategory(query.category);
  if (!category) throw new ResearchProviderError("GEOAPIFY_CATEGORY_UNSUPPORTED");
  const limit = Math.min(MAX_LIMIT, Math.max(1, query.limit));
  const radius = Math.min(50_000, Math.max(1_000, (query.territory.radiusKm ?? 20) * 1_000));
  const url = new URL("https://api.geoapify.com/v2/places");
  url.searchParams.set("categories", category);
  url.searchParams.set("filter", `circle:${longitude},${latitude},${radius}`);
  url.searchParams.set("bias", `proximity:${longitude},${latitude}`);
  url.searchParams.set("limit", String(limit));
  url.searchParams.set("offset", String((page - 1) * limit));
  url.searchParams.set("apiKey", key);
  return url;
}

type GeoFeature = {
  properties?: {
    place_id?: unknown;
    name?: unknown;
    categories?: unknown;
    formatted?: unknown;
    city?: unknown;
    state?: unknown;
    country?: unknown;
    country_code?: unknown;
    lon?: unknown;
    lat?: unknown;
    website?: unknown;
    contact?: { phone?: unknown };
  };
};

export function mapGeoapifyPlacesResponse(
  payload: unknown,
  query: ResearchQuery,
  observedAt: string,
): ResearchCandidate[] {
  const features =
    payload && typeof payload === "object" && Array.isArray((payload as { features?: unknown }).features)
      ? ((payload as { features: GeoFeature[] }).features)
      : [];
  return features.flatMap((feature) => {
    const properties = feature.properties;
    if (!properties || typeof properties.name !== "string" || !properties.name.trim()) return [];
    const placeId = typeof properties.place_id === "string" ? properties.place_id : null;
    const sourceUrl = placeId
      ? `https://www.geoapify.com/place-details/?id=${encodeURIComponent(placeId)}`
      : "https://www.geoapify.com/";
    const evidence: ResearchEvidence[] = [
      {
        source: "geoapify_places" as const,
        sourceUrl,
        observedAt,
        field: "businessName",
        value: properties.name.trim(),
        confidence: "high" as const,
        verificationStatus: "verified" as const,
      },
      {
        source: "geoapify_places" as const,
        sourceUrl,
        observedAt,
        field: "requestedCategory",
        value: query.category,
        confidence: "medium" as const,
        verificationStatus: "plausible" as const,
      },
    ];
    const website = typeof properties.website === "string" ? properties.website.trim() || null : null;
    const phone =
      properties.contact && typeof properties.contact.phone === "string"
        ? properties.contact.phone.trim()
        : null;
    if (website) evidence.push({ source: "geoapify_places", sourceUrl, observedAt, field: "website", value: website, confidence: "medium", verificationStatus: "plausible" });
    if (phone) evidence.push({ source: "geoapify_places", sourceUrl, observedAt, field: "phone", value: phone, confidence: "medium", verificationStatus: "plausible" });
    return [{
      sourceIdentities: placeId ? { geoapify_places: placeId } : {},
      businessName: properties.name.trim(),
      normalizedBusinessName: normalizeBusinessName(properties.name),
      requestedCategory: query.category,
      providerCategories: Array.isArray(properties.categories)
        ? properties.categories.filter((item): item is string => typeof item === "string")
        : [],
      country: typeof properties.country === "string" ? properties.country : null,
      state: typeof properties.state === "string" ? properties.state : null,
      city: typeof properties.city === "string" ? properties.city : null,
      address: typeof properties.formatted === "string" ? properties.formatted : null,
      latitude: typeof properties.lat === "number" ? properties.lat : null,
      longitude: typeof properties.lon === "number" ? properties.lon : null,
      website,
      phoneNumbers: phone ? [phone] : [],
      emailAddresses: [],
      whatsAppNumbers: [],
      instagram: [],
      facebook: [],
      tiktok: [],
      x: [],
      youtube: [],
      publicDescription: null,
      evidence,
      discoverySources: ["geoapify_places"],
      researchIssues: [],
      firstObservedAt: observedAt,
      lastObservedAt: observedAt,
    }];
  });
}

async function geoFetch(url: URL, signal: AbortSignal) {
  const response = await fetch(url, { signal, headers: { Accept: "application/json" } });
  if (!response.ok) throw new ResearchProviderError("GEOAPIFY_REQUEST_FAILED");
  return response.json() as Promise<unknown>;
}

export async function researchWithGeoapify(query: ResearchQuery): Promise<ProviderResult> {
  if (typeof window !== "undefined") throw new ResearchProviderError("GEOAPIFY_SERVER_ONLY");
  const key = process.env.GEOAPIFY_API_KEY?.trim();
  if (!key) throw new ResearchProviderError("GEOAPIFY_NOT_CONFIGURED");
  const category = geoapifyCategory(query.category);
  if (!category) {
    return { provider: "geoapify_places", candidates: [], rawResultCount: 0, estimatedCredits: 0, failureReference: "GEOAPIFY_CATEGORY_UNSUPPORTED" };
  }
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15_000);
  try {
    let longitude = query.territory.longitude;
    let latitude = query.territory.latitude;
    let credits = 0;
    if (longitude == null || latitude == null) {
      const geocode = await geoFetch(buildGeoapifyTerritoryUrl(query.territory, key), controller.signal);
      credits += 1;
      const first = (geocode as { features?: Array<{ properties?: { lon?: number; lat?: number } }> }).features?.[0]?.properties;
      longitude = first?.lon;
      latitude = first?.lat;
    }
    if (longitude == null || latitude == null) throw new ResearchProviderError("GEOAPIFY_TERRITORY_NOT_RESOLVED");
    const candidates: ResearchCandidate[] = [];
    const pages = Math.min(MAX_PAGES, Math.ceil(Math.min(MAX_LIMIT, query.limit) / Math.min(MAX_LIMIT, query.limit)));
    for (let page = 1; page <= pages; page += 1) {
      const payload = await geoFetch(buildGeoapifyPlacesUrl(query, longitude, latitude, page, key), controller.signal);
      credits += 1;
      candidates.push(...mapGeoapifyPlacesResponse(payload, query, new Date().toISOString()));
      if (candidates.length >= query.limit) break;
    }
    return { provider: "geoapify_places", candidates: candidates.slice(0, query.limit), rawResultCount: candidates.length, estimatedCredits: credits };
  } catch (error) {
    if (error instanceof ResearchProviderError) throw error;
    throw new ResearchProviderError(error instanceof DOMException && error.name === "AbortError" ? "GEOAPIFY_TIMEOUT" : "GEOAPIFY_REQUEST_FAILED");
  } finally {
    clearTimeout(timeout);
  }
}
