import { z } from "zod";
import { prospectPlatforms } from "./domain.ts";
import { demandBands } from "./scoring.ts";
import {
  canonicalizeWebsiteHostname,
  normalizeEmail,
  normalizeNigerianPhone,
  normalizeSocialIdentity,
} from "./normalization.ts";

const trimmed = (maximum: number) => z.string().trim().min(1).max(maximum);
const optionalTrimmed = (maximum: number) =>
  z.string().trim().min(1).max(maximum).optional();
const publicUrl = z.url().max(2048).refine((value) => {
  try {
    const url = new URL(value);
    const host = url.hostname.toLowerCase();
    return (
      ["http:", "https:"].includes(url.protocol) &&
      !url.username &&
      !url.password &&
      host !== "localhost" &&
      host !== "127.0.0.1" &&
      host !== "::1"
    );
  } catch {
    return false;
  }
}, "A public HTTP(S) URL is required.");
const timestamp = z.iso.datetime({ offset: true });
export const recurringDemandEvidenceMessage = "Describe what the public source proves. A link by itself is not sufficient evidence.";
export function validateRecurringDemandEvidence(value: string | null | undefined) {
  const normalized = value?.replace(/\s+/g, " ").trim() ?? "";
  if (!normalized) return true;
  const descriptive = normalized.replace(/https?:\/\/\S+/gi, "").replace(/\s+/g, " ").trim();
  return descriptive.replace(/[^\p{L}\p{N}]+/gu, "").length >= 20;
}
export const recurringDemandEvidenceSchema = z.string().trim().max(2000).refine(
  validateRecurringDemandEvidence,
  recurringDemandEvidenceMessage,
);

export const discoveryChannelSchema = z.object({
  platform: z.enum(prospectPlatforms),
  handleOrValue: trimmed(500),
  profileUrl: publicUrl.optional(),
  isPrimary: z.boolean().optional().default(false),
  sourceId: optionalTrimmed(300),
  evidence: z.record(z.string(), z.unknown()),
}).strict().superRefine((channel, context) => {
  let usable = true;
  if (["instagram", "facebook", "tiktok", "x", "youtube"].includes(channel.platform)) {
    usable = Boolean(normalizeSocialIdentity(
      channel.profileUrl ?? channel.handleOrValue,
      channel.platform as "instagram" | "facebook" | "tiktok" | "x" | "youtube",
    ));
  } else if (channel.platform === "phone" || channel.platform === "whatsapp") {
    usable = Boolean(normalizeNigerianPhone(channel.handleOrValue));
  } else if (channel.platform === "email") {
    usable = Boolean(normalizeEmail(channel.handleOrValue));
  } else if (channel.platform === "website") {
    usable = Boolean(canonicalizeWebsiteHostname(channel.profileUrl ?? channel.handleOrValue));
  }
  if (!usable) {
    context.addIssue({ code: "custom", message: "Channel value does not match its platform." });
  }
});

export const discoveryCandidateSchema = z.object({
  provider: trimmed(100),
  providerSourceId: optionalTrimmed(300),
  sourceUrl: publicUrl,
  observedAt: timestamp,
  campaignId: z.uuid(),
  businessName: trimmed(200),
  businessCategory: trimmed(120),
  city: trimmed(120),
  state: optionalTrimmed(120),
  country: trimmed(120),
  publicDescription: optionalTrimmed(2000),
  serviceAreaCities: z.array(trimmed(120)).max(100).default([]),
  mostRecentPublicActivityAt: timestamp.optional(),
  recurringProduceDemandEvidence: recurringDemandEvidenceSchema.optional(),
  demandBand: z.enum(demandBands),
  isInactiveOrClosed: z.boolean(),
  isConsumerOnly: z.boolean(),
  channels: z.array(discoveryChannelSchema).min(1).max(50),
}).strict();

export const manualCandidateInputSchema = discoveryCandidateSchema
  .omit({ provider: true })
  .strict();

export const duplicateResolutionSchema = z.discriminatedUnion("choice", [
  z.object({ choice: z.literal("create_new") }).strict(),
  z.object({
    choice: z.literal("attach_to_existing"),
    prospectId: z.uuid(),
  }).strict(),
]);

export const qualificationFactsSchema = z.object({
  prospectId: z.uuid(),
  campaignId: z.uuid(),
  businessCategory: trimmed(120),
  city: trimmed(120),
  state: optionalTrimmed(120).nullable(),
  country: trimmed(120),
  serviceAreaCities: z.array(trimmed(120)).max(100),
  mostRecentPublicActivityAt: timestamp.optional().nullable(),
  recurringProduceDemandEvidence: recurringDemandEvidenceSchema.nullable().optional(),
  demandBand: z.enum(demandBands),
  isInactiveOrClosed: z.boolean(),
  isConsumerOnly: z.boolean(),
  sourceUrl: publicUrl,
  locationEvidence: z.record(z.string(), z.unknown()),
}).strict();
