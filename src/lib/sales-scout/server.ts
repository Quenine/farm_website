import "server-only";

import { requireAdmin } from "@/src/lib/admin-auth";
import { createAdminSupabaseClient } from "@/src/lib/supabase/admin";
import { requireSalesScoutEnabled } from "./access";
import {
  duplicateResolutionSchema,
  qualificationFactsSchema,
} from "./schemas.ts";
import {
  findSoftMatchWarnings,
  prepareDiscoveryCandidate,
  type PreparedCandidate,
  type ScoutCampaignConfig,
} from "./ingestion.ts";
import type { DiscoveryCandidate } from "./discovery/types.ts";
import { scoreSalesScoutProspect } from "./scoring.ts";

type DatabaseError = { code?: string; message?: string };

export class SalesScoutOperationError extends Error {
  constructor(public readonly reference: string, message: string) {
    super(message);
    this.name = "SalesScoutOperationError";
  }
}

async function authorizeSalesScout() {
  const actor = await requireAdmin();
  requireSalesScoutEnabled();
  return actor;
}

function fail(reference: string, error?: DatabaseError): never {
  console.error("Sales Scout database operation failed", {
    reference,
    code: error?.code ?? null,
  });
  throw new SalesScoutOperationError(reference, "The Sales Scout operation could not be completed.");
}

export type SalesScoutCampaignDto = ScoutCampaignConfig & {
  name: string;
  slug: string;
  status: "draft" | "active" | "paused" | "completed";
  productScope: string | null;
  deliverySummary: string | null;
  dailyReviewTarget: number;
};

function campaignDto(
  extension: Record<string, unknown>,
  campaign: Record<string, unknown>,
): SalesScoutCampaignDto {
  return {
    campaignId: String(extension.campaign_id),
    name: String(campaign.name),
    slug: String(campaign.slug),
    status: extension.status as SalesScoutCampaignDto["status"],
    city: String(extension.city),
    state: extension.state ? String(extension.state) : null,
    country: String(extension.country),
    targetCategories: Array.isArray(extension.target_categories)
      ? extension.target_categories.map(String)
      : [],
    productScope: extension.product_scope ? String(extension.product_scope) : null,
    deliverySummary: extension.delivery_summary ? String(extension.delivery_summary) : null,
    dailyReviewTarget: Number(extension.daily_review_target),
  };
}

async function loadCampaign(database: ReturnType<typeof createAdminSupabaseClient>, campaignId: string) {
  const [extensionResult, campaignResult] = await Promise.all([
    database.from("marketing_sales_scout_campaigns")
      .select("campaign_id,status,city,state,country,target_categories,product_scope,delivery_summary,daily_review_target")
      .eq("campaign_id", campaignId).maybeSingle(),
    database.from("marketing_campaigns")
      .select("id,name,slug").eq("id", campaignId).maybeSingle(),
  ]);
  if (extensionResult.error) fail("SCOUT_CAMPAIGN_EXTENSION", extensionResult.error);
  if (campaignResult.error) fail("SCOUT_CAMPAIGN_BASE", campaignResult.error);
  if (!extensionResult.data || !campaignResult.data) {
    throw new SalesScoutOperationError("SCOUT_CAMPAIGN_NOT_FOUND", "Sales Scout campaign not found.");
  }
  return campaignDto(extensionResult.data, campaignResult.data);
}

export async function listSalesScoutCampaigns(): Promise<SalesScoutCampaignDto[]> {
  await authorizeSalesScout();
  const database = createAdminSupabaseClient();
  const extensions = await database.from("marketing_sales_scout_campaigns")
    .select("campaign_id,status,city,state,country,target_categories,product_scope,delivery_summary,daily_review_target")
    .eq("status", "active").limit(100);
  if (extensions.error) fail("SCOUT_CAMPAIGNS_LIST", extensions.error);
  const ids = (extensions.data ?? []).map((row) => row.campaign_id);
  if (!ids.length) return [];
  const campaigns = await database.from("marketing_campaigns")
    .select("id,name,slug").in("id", ids).limit(100);
  if (campaigns.error) fail("SCOUT_CAMPAIGNS_BASE_LIST", campaigns.error);
  const byId = new Map((campaigns.data ?? []).map((row) => [row.id, row]));
  return (extensions.data ?? [])
    .filter((row) => byId.has(row.campaign_id))
    .map((row) => campaignDto(row, byId.get(row.campaign_id)!));
}

