import { discoveryCandidateSchema } from "./schemas.ts";
import type { DiscoveryCandidate } from "./discovery/types.ts";
import type { ProspectPlatform } from "./domain.ts";
import {
  canonicalizeWebsiteHostname,
  normalizeBusinessName,
  normalizeEmail,
  normalizeLocationComparison,
  normalizeNigerianPhone,
  normalizeSocialIdentity,
} from "./normalization.ts";
import { scoreSalesScoutProspect } from "./scoring.ts";

export type ScoutCampaignConfig = {
  campaignId: string;
  city: string;
  state: string | null;
  country: string;
  targetCategories: readonly string[];
};
export type PreparedChannel = {
  platform: ProspectPlatform;
  handleOrValue: string;
  identityKey: string;
  profileUrl: string | null;
  isPrimary: boolean;
  sourceId: string | null;
  evidence: Record<string, unknown>;
};
export type PreparedCandidate = {
  provider: string;
  providerSourceId: string | null;
  sourceUrl: string;
  observedAt: string;
  campaignId: string;
  businessName: string;
  normalizedBusinessName: string;
  businessCategory: string;
  city: string;
  normalizedCity: string;
  state: string | null;
  country: string;
  normalizedCountry: string;
  publicDescription: string | null;
  serviceAreaCities: string[];
  mostRecentPublicActivityAt: string | null;
  recurringProduceDemandEvidence: string | null;
  demandBand: DiscoveryCandidate["demandBand"];
  isInactiveOrClosed: boolean;
  isConsumerOnly: boolean;
  channels: PreparedChannel[];
  exactLookupKeys: string[];
  score: ReturnType<typeof scoreSalesScoutProspect>;
};
export type ExistingProspectSummary = {
  id: string;
  businessName: string;
  businessCategory: string | null;
  city: string | null;
  country: string | null;
  contactIsGeneric?: boolean;
};
export type SoftMatchWarning = {
  prospectId: string;
  reason: "same_name_location" | "similar_name_same_city" |
    "same_name_category" | "shared_generic_contact";
};

function channelIdentity(platform: ProspectPlatform, raw: string, profileUrl?: string) {
  if (platform === "phone" || platform === "whatsapp") return normalizeNigerianPhone(raw);
  if (platform === "email") return normalizeEmail(raw);
  if (platform === "website") return canonicalizeWebsiteHostname(profileUrl ?? raw);
  if (["instagram", "facebook", "tiktok", "x", "youtube"].includes(platform)) {
    return normalizeSocialIdentity(
      profileUrl ?? raw,
      platform as "instagram" | "facebook" | "tiktok" | "x" | "youtube",
    )?.identity ?? null;
  }
  return raw.trim().toLowerCase() || null;
}

function tokenSimilarity(left: string, right: string) {
  const a = new Set(left.split(" ").filter((part) => part.length > 1));
  const b = new Set(right.split(" ").filter((part) => part.length > 1));
  if (!a.size || !b.size) return 0;
  return [...a].filter((part) => b.has(part)).length / Math.max(a.size, b.size);
}

