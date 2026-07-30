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
import {
  campaignStatusSchema,
  doNotContactSchema,
  isCaptureResolutionAllowed,
  parseQueueFilters,
  reviewTransitionSchema,
} from "./review.ts";

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

export async function listAllSalesScoutCampaigns(): Promise<SalesScoutCampaignDto[]> {
  await authorizeSalesScout();
  const database = createAdminSupabaseClient();
  const extensions = await database.from("marketing_sales_scout_campaigns")
    .select("campaign_id,status,city,state,country,target_categories,product_scope,delivery_summary,daily_review_target")
    .order("created_at", { ascending: false }).limit(100);
  if (extensions.error) fail("SCOUT_CAMPAIGNS_ADMIN", extensions.error);
  const ids = (extensions.data ?? []).map((row) => row.campaign_id);
  if (!ids.length) return [];
  const campaigns = await database.from("marketing_campaigns").select("id,name,slug").in("id", ids);
  if (campaigns.error) fail("SCOUT_CAMPAIGNS_ADMIN_BASE", campaigns.error);
  const byId = new Map((campaigns.data ?? []).map((row) => [row.id, row]));
  return (extensions.data ?? []).filter((row) => byId.has(row.campaign_id))
    .map((row) => campaignDto(row, byId.get(row.campaign_id)!));
}

export async function getSalesScoutCampaign(campaignId: string) {
  await authorizeSalesScout();
  return loadCampaign(createAdminSupabaseClient(), campaignId);
}