export async function getSalesScoutCampaign(campaignId: string) {
  await authorizeSalesScout();
  return loadCampaign(createAdminSupabaseClient(), campaignId);
}

export type DuplicatePreviewDto = {
  exactMatch: { prospectIds: string[]; reasons: string[] } | null;
  softMatchWarnings: ReturnType<typeof findSoftMatchWarnings>;
  scorePreview: PreparedCandidate["score"];
  normalizedCandidate: PreparedCandidate;
  allowedResolutionChoices: Array<
    { choice: "create_new" } |
    { choice: "attach_to_existing"; prospectId: string }
  >;
};

async function previewWithDatabase(
  database: ReturnType<typeof createAdminSupabaseClient>,
  candidate: DiscoveryCandidate,
): Promise<DuplicatePreviewDto> {
  const campaign = await loadCampaign(database, candidate.campaignId);
  const prepared = prepareDiscoveryCandidate(candidate, campaign);
  const identities = prepared.channels.map((channel) => channel.identityKey);
  const platforms = prepared.channels.map((channel) => channel.platform);
  const [channelsResult, providerResult, softResult] = await Promise.all([
    database.from("marketing_prospect_channels")
      .select("prospect_id,platform,identity_key").eq("is_active", true)
      .in("platform", platforms).in("identity_key", identities).limit(100),
    prepared.providerSourceId
      ? database.from("marketing_prospects").select("id")
        .eq("discovery_source", prepared.provider)
        .eq("discovery_source_id", prepared.providerSourceId).limit(10)
      : Promise.resolve({ data: [], error: null }),
    database.from("marketing_prospects")
      .select("id,business_name,business_category,city,country")
      .ilike("city", prepared.city).limit(50),
  ]);
  if (channelsResult.error) fail("SCOUT_DUPLICATE_CHANNELS", channelsResult.error);
  if (providerResult.error) fail("SCOUT_DUPLICATE_PROVIDER", providerResult.error);
  if (softResult.error) fail("SCOUT_DUPLICATE_SOFT", softResult.error);
  const keySet = new Set(prepared.channels.map((channel) => `${channel.platform}:${channel.identityKey}`));
  const exactIds = new Set<string>();
  const reasons = new Set<string>();
  for (const row of channelsResult.data ?? []) {
    if (keySet.has(`${row.platform}:${row.identity_key}`)) {
      exactIds.add(row.prospect_id);
      reasons.add(`${row.platform}:${row.identity_key}`);
    }
  }
  for (const row of providerResult.data ?? []) {
    exactIds.add(row.id);
    reasons.add(`provider:${prepared.provider}:${prepared.providerSourceId}`);
  }
  const softMatchWarnings = findSoftMatchWarnings(
    prepared,
    (softResult.data ?? []).map((row) => ({
      id: row.id,
      businessName: row.business_name,
      businessCategory: row.business_category,
      city: row.city,
      country: row.country,
    })),
  );
  const attachIds = new Set([...exactIds, ...softMatchWarnings.map((warning) => warning.prospectId)]);
  return {
    exactMatch: exactIds.size
      ? { prospectIds: [...exactIds], reasons: [...reasons] }
      : null,
    softMatchWarnings,
    scorePreview: prepared.score,
    normalizedCandidate: prepared,
    allowedResolutionChoices: exactIds.size
      ? [...exactIds].map((prospectId) => ({ choice: "attach_to_existing" as const, prospectId }))
      : [
          { choice: "create_new" as const },
          ...[...attachIds].map((prospectId) => ({
            choice: "attach_to_existing" as const,
            prospectId,
          })),
        ],
  };
}

export async function previewSalesScoutCandidate(candidate: DiscoveryCandidate) {
  await authorizeSalesScout();
  return previewWithDatabase(createAdminSupabaseClient(), candidate);
}

export type CaptureCandidateDto = {
  outcome: "created" | "attached" | "exact_existing";
  prospectId: string;
  channelsInserted: number;
  exactDuplicateReason: string | null;
  activityId: string | null;
};

