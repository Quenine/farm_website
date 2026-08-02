import {
  canonicalizeWebsiteHostname,
  normalizeBusinessName,
  normalizeLocationComparison,
  normalizeNigerianPhone,
} from "../normalization.ts";
import type { ResearchCandidate, ResearchEvidence, ResearchSource } from "./types.ts";

function firstSharedIdentity(left: ResearchCandidate, right: ResearchCandidate) {
  return Object.entries(left.sourceIdentities).some(
    ([source, identity]) => identity && right.sourceIdentities[source as ResearchSource] === identity,
  );
}

export function candidatesMatch(left: ResearchCandidate, right: ResearchCandidate) {
  if (firstSharedIdentity(left, right)) return true;
  const leftHost = left.website ? canonicalizeWebsiteHostname(left.website) : null;
  const rightHost = right.website ? canonicalizeWebsiteHostname(right.website) : null;
  if (leftHost && leftHost === rightHost) return true;

  const leftPhones = new Set(left.phoneNumbers.map(normalizeNigerianPhone).filter(Boolean));
  if (right.phoneNumbers.some((phone) => leftPhones.has(normalizeNigerianPhone(phone)))) return true;

  return (
    normalizeBusinessName(left.businessName) === normalizeBusinessName(right.businessName) &&
    Boolean(left.city && right.city) &&
    normalizeLocationComparison(left.city ?? "") === normalizeLocationComparison(right.city ?? "")
  );
}

function unique<T>(values: T[]) {
  return [...new Set(values)];
}

function mergeEvidence(left: ResearchEvidence[], right: ResearchEvidence[]) {
  const byKey = new Map<string, ResearchEvidence>();
  for (const item of [...left, ...right]) {
    const key = [item.source, item.sourceUrl, item.field, item.value, item.observedAt].join("|");
    byKey.set(key, item);
  }
  return [...byKey.values()];
}

function conflictIssues(left: ResearchCandidate, right: ResearchCandidate) {
  const issues: string[] = [];
  for (const [field, a, b] of [
    ["website", left.website, right.website],
    ["address", left.address, right.address],
    ["state", left.state, right.state],
    ["city", left.city, right.city],
  ] as const) {
    if (a && b && a !== b) issues.push(`Conflicting ${field} evidence retained: ${a} | ${b}`);
  }
  return issues;
}

export function mergeCandidates(left: ResearchCandidate, right: ResearchCandidate): ResearchCandidate {
  if (!candidatesMatch(left, right)) throw new Error("RESEARCH_CANDIDATES_DO_NOT_MATCH");
  return {
    ...left,
    sourceIdentities: { ...left.sourceIdentities, ...right.sourceIdentities },
    providerCategories: unique([...left.providerCategories, ...right.providerCategories]),
    phoneNumbers: unique([...left.phoneNumbers, ...right.phoneNumbers]),
    emailAddresses: unique([...left.emailAddresses, ...right.emailAddresses]),
    whatsAppNumbers: unique([...left.whatsAppNumbers, ...right.whatsAppNumbers]),
    instagram: unique([...left.instagram, ...right.instagram]),
    facebook: unique([...left.facebook, ...right.facebook]),
    tiktok: unique([...left.tiktok, ...right.tiktok]),
    x: unique([...left.x, ...right.x]),
    youtube: unique([...left.youtube, ...right.youtube]),
    evidence: mergeEvidence(left.evidence, right.evidence),
    discoverySources: unique([...left.discoverySources, ...right.discoverySources]),
    researchIssues: unique([
      ...left.researchIssues,
      ...right.researchIssues,
      ...conflictIssues(left, right),
    ]),
    website: left.website ?? right.website,
    address: left.address ?? right.address,
    state: left.state ?? right.state,
    city: left.city ?? right.city,
    country: left.country ?? right.country,
    latitude: left.latitude ?? right.latitude,
    longitude: left.longitude ?? right.longitude,
    publicDescription: left.publicDescription ?? right.publicDescription,
    firstObservedAt:
      left.firstObservedAt < right.firstObservedAt ? left.firstObservedAt : right.firstObservedAt,
    lastObservedAt:
      left.lastObservedAt > right.lastObservedAt ? left.lastObservedAt : right.lastObservedAt,
  };
}

export function deduplicateCandidates(candidates: ResearchCandidate[]) {
  const uniqueCandidates: ResearchCandidate[] = [];
  let duplicatesMerged = 0;
  for (const candidate of candidates) {
    const index = uniqueCandidates.findIndex((existing) => candidatesMatch(existing, candidate));
    if (index < 0) uniqueCandidates.push(candidate);
    else {
      uniqueCandidates[index] = mergeCandidates(uniqueCandidates[index], candidate);
      duplicatesMerged += 1;
    }
  }
  return { candidates: uniqueCandidates, duplicatesMerged };
}
