import type { ProspectPlatform } from "./domain.ts";
import { normalizeLocationComparison } from "./normalization.ts";

export const salesScoutScoringRuleVersion = "ng-city-b2b-v1" as const;
export const salesScoutQualificationThreshold = 60;
export const demandBands = ["high", "medium", "low", "unknown"] as const;
export type DemandBand = (typeof demandBands)[number];

export type ScoringFactorKey =
  | "allowed_category" | "campaign_city_presence" | "recent_public_activity"
  | "recurring_produce_demand" | "usable_contact_route" | "demand_band"
  | "inactive_or_closed" | "outside_campaign_geography" | "consumer_only";
export type ScoringFactor = {
  key: ScoringFactorKey;
  points: number;
  applied: boolean;
  reason: string;
};
export type QualificationFailure =
  | "score_below_threshold" | "category_not_allowed" | "campaign_city_not_verified"
  | "no_usable_contact_route" | "do_not_contact" | "inactive_or_closed" | "consumer_only";

export type SalesScoutScoringInput = {
  campaignCity: string;
  campaignCountry: string;
  businessCategory: string;
  allowedCampaignCategories: readonly string[];
  businessCity?: string | null;
  businessCountry?: string | null;
  serviceAreaCities?: readonly string[];
  mostRecentPublicActivityAt?: string | Date | null;
  hasRecurringProduceDemandEvidence: boolean;
  publicContactRoutes: readonly ProspectPlatform[];
  demandBand: DemandBand;
  isInactiveOrClosed: boolean;
  isConsumerOnly: boolean;
  doNotContact: boolean;
  scoredAt: string | Date;
};
export type SalesScoutScoringResult = {
  score: number;
  ruleVersion: typeof salesScoutScoringRuleVersion;
  scoredAt: string;
  factors: readonly ScoringFactor[];
  qualified: boolean;
  qualificationFailures: readonly QualificationFailure[];
};

const usableContactPlatforms = new Set<ProspectPlatform>([
  "instagram", "facebook", "tiktok", "x", "youtube",
  "website", "email", "phone", "whatsapp",
]);
const sameNormalized = (left: string | null | undefined, right: string) =>
  Boolean(left && normalizeLocationComparison(left) === normalizeLocationComparison(right));
function recentWithinNinetyDays(activityAt: string | Date | null | undefined, scoredAt: Date) {
  if (!activityAt) return false;
  const activity = new Date(activityAt);
  if (Number.isNaN(activity.getTime())) return false;
  const difference = scoredAt.getTime() - activity.getTime();
  return difference >= 0 && difference <= 90 * 24 * 60 * 60 * 1000;
}

export function scoreSalesScoutProspect(input: SalesScoutScoringInput): SalesScoutScoringResult {
  const scoredAt = new Date(input.scoredAt);
  if (Number.isNaN(scoredAt.getTime())) throw new Error("Invalid scoring timestamp.");
  const allowedCategory = input.allowedCampaignCategories.some((category) =>
    sameNormalized(category, input.businessCategory));
  const countryMatches = !input.businessCountry ||
    sameNormalized(input.businessCountry, input.campaignCountry);
  const businessCityMatches = countryMatches && sameNormalized(input.businessCity, input.campaignCity);
  const serviceAreaMatches = input.serviceAreaCities?.some((city) =>
    sameNormalized(city, input.campaignCity)) ?? false;
  const hasCampaignCityPresence = businessCityMatches || serviceAreaMatches;
  const hasKnownOutsideGeography = Boolean(
    (input.businessCountry && !sameNormalized(input.businessCountry, input.campaignCountry)) ||
    (input.businessCity && !businessCityMatches && !serviceAreaMatches));
  const isRecentlyActive = recentWithinNinetyDays(input.mostRecentPublicActivityAt, scoredAt);
  const hasUsableContact = input.publicContactRoutes.some((route) => usableContactPlatforms.has(route));
  const demandPoints = { high: 15, medium: 10, low: 5, unknown: 0 }[input.demandBand];

  const factors: ScoringFactor[] = [
    { key: "allowed_category", points: allowedCategory ? 20 : 0, applied: allowedCategory,
      reason: allowedCategory ? "Category is allowed by the campaign." : "Category is not allowed by the campaign." },
    { key: "campaign_city_presence", points: hasCampaignCityPresence ? 20 : 0, applied: hasCampaignCityPresence,
      reason: hasCampaignCityPresence ? "Business presence or service in the campaign city is verified." : "Campaign-city presence or service is not verified." },
    { key: "recent_public_activity", points: isRecentlyActive ? 15 : 0, applied: isRecentlyActive,
      reason: isRecentlyActive ? "Most recent public activity is within 90 days." : "No public activity within 90 days is verified." },
    { key: "recurring_produce_demand", points: input.hasRecurringProduceDemandEvidence ? 20 : 0,
      applied: input.hasRecurringProduceDemandEvidence,
      reason: input.hasRecurringProduceDemandEvidence ? "Recurring produce demand evidence is present." : "Recurring produce demand evidence is absent." },
    { key: "usable_contact_route", points: hasUsableContact ? 10 : 0, applied: hasUsableContact,
      reason: hasUsableContact ? "At least one usable public contact route is available." : "No usable public contact route is available." },
    { key: "demand_band", points: demandPoints, applied: demandPoints > 0, reason: `Demand band is ${input.demandBand}.` },
    { key: "inactive_or_closed", points: input.isInactiveOrClosed ? -40 : 0, applied: input.isInactiveOrClosed,
      reason: input.isInactiveOrClosed ? "Business appears inactive or closed." : "No inactive or closed signal is recorded." },
    { key: "outside_campaign_geography", points: hasKnownOutsideGeography ? -25 : 0, applied: hasKnownOutsideGeography,
      reason: hasKnownOutsideGeography ? "Known location is outside the campaign geography without service evidence." : "No outside-geography penalty applies." },
    { key: "consumer_only", points: input.isConsumerOnly ? -30 : 0, applied: input.isConsumerOnly,
      reason: input.isConsumerOnly ? "Account appears consumer-only or non-business." : "No consumer-only signal is recorded." },
  ];
  const score = Math.max(0, Math.min(100, factors.reduce((total, factor) => total + factor.points, 0)));
  const qualificationFailures: QualificationFailure[] = [];
  if (score < salesScoutQualificationThreshold) qualificationFailures.push("score_below_threshold");
  if (!allowedCategory) qualificationFailures.push("category_not_allowed");
  if (!hasCampaignCityPresence) qualificationFailures.push("campaign_city_not_verified");
  if (!hasUsableContact) qualificationFailures.push("no_usable_contact_route");
  if (input.doNotContact) qualificationFailures.push("do_not_contact");
  if (input.isInactiveOrClosed) qualificationFailures.push("inactive_or_closed");
  if (input.isConsumerOnly) qualificationFailures.push("consumer_only");
  return {
    score,
    ruleVersion: salesScoutScoringRuleVersion,
    scoredAt: scoredAt.toISOString(),
    factors,
    qualified: qualificationFailures.length === 0,
    qualificationFailures,
  };
}
