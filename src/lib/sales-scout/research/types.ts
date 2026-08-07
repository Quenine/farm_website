export const RESEARCH_CATEGORIES = [
  "Restaurant", "Caterer", "Hotel", "Supermarket", "Food Vendor",
  "Food Processor", "Distributor", "School", "Hospital", "Institution",
] as const;

export type ResearchCategory = (typeof RESEARCH_CATEGORIES)[number];
export type ResearchSource =
  | "geoapify_places" | "geoapify_place_details" | "tavily_search"
  | "public_web_search" | "official_website" | "manual_public_source";
export type EvidenceConfidence = "high" | "medium" | "low";
export type VerificationStatus = "verified" | "plausible" | "rejected" | "unavailable";
export type ProviderName = "GEOAPIFY" | "TAVILY" | "SERPAPI";

export type ResearchTerritory = {
  country: string;
  state: string;
  city: string;
  latitude?: number;
  longitude?: number;
  radiusKm?: number;
};

export type ResearchEvidence = {
  source: ResearchSource;
  sourceUrl: string;
  observedAt: string;
  field: string;
  value: string;
  confidence: EvidenceConfidence;
  verificationStatus: VerificationStatus;
};

export type ResearchCandidate = {
  sourceIdentities: Partial<Record<ResearchSource, string>>;
  businessName: string;
  normalizedBusinessName: string;
  requestedCategory: ResearchCategory;
  requestedTerritory: ResearchTerritory;
  providerCategories: string[];
  country: string | null;
  state: string | null;
  city: string | null;
  address: string | null;
  latitude: number | null;
  longitude: number | null;
  website: string | null;
  phoneNumbers: string[];
  emailAddresses: string[];
  whatsAppNumbers: string[];
  instagram: string[];
  facebook: string[];
  tiktok: string[];
  x: string[];
  youtube: string[];
  publicDescription: string | null;
  evidence: ResearchEvidence[];
  discoverySources: ResearchSource[];
  researchIssues: string[];
  firstObservedAt: string;
  lastObservedAt: string;
};

export type ResearchQuery = {
  territory: ResearchTerritory;
  category: ResearchCategory;
  limit: number;
};

export type ProviderResult = {
  provider: ResearchSource;
  candidates: ResearchCandidate[];
  rawResultCount: number;
  estimatedCredits: number;
  failureReference?: string;
  resolvedTerritory?: Pick<ResearchTerritory, "latitude" | "longitude">;
};

export class ResearchProviderError extends Error {
  readonly reference: string;
  constructor(reference: string, message = "Research provider operation failed.") {
    super(message);
    this.name = "ResearchProviderError";
    this.reference = reference;
  }
}

export function providerStatusReference(provider: ProviderName, status: number) {
  if (status === 400) return `${provider}_BAD_REQUEST`;
  if (status === 401) return `${provider}_UNAUTHORIZED`;
  if (status === 403) return `${provider}_FORBIDDEN`;
  if (status === 429) return `${provider}_RATE_LIMITED`;
  if (status >= 500 && status <= 599) return `${provider}_SERVER_ERROR`;
  return `${provider}_HTTP_ERROR`;
}

export function isRetryableProviderReference(reference: string) {
  return /_(?:TIMEOUT|NETWORK_FAILURE|RATE_LIMITED|SERVER_ERROR)$/.test(reference);
}