export type DuplicatePreviewDto = {
  exactMatch: { prospects: MatchProspectSummaryDto[]; reasons: string[] } | null;
  softMatchWarnings: Array<ReturnType<typeof findSoftMatchWarnings>[number] & { prospect: MatchProspectSummaryDto }>;
  scorePreview: PreparedCandidate["score"];
  normalizedCandidate: PreparedCandidate;
  allowedResolutionChoices: Array<
    { choice: "create_new" } |
    { choice: "attach_to_existing"; prospectId: string; prospect: MatchProspectSummaryDto }
  >;
};
export type MatchProspectSummaryDto={id:string;businessName:string;businessCategory:string|null;city:string|null;country:string|null;scoutStatus:string|null;commercialStage:string;alreadyEnrolled:boolean};

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
      .select("id,business_name,business_category,city,country,scout_status,stage,scout_campaign_id")
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
  const matchResult=attachIds.size?await database.from("marketing_prospects").select("id,business_name,business_category,city,country,scout_status,stage,scout_campaign_id").in("id",[...attachIds]):{data:[],error:null};
  if(matchResult.error)fail("SCOUT_MATCH_SUMMARIES",matchResult.error);
  const summaries=new Map((matchResult.data??[]).map(row=>[row.id,{id:row.id,businessName:row.business_name,businessCategory:row.business_category,city:row.city,country:row.country,scoutStatus:row.scout_status,commercialStage:row.stage,alreadyEnrolled:Boolean(row.scout_campaign_id)}]));
  return {
    exactMatch: exactIds.size
      ? { prospects: [...exactIds].map(id=>summaries.get(id)!).filter(Boolean), reasons: [...reasons] }
      : null,
    softMatchWarnings: softMatchWarnings.map(warning=>({...warning,prospect:summaries.get(warning.prospectId)!})).filter(item=>item.prospect),
    scorePreview: prepared.score,
    normalizedCandidate: prepared,
    allowedResolutionChoices: exactIds.size
      ? [...exactIds].map((prospectId) => ({ choice: "attach_to_existing" as const, prospectId, prospect:summaries.get(prospectId)! }))
      : [
          { choice: "create_new" as const },
          ...[...attachIds].map((prospectId) => ({
            choice: "attach_to_existing" as const,
            prospectId, prospect:summaries.get(prospectId)!,
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
  existingProspectEnrolled: boolean;
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
  if (!isCaptureResolutionAllowed(preview.allowedResolutionChoices, resolution)) {
    throw new SalesScoutOperationError(
      "SCOUT_ATTACHMENT_NOT_ALLOWED",
      "The selected prospect is not an allowed match for this candidate.",
    );
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
    existingProspectEnrolled: Boolean(result.existing_prospect_enrolled),
  };
}

export type QualificationUpdateDto = {
  prospectId: string;
  score: number;
  ruleVersion: string;
  activityId: string;
};

export async function updateSalesScoutQualificationFacts(
  raw: unknown,
): Promise<QualificationUpdateDto> {
  const actor = await authorizeSalesScout();
  const facts = qualificationFactsSchema.parse(raw);
  const database = createAdminSupabaseClient();
  const [campaign, prospectResult, channelsResult] = await Promise.all([
    loadCampaign(database, facts.campaignId),
    database.from("marketing_prospects")
      .select("id,do_not_contact_at")
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
  const { data, error } = await database.rpc("update_sales_scout_qualification_facts", {
    p_payload: { ...facts, score },
    p_actor_id: actor.id,
  });
  if (error) fail("SCOUT_FACTS_RPC", error);
  const result = data as Record<string, unknown>;
  return {
    prospectId: String(result.prospect_id),
    score: Number(result.score),
    ruleVersion: String(result.rule_version),
    activityId: String(result.activity_id),
  };
}

export type SalesScoutQueueRowDto = {
  id: string; businessName: string; businessCategory: string | null;
  city: string | null; state: string | null; country: string | null;
  scoutStatus: string; commercialStage: string; score: number | null;
  scoreVersion: string | null; discoverySource: string | null; sourceUrl: string | null;
  discoveredAt: string | null; lastPublicActivityAt: string | null;
  doNotContact: boolean; handoverStatus: string | null; campaignId: string | null;
  createdAt: string; channels: Array<{ platform: string; value: string; primary: boolean }>;
};

const queueSelect = "id,business_name,business_category,city,state,country,scout_status,stage,score,score_version,discovery_source,source_url,discovered_at,profile_last_activity_at,do_not_contact_at,handover_status,scout_campaign_id,created_at";

export async function loadSalesScoutQueue(raw: Record<string, string | undefined>) {
  await authorizeSalesScout();
  const filters = parseQueueFilters(raw);
  const database = createAdminSupabaseClient();
  let query = database.from("marketing_prospects").select(queueSelect, { count: "exact" })
    .not("scout_status", "is", null);
  if (filters.campaignId) query = query.eq("scout_campaign_id", filters.campaignId);
  if (filters.scoutStatus) query = query.eq("scout_status", filters.scoutStatus);
  if (filters.city) query = query.ilike("city", filters.city);
  if (filters.category) query = query.ilike("business_category", filters.category);
  if (filters.source) query = query.ilike("discovery_source", filters.source);
  if (filters.minimumScore !== undefined) query = query.gte("score", filters.minimumScore);
  if (filters.search) {
    const safe = filters.search.replace(/[%_,()]/g, " ");
    query = query.or(`business_name.ilike.%${safe}%,business_category.ilike.%${safe}%`);
  }
  if(filters.sort==="oldest_unreviewed")query=query.in("scout_status",["new","researching"]);
  query = filters.sort === "highest_score"
    ? query.order("score", { ascending: false, nullsFirst: false })
    : filters.sort === "oldest_unreviewed"
      ? query.order("created_at", { ascending: true })
      : query.order("created_at", { ascending: false });
  const from = (filters.page - 1) * filters.pageSize;
  const result = await query.range(from, from + filters.pageSize - 1);
  if (result.error) fail("SCOUT_QUEUE", result.error);
  const ids = (result.data ?? []).map((row) => row.id);
  const channelResult = ids.length ? await database.from("marketing_prospect_channels")
    .select("prospect_id,platform,handle_or_value,is_primary").in("prospect_id", ids)
    .eq("is_active", true).order("is_primary", { ascending: false }).limit(250) : { data: [], error: null };
  if (channelResult.error) fail("SCOUT_QUEUE_CHANNELS", channelResult.error);
  const channels = new Map<string, SalesScoutQueueRowDto["channels"]>();
  for (const channel of channelResult.data ?? []) {
    const list = channels.get(channel.prospect_id) ?? [];
    list.push({ platform: channel.platform, value: channel.handle_or_value, primary: channel.is_primary });
    channels.set(channel.prospect_id, list);
  }
  const rows: SalesScoutQueueRowDto[] = (result.data ?? []).map((row) => ({
    id: row.id, businessName: row.business_name, businessCategory: row.business_category,
    city: row.city, state: row.state, country: row.country, scoutStatus: row.scout_status,
    commercialStage: row.stage, score: row.score, scoreVersion: row.score_version,
    discoverySource: row.discovery_source, sourceUrl: row.source_url,
    discoveredAt: row.discovered_at, lastPublicActivityAt: row.profile_last_activity_at,
    doNotContact: Boolean(row.do_not_contact_at), handoverStatus: row.handover_status,
    campaignId: row.scout_campaign_id, createdAt: row.created_at, channels: channels.get(row.id) ?? [],
  }));
  const total = result.count ?? 0;
  return { rows, total, page: filters.page, pageSize: filters.pageSize,
    totalPages: Math.max(1, Math.ceil(total / filters.pageSize)), appliedFilters: filters };
}

export async function loadSalesScoutSummary(raw: Record<string,string|undefined>) {
  await authorizeSalesScout();
  const filters=parseQueueFilters(raw);
  const database = createAdminSupabaseClient();
  const statuses = ["new", "researching", "qualified", "disqualified", "do_not_contact"];
  const counts = await Promise.all([undefined, ...statuses].map(async (status) => {
    let query = database.from("marketing_prospects").select("id", { count: "exact", head: true }).not("scout_status", "is", null);
    if(filters.campaignId)query=query.eq("scout_campaign_id",filters.campaignId);
    if(filters.city)query=query.ilike("city",filters.city);if(filters.category)query=query.ilike("business_category",filters.category);if(filters.source)query=query.ilike("discovery_source",filters.source);if(filters.minimumScore!==undefined)query=query.gte("score",filters.minimumScore);if(filters.scoutStatus)query=query.eq("scout_status",filters.scoutStatus);if(filters.search){const safe=filters.search.replace(/[%_,()]/g," ");query=query.or(`business_name.ilike.%${safe}%,business_category.ilike.%${safe}%`);}
    if (status) query = query.eq("scout_status", status);
    return query;
  }));
  counts.forEach((result) => { if (result.error) fail("SCOUT_SUMMARY", result.error); });
  let scoreQuery = database.from("marketing_prospects").select("score").not("scout_status", "is", null).not("score", "is", null).limit(5000);
  if(filters.campaignId)scoreQuery=scoreQuery.eq("scout_campaign_id",filters.campaignId);if(filters.city)scoreQuery=scoreQuery.ilike("city",filters.city);if(filters.category)scoreQuery=scoreQuery.ilike("business_category",filters.category);if(filters.source)scoreQuery=scoreQuery.ilike("discovery_source",filters.source);if(filters.minimumScore!==undefined)scoreQuery=scoreQuery.gte("score",filters.minimumScore);if(filters.scoutStatus)scoreQuery=scoreQuery.eq("scout_status",filters.scoutStatus);if(filters.search){const safe=filters.search.replace(/[%_,()]/g," ");scoreQuery=scoreQuery.or(`business_name.ilike.%${safe}%,business_category.ilike.%${safe}%`);}
  const scores = await scoreQuery;
  if (scores.error) fail("SCOUT_SUMMARY_SCORE", scores.error);
  const values = (scores.data ?? []).map((row) => Number(row.score));
  return { total: counts[0].count ?? 0, new: counts[1].count ?? 0,
    researching: counts[2].count ?? 0, qualified: counts[3].count ?? 0,
    disqualified: counts[4].count ?? 0, doNotContact: counts[5].count ?? 0,
    averageScore: values.length ? Math.round(values.reduce((a, b) => a + b, 0) / values.length) : null };
}

export async function transitionSalesScoutReviewStatus(raw: unknown) {
  const actor = await authorizeSalesScout();
  const payload = reviewTransitionSchema.parse(raw);
  const { data, error } = await createAdminSupabaseClient().rpc("transition_sales_scout_review_status", { p_payload: payload, p_actor_id: actor.id });
  if (error) fail("SCOUT_STATUS_RPC", error);
  const row = data as Record<string, unknown>;
  return { changed: Boolean(row.changed), prospectId: String(row.prospect_id), previousStatus: String(row.previous_status), currentStatus: String(row.current_status), activityId: row.activity_id ? String(row.activity_id) : null };
}

export async function setSalesScoutDoNotContact(raw: unknown) {
  const actor = await authorizeSalesScout();
  const payload = doNotContactSchema.parse(raw);
  const { data, error } = await createAdminSupabaseClient().rpc("set_sales_scout_do_not_contact", {
    p_prospect_id: payload.prospectId, p_reason: payload.reason, p_source: payload.source, p_actor_id: actor.id,
  });
  if (error) fail("SCOUT_DNC_RPC", error);
  return { prospectId: payload.prospectId, suppressed: true, result: data ? "recorded" : "recorded" };
}

export async function updateSalesScoutCampaignStatus(raw: unknown) {
  await authorizeSalesScout();
  const payload = campaignStatusSchema.parse(raw);
  const database = createAdminSupabaseClient();
  const existing = await database.from("marketing_sales_scout_campaigns").select("campaign_id").eq("campaign_id", payload.campaignId).maybeSingle();
  if (existing.error) fail("SCOUT_CAMPAIGN_STATUS_LOOKUP", existing.error);
  if (!existing.data) throw new SalesScoutOperationError("SCOUT_CAMPAIGN_NOT_FOUND", "Sales Scout campaign not found.");
  const update = await database.from("marketing_sales_scout_campaigns")
    .update({ status: payload.status, updated_at: new Date().toISOString() })
    .eq("campaign_id", payload.campaignId).select("campaign_id,status").maybeSingle();
  if (update.error) fail("SCOUT_CAMPAIGN_STATUS", update.error);
  if (!update.data) throw new SalesScoutOperationError("SCOUT_CAMPAIGN_NOT_FOUND", "Sales Scout campaign not found.");
  return { campaignId: String(update.data.campaign_id), status: update.data.status as SalesScoutCampaignDto["status"] };
}

export async function loadSalesScoutProspectDetail(id: string) {
  await authorizeSalesScout();
  const database = createAdminSupabaseClient();
  const prospectResult = await database.from("marketing_prospects").select("id,business_name,business_category,stage,campaign_id,scout_campaign_id,scout_status,city,state,country,location_evidence,service_area_cities,discovery_source,discovery_source_id,source_url,discovered_at,profile_last_activity_at,has_recurring_produce_demand,recurring_demand_evidence,demand_band,appears_inactive_or_closed,is_consumer_only,score,score_version,score_factors,scored_at,do_not_contact_at,do_not_contact_reason,do_not_contact_source,handover_status,handover_ready_at,handover_accepted_at,handover_completed_at,handover_reason,created_at,updated_at").eq("id", id).maybeSingle();
  if (prospectResult.error) fail("SCOUT_DETAIL", prospectResult.error);
  const prospect = prospectResult.data;
  if (!prospect || !prospect.scout_status) throw new SalesScoutOperationError("SCOUT_DETAIL_NOT_FOUND", "Sales Scout prospect not found.");
  const [campaign, channels, activities, outreach] = await Promise.all([
    loadCampaign(database, prospect.scout_campaign_id),
    database.from("marketing_prospect_channels").select("id,platform,handle_or_value,profile_url,is_primary,is_active,verified_at,source,source_id,evidence,created_at").eq("prospect_id", id).order("is_primary", { ascending: false }),
    database.from("marketing_prospect_activities").select("id,activity_type,summary,occurred_at,metadata,created_at").eq("prospect_id", id).order("occurred_at", { ascending: false }).limit(100),
    database.from("marketing_prospect_outreaches").select("id", { count: "exact", head: true }).eq("prospect_id", id),
  ]);
  if (channels.error) fail("SCOUT_DETAIL_CHANNELS", channels.error);
  if (activities.error) fail("SCOUT_DETAIL_ACTIVITIES", activities.error);
  if (outreach.error) fail("SCOUT_DETAIL_OUTREACH", outreach.error);
  const score = scoreSalesScoutProspect({ campaignCity: campaign.city, campaignCountry: campaign.country,
    businessCategory: prospect.business_category ?? "", allowedCampaignCategories: campaign.targetCategories,
    businessCity: prospect.city, businessCountry: prospect.country, serviceAreaCities: prospect.service_area_cities ?? [],
    mostRecentPublicActivityAt: prospect.profile_last_activity_at,
    hasRecurringProduceDemandEvidence: Boolean(prospect.recurring_demand_evidence),
    publicContactRoutes: (channels.data ?? []).filter((row) => row.is_active).map((row) => row.platform),
    demandBand: prospect.demand_band ?? "unknown", isInactiveOrClosed: Boolean(prospect.appears_inactive_or_closed),
    isConsumerOnly: Boolean(prospect.is_consumer_only), doNotContact: Boolean(prospect.do_not_contact_at),
    scoredAt: prospect.scored_at ?? new Date().toISOString() });
  return { prospect, campaign, channels: channels.data ?? [], activities: activities.data ?? [], outreachCount: outreach.count ?? 0, qualification: score };
}