export async function captureSalesScoutCandidate(input: {
  candidate: DiscoveryCandidate;
  resolution: unknown;
}): Promise<CaptureCandidateDto> {
  const actor = await authorizeSalesScout();
  const resolution = duplicateResolutionSchema.parse(input.resolution);
  const database = createAdminSupabaseClient();
  const preview = await previewWithDatabase(database, input.candidate);
  if (resolution.choice === "create_new" && preview.exactMatch) {
    throw new SalesScoutOperationError("SCOUT_EXACT_REQUIRES_ATTACH", "An exact identity already exists.");
  }
  const { data, error } = await database.rpc("capture_sales_scout_candidate", {
    p_payload: preview.normalizedCandidate,
    p_resolution: resolution.choice,
    p_existing_prospect_id:
      resolution.choice === "attach_to_existing" ? resolution.prospectId : null,
    p_actor_id: actor.id,
  });
  if (error) fail("SCOUT_CAPTURE_RPC", error);
  const result = data as Record<string, unknown>;
  return {
    outcome: String(result.outcome) as CaptureCandidateDto["outcome"],
    prospectId: String(result.prospect_id),
    channelsInserted: Number(result.channels_inserted ?? 0),
    exactDuplicateReason: result.exact_duplicate_reason
      ? String(result.exact_duplicate_reason)
      : null,
    activityId: result.activity_id ? String(result.activity_id) : null,
  };
}

export async function updateSalesScoutQualificationFacts(raw: unknown) {
  const actor = await authorizeSalesScout();
  const facts = qualificationFactsSchema.parse(raw);
  const database = createAdminSupabaseClient();
  const [campaign, prospectResult, channelsResult] = await Promise.all([
    loadCampaign(database, facts.campaignId),
    database.from("marketing_prospects")
      .select("id,do_not_contact_at,scout_status,stage")
      .eq("id", facts.prospectId).maybeSingle(),
    database.from("marketing_prospect_channels")
      .select("platform").eq("prospect_id", facts.prospectId).eq("is_active", true).limit(50),
  ]);
  if (prospectResult.error) fail("SCOUT_FACTS_PROSPECT", prospectResult.error);
  if (channelsResult.error) fail("SCOUT_FACTS_CHANNELS", channelsResult.error);
  if (!prospectResult.data) {
    throw new SalesScoutOperationError("SCOUT_PROSPECT_NOT_FOUND", "Sales Scout prospect not found.");
  }
  const scoredAt = new Date().toISOString();
  const score = scoreSalesScoutProspect({
    campaignCity: campaign.city,
    campaignCountry: campaign.country,
    businessCategory: facts.businessCategory,
    allowedCampaignCategories: campaign.targetCategories,
    businessCity: facts.city,
    businessCountry: facts.country,
    serviceAreaCities: facts.serviceAreaCities,
    mostRecentPublicActivityAt: facts.mostRecentPublicActivityAt,
    hasRecurringProduceDemandEvidence: Boolean(facts.recurringProduceDemandEvidence),
    publicContactRoutes: (channelsResult.data ?? []).map((row) => row.platform),
    demandBand: facts.demandBand,
    isInactiveOrClosed: facts.isInactiveOrClosed,
    isConsumerOnly: facts.isConsumerOnly,
    doNotContact: Boolean(prospectResult.data.do_not_contact_at),
    scoredAt,
  });
  const update = await database.from("marketing_prospects").update({
    business_category: facts.businessCategory,
    city: facts.city,
    state: facts.state,
    country: facts.country,
    service_area_cities: facts.serviceAreaCities,
    profile_last_activity_at: facts.mostRecentPublicActivityAt,
    has_recurring_produce_demand: Boolean(facts.recurringProduceDemandEvidence),
    recurring_demand_evidence: facts.recurringProduceDemandEvidence,
    demand_band: facts.demandBand,
    appears_inactive_or_closed: facts.isInactiveOrClosed,
    is_consumer_only: facts.isConsumerOnly,
    source_url: facts.sourceUrl,
    location_evidence: facts.locationEvidence,
    score: score.score,
    score_version: score.ruleVersion,
    score_factors: score.factors,
    scored_at: score.scoredAt,
    updated_at: new Date().toISOString(),
  }).eq("id", facts.prospectId);
  if (update.error) fail("SCOUT_FACTS_UPDATE", update.error);
  const activity = await database.rpc("record_marketing_prospect_activity", {
    p_prospect_id: facts.prospectId,
    p_activity_type: "sales_scout",
    p_summary: "Sales Scout qualification facts and score updated.",
    p_occurred_at: score.scoredAt,
    p_next_follow_up_at: null,
    p_actor_id: actor.id,
    p_metadata: { event: "scout_scored", score: score.score, score_version: score.ruleVersion },
  });
  if (activity.error) fail("SCOUT_FACTS_ACTIVITY", activity.error);
  return {
    prospectId: facts.prospectId,
    score,
    scoutStatus: prospectResult.data.scout_status,
  };
}

