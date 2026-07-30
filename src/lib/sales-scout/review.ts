import { z } from "zod";

export const queueSorts = ["newest", "highest_score", "oldest_unreviewed"] as const;
export const campaignStatuses = ["draft", "active", "paused", "completed"] as const;
export const reviewStatuses = ["new", "researching", "qualified", "disqualified", "closed"] as const;
export const allScoutStatuses = ["new","researching","qualified","disqualified","engaged","converted","closed","do_not_contact"] as const;

export const queueFilterSchema = z.object({
  campaignId: z.uuid().optional(),
  search: z.string().trim().max(120).optional(),
  scoutStatus: z.enum(allScoutStatuses).optional(),
  city: z.string().trim().max(120).optional(),
  category: z.string().trim().max(120).optional(),
  source: z.string().trim().max(100).optional(),
  minimumScore: z.coerce.number().int().min(0).max(100).optional(),
  sort: z.enum(queueSorts).default("newest"),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(50).default(25),
}).strict();

export function parseQueueFilters(raw: Record<string, string | undefined>) {
  const cleaned = Object.fromEntries(Object.entries(raw).filter(([, value]) => value !== "" && value !== undefined));
  return queueFilterSchema.parse(cleaned);
}

export const reviewTransitionSchema = z.object({
  prospectId: z.uuid(),
  targetStatus: z.enum(reviewStatuses),
  reason: z.string().trim().max(1000).optional(),
}).strict().superRefine((value, context) => {
  if (["disqualified", "closed"].includes(value.targetStatus) && !value.reason) {
    context.addIssue({ code: "custom", path: ["reason"], message: "A reason is required." });
  }
});

export const campaignStatusSchema = z.object({
  campaignId: z.uuid(),
  status: z.enum(campaignStatuses),
}).strict();

export const doNotContactSchema = z.object({
  prospectId: z.uuid(),
  reason: z.string().trim().min(1).max(1000),
  source: z.string().trim().min(1).max(100),
}).strict();

const timelineLabels: Record<string, string> = {
  scout_captured: "Candidate captured",
  candidate_attached: "Candidate attached",
  scout_scored: "Qualification updated",
  scout_status_changed: "Review status changed",
  do_not_contact: "Marked do not contact",
  outreach_sent: "Outreach send recorded",
};
export function formatSalesScoutTimelineEvent(metadata: unknown) {
  if (!metadata || typeof metadata !== "object" || Array.isArray(metadata)) return "Sales Scout activity";
  const event = (metadata as Record<string, unknown>).event;
  return typeof event === "string" ? timelineLabels[event] ?? "Sales Scout activity" : "Sales Scout activity";
}

export function allowedResolutionChoices(input: {
  exactIds: readonly string[];
  softIds: readonly string[];
}) {
  if (input.exactIds.length) return input.exactIds.map((prospectId) => ({ choice: "attach_to_existing" as const, prospectId }));
  return [
    { choice: "create_new" as const },
    ...input.softIds.map((prospectId) => ({ choice: "attach_to_existing" as const, prospectId })),
  ];
}

export function formatLocalDateTimeInput(value: unknown) {
  if (!value) return "";
  const date=value instanceof Date?value:new Date(String(value));
  if (Number.isNaN(date.getTime())) return "";
  const pad=(value:number)=>String(value).padStart(2,"0");
  return `${date.getFullYear()}-${pad(date.getMonth()+1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}
export function mergeLocationEvidenceNote(existing: unknown, note: string) {
  const base=existing && typeof existing==="object" && !Array.isArray(existing) ? existing as Record<string,unknown> : {};
  return { ...base, note: note.trim() };
}
export function invalidatesPreview(previousSnapshot: string | null, nextCandidate: unknown) {
  return previousSnapshot !== JSON.stringify(nextCandidate);
}
export function oldestUnreviewedStatuses(sort: string) {
  return sort === "oldest_unreviewed" ? ["new","researching"] as const : null;
}

export type CaptureResolutionChoice =
  | { choice: "create_new" }
  | { choice: "attach_to_existing"; prospectId: string };

export function isCaptureResolutionAllowed(
  allowedChoices: readonly CaptureResolutionChoice[],
  resolution: CaptureResolutionChoice,
) {
  return resolution.choice === "create_new"
    ? allowedChoices.some((choice) => choice.choice === "create_new")
    : allowedChoices.some((choice) =>
        choice.choice === "attach_to_existing" && choice.prospectId === resolution.prospectId);
}

export function isLatestPreviewRequest(requestToken: number, currentToken: number) {
  return requestToken === currentToken;
}

export function formatMatchLabel(match: { businessName: string; city: string | null }) {
  return match.city ? `${match.businessName} - ${match.city}` : match.businessName;
}

export type CampaignStatus = (typeof campaignStatuses)[number];
export type CampaignActionContext = "queue" | "candidate_setup";

export function campaignStatusActions(status: CampaignStatus): CampaignStatus[] {
  if (status === "active") return ["paused", "completed"];
  if (status === "completed") return ["active"];
  return ["active", "completed"];
}

export function campaignActionLabel(
  target: CampaignStatus,
  current: CampaignStatus,
  context: CampaignActionContext = "queue",
) {
  if (target === "active") {
    if (context === "candidate_setup") return current === "completed" ? "Reactivate campaign" : "Activate and continue";
    return "Activate campaign";
  }
  return target === "paused" ? "Pause campaign" : "Complete campaign";
}

export function selectInitialCampaignId(
  campaigns: readonly { campaignId: string; status: CampaignStatus }[],
  requestedCampaignId?: string,
) {
  const active=campaigns.filter((campaign)=>campaign.status === "active");
  if (requestedCampaignId && active.some((campaign)=>campaign.campaignId === requestedCampaignId)) return requestedCampaignId;
  return active[0]?.campaignId ?? null;
}

export function deriveCandidateSetupState<T extends { campaignId: string; status: CampaignStatus }>(
  campaigns: readonly T[],
  requestedCampaignId?: string,
) {
  if (!campaigns.length) return { kind: "missing" as const, initialCampaignId: null, requestedCampaign: null };
  const requested=requestedCampaignId?campaigns.find((campaign)=>campaign.campaignId===requestedCampaignId)??null:null;
  if (requested && requested.status !== "active") return { kind: "setup" as const, initialCampaignId: null, requestedCampaign: requested };
  const initialCampaignId=selectInitialCampaignId(campaigns,requestedCampaignId);
  return initialCampaignId
    ? { kind: "ready" as const, initialCampaignId, requestedCampaign: requested }
    : { kind: "setup" as const, initialCampaignId: null, requestedCampaign: requested };
}

export function isCandidateEntryAvailable(status: CampaignStatus) {
  return status === "active";
}