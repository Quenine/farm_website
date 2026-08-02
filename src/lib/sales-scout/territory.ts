import { z } from "zod";
import { normalizeLocationComparison } from "./normalization.ts";
import { RESEARCH_CATEGORIES, type ResearchCategory } from "./research/types.ts";

export const NIGERIAN_STATES_AND_FCT = [
  "Abia", "Adamawa", "Akwa Ibom", "Anambra", "Bauchi", "Bayelsa", "Benue",
  "Borno", "Cross River", "Delta", "Ebonyi", "Edo", "Ekiti", "Enugu",
  "Federal Capital Territory", "Gombe", "Imo", "Jigawa", "Kaduna", "Kano",
  "Katsina", "Kebbi", "Kogi", "Kwara", "Lagos", "Nasarawa", "Niger", "Ogun",
  "Ondo", "Osun", "Oyo", "Plateau", "Rivers", "Sokoto", "Taraba", "Yobe",
  "Zamfara",
] as const;

const STATE_BY_NORMALIZED = new Map(
  NIGERIAN_STATES_AND_FCT.map((state) => [normalizeLocationComparison(state), state]),
);
for (const alias of ["fct", "abuja", "abuja fct", "abuja federal capital territory"]) {
  STATE_BY_NORMALIZED.set(alias, "Federal Capital Territory");
}

export const STRUCTURED_GEOAPIFY_CATEGORIES = [
  "Restaurant", "Hotel", "Supermarket",
] as const satisfies readonly ResearchCategory[];

export function normalizeNigerianState(value: string) {
  const normalized = normalizeLocationComparison(value)
    .replace(/\s+state$/, "")
    .trim();
  return STATE_BY_NORMALIZED.get(normalized) ?? null;
}

export function isStructuredGeoapifyCategory(value: string): value is ResearchCategory {
  return (STRUCTURED_GEOAPIFY_CATEGORIES as readonly string[]).includes(value);
}

export function unsupportedStructuredCategories(categories: readonly string[]) {
  return categories.filter((category) => !isStructuredGeoapifyCategory(category));
}

export const salesScoutCampaignInputSchema = z.object({
  campaignId: z.uuid().optional(),
  name: z.string().trim().min(2).max(120),
  status: z.enum(["draft", "active", "paused", "completed"]).default("draft"),
  country: z.literal("Nigeria").default("Nigeria"),
  state: z.string().trim().min(2).max(80).refine((value) => normalizeNigerianState(value) !== null, {
    message: "Select a Nigerian state or the FCT.",
  }),
  city: z.string().trim().min(2).max(120),
  targetCategories: z.array(z.enum(RESEARCH_CATEGORIES)).min(1).max(RESEARCH_CATEGORIES.length),
  productScope: z.string().trim().max(1000).nullable().optional(),
  deliverySummary: z.string().trim().max(1000).nullable().optional(),
  dailyReviewTarget: z.coerce.number().int().min(1).max(500),
  latitude: z.coerce.number().min(-90).max(90).nullable().optional(),
  longitude: z.coerce.number().min(-180).max(180).nullable().optional(),
  radiusKm: z.coerce.number().int().min(1).max(50),
  resultLimit: z.coerce.number().int().min(1).max(100),
  maxEnrichmentCandidates: z.coerce.number().int().min(1).max(20).default(6),
}).strict().superRefine((value, context) => {
  if ((value.latitude == null) !== (value.longitude == null)) {
    context.addIssue({ code: "custom", path: ["latitude"], message: "Provide both coordinates or neither." });
  }
});

export type SalesScoutCampaignInput = z.infer<typeof salesScoutCampaignInputSchema>;

export type TerritoryMatchEvidence = {
  matched: boolean;
  basis: "provider_city" | "coordinates_within_campaign_radius" | "none";
  provider: { country: string | null; state: string | null; city: string | null };
  campaign: { country: "Nigeria"; state: string; city: string; latitude: number | null; longitude: number | null; radiusKm: number };
  coordinates: { latitude: number | null; longitude: number | null };
  distanceKm: number | null;
};

export function haversineDistanceKm(
  left: { latitude: number; longitude: number },
  right: { latitude: number; longitude: number },
) {
  const radians = (value: number) => value * Math.PI / 180;
  const radius = 6371.0088;
  const dLatitude = radians(right.latitude - left.latitude);
  const dLongitude = radians(right.longitude - left.longitude);
  const a = Math.sin(dLatitude / 2) ** 2 +
    Math.cos(radians(left.latitude)) * Math.cos(radians(right.latitude)) *
    Math.sin(dLongitude / 2) ** 2;
  return radius * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export function evaluateTerritoryMatch(input: {
  providerCountry: string | null;
  providerState: string | null;
  providerCity: string | null;
  latitude: number | null;
  longitude: number | null;
  campaign: { state: string; city: string; latitude?: number | null; longitude?: number | null; radiusKm: number };
}): TerritoryMatchEvidence {
  const providerCountry = normalizeLocationComparison(input.providerCountry ?? "");
  const countryMatches = providerCountry === "nigeria" || providerCountry === "ng";
  const providerState = input.providerState ? normalizeNigerianState(input.providerState) : null;
  const campaignState = normalizeNigerianState(input.campaign.state);
  const stateMatches = Boolean(providerState && campaignState && providerState === campaignState);
  const cityMatches = Boolean(input.providerCity &&
    normalizeLocationComparison(input.providerCity) === normalizeLocationComparison(input.campaign.city));
  let distanceKm: number | null = null;
  if (input.latitude != null && input.longitude != null &&
      input.campaign.latitude != null && input.campaign.longitude != null) {
    distanceKm = haversineDistanceKm(
      { latitude: input.latitude, longitude: input.longitude },
      { latitude: input.campaign.latitude, longitude: input.campaign.longitude },
    );
  }
  const coordinateMatch = countryMatches && stateMatches &&
    distanceKm != null && distanceKm <= input.campaign.radiusKm;
  const matched = countryMatches && stateMatches && (cityMatches || coordinateMatch);
  return {
    matched,
    basis: cityMatches && countryMatches && stateMatches
      ? "provider_city"
      : coordinateMatch ? "coordinates_within_campaign_radius" : "none",
    provider: { country: input.providerCountry, state: input.providerState, city: input.providerCity },
    campaign: {
      country: "Nigeria",
      state: campaignState ?? input.campaign.state,
      city: input.campaign.city,
      latitude: input.campaign.latitude ?? null,
      longitude: input.campaign.longitude ?? null,
      radiusKm: input.campaign.radiusKm,
    },
    coordinates: { latitude: input.latitude, longitude: input.longitude },
    distanceKm: distanceKm == null ? null : Math.round(distanceKm * 100) / 100,
  };
}