export function prepareDiscoveryCandidate(raw: unknown, campaign: ScoutCampaignConfig): PreparedCandidate {
  const candidate = discoveryCandidateSchema.parse(raw);
  if (candidate.campaignId !== campaign.campaignId) {
    throw new Error("Candidate campaign does not match the selected campaign.");
  }
  const normalized = new Map<string, PreparedChannel>();
  for (const channel of candidate.channels) {
    const identityKey = channelIdentity(channel.platform, channel.handleOrValue, channel.profileUrl);
    if (!identityKey) throw new Error(`Unusable ${channel.platform} channel.`);
    const key = `${channel.platform}:${identityKey}`;
    const existing = normalized.get(key);
    if (existing) {
      normalized.set(key, {
        ...existing,
        isPrimary: existing.isPrimary || channel.isPrimary,
        evidence: { ...existing.evidence, ...channel.evidence },
      });
    } else {
      normalized.set(key, {
        platform: channel.platform,
        handleOrValue: channel.handleOrValue,
        identityKey,
        profileUrl: channel.profileUrl ?? null,
        isPrimary: channel.isPrimary,
        sourceId: channel.sourceId ?? null,
        evidence: channel.evidence,
      });
    }
  }
  const channels = [...normalized.values()];
  if (channels.filter((channel) => channel.isPrimary).length > 1) {
    throw new Error("Candidate has conflicting primary channels.");
  }
  if (!channels.some((channel) => channel.isPrimary)) channels[0] = { ...channels[0], isPrimary: true };
  const publicContactRoutes = channels.map((channel) => channel.platform)
    .filter((platform) => platform !== "other");
  if (!publicContactRoutes.length) {
    throw new Error("At least one usable public contact channel is required.");
  }
  const score = scoreSalesScoutProspect({
    campaignCity: campaign.city,
    campaignCountry: campaign.country,
    businessCategory: candidate.businessCategory,
    allowedCampaignCategories: campaign.targetCategories,
    businessCity: candidate.city,
    businessCountry: candidate.country,
    serviceAreaCities: candidate.serviceAreaCities,
    mostRecentPublicActivityAt: candidate.mostRecentPublicActivityAt,
    hasRecurringProduceDemandEvidence: Boolean(candidate.recurringProduceDemandEvidence),
    publicContactRoutes,
    demandBand: candidate.demandBand,
    isInactiveOrClosed: candidate.isInactiveOrClosed,
    isConsumerOnly: candidate.isConsumerOnly,
    doNotContact: false,
    scoredAt: candidate.observedAt,
  });
  const exactLookupKeys = channels.map((channel) => `${channel.platform}:${channel.identityKey}`).sort();
  if (candidate.providerSourceId) {
    exactLookupKeys.push(`provider:${candidate.provider}:${candidate.providerSourceId}`);
  }
  return {
    provider: candidate.provider,
    providerSourceId: candidate.providerSourceId ?? null,
    sourceUrl: candidate.sourceUrl,
    observedAt: new Date(candidate.observedAt).toISOString(),
    campaignId: candidate.campaignId,
    businessName: candidate.businessName,
    normalizedBusinessName: normalizeBusinessName(candidate.businessName),
    businessCategory: candidate.businessCategory,
    city: candidate.city,
    normalizedCity: normalizeLocationComparison(candidate.city),
    state: candidate.state ?? null,
    country: candidate.country,
    normalizedCountry: normalizeLocationComparison(candidate.country),
    publicDescription: candidate.publicDescription ?? null,
    serviceAreaCities: candidate.serviceAreaCities,
    mostRecentPublicActivityAt: candidate.mostRecentPublicActivityAt ?? null,
    recurringProduceDemandEvidence: candidate.recurringProduceDemandEvidence ?? null,
    demandBand: candidate.demandBand,
    isInactiveOrClosed: candidate.isInactiveOrClosed,
    isConsumerOnly: candidate.isConsumerOnly,
    channels,
    exactLookupKeys,
    score,
  };
}

export function findSoftMatchWarnings(
  candidate: PreparedCandidate,
  prospects: readonly ExistingProspectSummary[],
): SoftMatchWarning[] {
  const warnings: SoftMatchWarning[] = [];
  for (const prospect of prospects) {
    const name = normalizeBusinessName(prospect.businessName);
    const sameName = name === candidate.normalizedBusinessName;
    const sameCity = normalizeLocationComparison(prospect.city ?? "") === candidate.normalizedCity;
    const sameCountry = normalizeLocationComparison(prospect.country ?? "") === candidate.normalizedCountry;
    if (sameName && sameCity && sameCountry) {
      warnings.push({ prospectId: prospect.id, reason: "same_name_location" });
    } else if (sameCity && tokenSimilarity(name, candidate.normalizedBusinessName) >= 0.75) {
      warnings.push({ prospectId: prospect.id, reason: "similar_name_same_city" });
    } else if (sameName && normalizeLocationComparison(prospect.businessCategory ?? "") ===
      normalizeLocationComparison(candidate.businessCategory)) {
      warnings.push({ prospectId: prospect.id, reason: "same_name_category" });
    }
    if (prospect.contactIsGeneric) {
      warnings.push({ prospectId: prospect.id, reason: "shared_generic_contact" });
    }
  }
  return warnings;
}
