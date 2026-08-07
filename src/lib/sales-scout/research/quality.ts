import {
  canonicalizeWebsiteHostname,
  normalizeEmail,
  normalizeLocationComparison,
  normalizeNigerianPhone,
} from "../normalization.ts";
import type { ResearchCandidate, ResearchEvidence } from "./types.ts";

function verified(candidate: ResearchCandidate, field: string, value?: string) {
  return candidate.evidence.some((item) =>
    item.field === field &&
    item.verificationStatus === "verified" &&
    (value === undefined || item.value === value),
  );
}

function verifiedNormalized(
  candidate: ResearchCandidate,
  field: string,
  value: string | null,
  normalize: (input: string) => string | null,
) {
  const normalized = value ? normalize(value) : null;
  return Boolean(normalized && candidate.evidence.some((item) =>
    item.field === field &&
    item.verificationStatus === "verified" &&
    normalize(item.value) === normalized,
  ));
}

export function hasUsablePhone(candidate: ResearchCandidate) {
  return candidate.phoneNumbers.some((value) => normalizeNigerianPhone(value) !== null);
}
export function hasUsableEmail(candidate: ResearchCandidate) {
  return candidate.emailAddresses.some((value) => normalizeEmail(value) !== null);
}
export function hasUsableWhatsApp(candidate: ResearchCandidate) {
  return candidate.whatsAppNumbers.some((value) => normalizeNigerianPhone(value) !== null);
}
export function hasEvidenceBackedPhone(candidate: ResearchCandidate) {
  return candidate.phoneNumbers.some((value) =>
    verifiedNormalized(candidate, "phone", value, normalizeNigerianPhone));
}
export function hasEvidenceBackedEmail(candidate: ResearchCandidate) {
  return candidate.emailAddresses.some((value) =>
    verifiedNormalized(candidate, "email", value, normalizeEmail));
}
export function hasEvidenceBackedWhatsApp(candidate: ResearchCandidate) {
  return candidate.whatsAppNumbers.some((value) =>
    verifiedNormalized(candidate, "whatsapp", value, normalizeNigerianPhone));
}
export function hasOfficialWebsite(candidate: ResearchCandidate) {
  const hostname = candidate.website ? canonicalizeWebsiteHostname(candidate.website) : null;
  return Boolean(hostname && candidate.evidence.some((item) =>
    item.field === "website" &&
    item.verificationStatus === "verified" &&
    canonicalizeWebsiteHostname(item.value) === hostname,
  ));
}
export function hasPublicSocialProfile(candidate: ResearchCandidate) {
  const profiles = [
    ...candidate.instagram.map((value) => ["instagram", value] as const),
    ...candidate.facebook.map((value) => ["facebook", value] as const),
    ...candidate.tiktok.map((value) => ["tiktok", value] as const),
    ...candidate.x.map((value) => ["x", value] as const),
    ...candidate.youtube.map((value) => ["youtube", value] as const),
  ];
  return profiles.some(([field, value]) => verified(candidate, field, value));
}
export function hasAnyNormalizedPublicContact(candidate: ResearchCandidate) {
  return hasUsablePhone(candidate) || hasUsableEmail(candidate) ||
    hasUsableWhatsApp(candidate) || Boolean(candidate.website) ||
    candidate.instagram.length > 0 || candidate.facebook.length > 0 ||
    candidate.tiktok.length > 0 || candidate.x.length > 0 ||
    candidate.youtube.length > 0;
}
export function hasAnyUsableContact(candidate: ResearchCandidate) {
  return hasEvidenceBackedPhone(candidate) || hasEvidenceBackedEmail(candidate) ||
    hasEvidenceBackedWhatsApp(candidate) || hasOfficialWebsite(candidate) ||
    hasPublicSocialProfile(candidate);
}
export function isDiscovered(candidate: ResearchCandidate) {
  const categoryVerified = verified(candidate, "requestedCategory", candidate.requestedCategory);
  const territoryMatched = candidate.evidence.some((item) =>
    item.field === "territoryMatch" && item.value === "true" &&
    item.verificationStatus === "verified");
  const legacyVerifiedTerritory = Boolean(candidate.country && candidate.state && candidate.city &&
    verified(candidate, "country", candidate.country) && verified(candidate, "state", candidate.state) &&
    verified(candidate, "city", candidate.city));
  return Boolean(candidate.businessName.trim() && categoryVerified &&
    (territoryMatched && candidate.sourceIdentities.geoapify_places || legacyVerifiedTerritory));
}
export function isManualReviewReady(candidate: ResearchCandidate) {
  return isDiscovered(candidate) && hasAnyNormalizedPublicContact(candidate);
}
export function isResearchReady(candidate: ResearchCandidate) {
  const countrySupported = candidate.country != null &&
    ["ng", "nigeria"].includes(normalizeLocationComparison(candidate.country));
  return Boolean(
    candidate.businessName.trim() &&
    verified(candidate, "requestedCategory", candidate.requestedCategory) &&
    countrySupported && verified(candidate, "country", candidate.country ?? undefined) &&
    candidate.state && verified(candidate, "state", candidate.state) &&
    candidate.city && verified(candidate, "city", candidate.city) &&
    candidate.evidence.some((item) => Boolean(item.sourceUrl)),
  );
}
export function isOutreachReady(candidate: ResearchCandidate) {
  return isDiscovered(candidate) && hasAnyUsableContact(candidate);
}
export function contactCoverageScore(candidate: ResearchCandidate) {
  const checks = [
    hasEvidenceBackedPhone(candidate), hasEvidenceBackedEmail(candidate),
    hasEvidenceBackedWhatsApp(candidate), hasOfficialWebsite(candidate),
    hasPublicSocialProfile(candidate),
  ];
  return Math.round((checks.filter(Boolean).length / checks.length) * 100);
}
export function evidenceFor(evidence: ResearchEvidence[], field: string, value: string) {
  return evidence.filter((item) => item.field === field && item.value === value);
}
export type CandidateContactFilter =
  "has_phone" | "has_whatsapp" | "has_email" | "has_instagram" | "has_facebook" | "has_web_social";

export function isCandidateContactFilter(value: string | undefined): value is CandidateContactFilter {
  return ["has_phone", "has_whatsapp", "has_email", "has_instagram", "has_facebook", "has_web_social"].includes(value ?? "");
}

export function paginateContactEvidenceRows<T extends {
  contact_evidence: Array<{ route: string }>;
}>(
  rows: T[],
  filter: CandidateContactFilter,
  page: number,
  pageSize: number,
) {
  const allowed = filter === "has_web_social"
    ? new Set(["website", "instagram", "facebook", "tiktok", "x", "youtube"])
    : new Set([filter.replace("has_", "")]);
  const filtered = rows.filter((row) =>
    row.contact_evidence.some((contact) => allowed.has(contact.route)));
  const from = (Math.max(1, page) - 1) * pageSize;
  return { rows: filtered.slice(from, from + pageSize), count: filtered.length };
}
