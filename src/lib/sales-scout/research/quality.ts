import {
  canonicalizeWebsiteHostname,
  normalizeEmail,
  normalizeNigerianPhone,
} from "../normalization.ts";
import type { ResearchCandidate, ResearchEvidence } from "./types.ts";

function hasVerifiedEvidence(candidate: ResearchCandidate, fields: string[]) {
  return candidate.evidence.some(
    (item) => fields.includes(item.field) && item.verificationStatus === "verified",
  );
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

export function hasOfficialWebsite(candidate: ResearchCandidate) {
  return Boolean(candidate.website && canonicalizeWebsiteHostname(candidate.website));
}

export function hasPublicSocialProfile(candidate: ResearchCandidate) {
  return [candidate.instagram, candidate.facebook, candidate.tiktok, candidate.x, candidate.youtube]
    .some((profiles) => profiles.length > 0);
}

export function hasAnyUsableContact(candidate: ResearchCandidate) {
  return (
    hasUsablePhone(candidate) ||
    hasUsableEmail(candidate) ||
    hasUsableWhatsApp(candidate) ||
    hasOfficialWebsite(candidate) ||
    hasPublicSocialProfile(candidate)
  );
}

export function isResearchReady(candidate: ResearchCandidate) {
  const evidenceFields = new Set(candidate.evidence.map((item) => item.field));
  return Boolean(
    candidate.businessName.trim() &&
      candidate.state &&
      candidate.city &&
      evidenceFields.has("requestedCategory") &&
      candidate.evidence.some((item) => item.sourceUrl),
  );
}

export function isOutreachReady(candidate: ResearchCandidate) {
  const verifiedRoutes: Array<[boolean, string[]]> = [
    [hasUsablePhone(candidate), ["phone"]],
    [hasUsableEmail(candidate), ["email"]],
    [hasUsableWhatsApp(candidate), ["whatsapp"]],
    [hasOfficialWebsite(candidate), ["website"]],
    [hasPublicSocialProfile(candidate), ["instagram", "facebook", "tiktok", "x", "youtube"]],
  ];
  return verifiedRoutes.some(([usable, fields]) => usable && hasVerifiedEvidence(candidate, fields));
}

export function contactCoverageScore(candidate: ResearchCandidate) {
  const checks = [
    hasUsablePhone(candidate),
    hasUsableEmail(candidate),
    hasUsableWhatsApp(candidate),
    hasOfficialWebsite(candidate),
    hasPublicSocialProfile(candidate),
  ];
  return Math.round((checks.filter(Boolean).length / checks.length) * 100);
}

export function evidenceFor(
  evidence: ResearchEvidence[],
  field: string,
  value: string,
): ResearchEvidence[] {
  return evidence.filter((item) => item.field === field && item.value === value);
}
