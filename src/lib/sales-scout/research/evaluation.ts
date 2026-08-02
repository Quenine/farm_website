import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import {
  canonicalizeWebsiteHostname,
  normalizeEmail,
  normalizeNigerianPhone,
  normalizeSocialIdentity,
} from "../normalization.ts";
import {
  hasAnyUsableContact,
  hasEvidenceBackedEmail,
  hasEvidenceBackedPhone,
  hasEvidenceBackedWhatsApp,
  hasOfficialWebsite,
  hasPublicSocialProfile,
  isOutreachReady,
  isResearchReady,
} from "./quality.ts";
import type { ResearchCandidate } from "./types.ts";

export type EvaluationMode = "synthetic_fixture" | "live";

export type EvaluationMetrics = {
  mode: EvaluationMode;
  queriesAttempted: number;
  providerSuccesses: number;
  providerFailures: number;
  totalRawResults: number;
  uniqueCandidates: number;
  duplicatesMerged: number;
  relevantCandidates: number;
  withPhone: number;
  withEmail: number;
  withWhatsApp: number;
  withOfficialWebsite: number;
  withSocialProfile: number;
  withAnyUsableContact: number;
  outreachReady: number;
  evidenceCoveragePercent: number;
  estimatedProviderCredits: number;
  failureReferences: string[];
  byStateCityCategory: Record<string, number>;
  contributionBySource: Record<string, number>;
};

type MetricContext = Pick<EvaluationMetrics,
  "mode" | "queriesAttempted" | "providerSuccesses" | "providerFailures" |
  "totalRawResults" | "duplicatesMerged" | "estimatedProviderCredits" |
  "failureReferences">;

function sameEvidenceValue(field: string, left: string, right: string) {
  if (field === "phone" || field === "whatsapp") {
    const a = normalizeNigerianPhone(left);
    const b = normalizeNigerianPhone(right);
    return Boolean(a && a === b);
  }
  if (field === "email") {
    const a = normalizeEmail(left);
    const b = normalizeEmail(right);
    return Boolean(a && a === b);
  }
  if (field === "website") {
    const a = canonicalizeWebsiteHostname(left);
    const b = canonicalizeWebsiteHostname(right);
    return Boolean(a && a === b);
  }
  if (["instagram", "facebook", "tiktok", "x", "youtube"].includes(field)) {
    const a = normalizeSocialIdentity(left);
    const b = normalizeSocialIdentity(right);
    return Boolean(a && b && a.platform === b.platform && a.identity === b.identity);
  }
  return left === right;
}

function candidateContactValues(candidate: ResearchCandidate) {
  return [
    ...candidate.phoneNumbers.map((value) => ["phone", value] as const),
    ...candidate.emailAddresses.map((value) => ["email", value] as const),
    ...candidate.whatsAppNumbers.map((value) => ["whatsapp", value] as const),
    ...(candidate.website ? [["website", candidate.website] as const] : []),
    ...candidate.instagram.map((value) => ["instagram", value] as const),
    ...candidate.facebook.map((value) => ["facebook", value] as const),
    ...candidate.tiktok.map((value) => ["tiktok", value] as const),
    ...candidate.x.map((value) => ["x", value] as const),
    ...candidate.youtube.map((value) => ["youtube", value] as const),
  ];
}

export function computeEvaluationMetrics(
  candidates: ResearchCandidate[],
  context: MetricContext,
): EvaluationMetrics {
  const byStateCityCategory: Record<string, number> = {};
  const contributionBySource: Record<string, number> = {};
  let contactCount = 0;
  let backedContactCount = 0;
  for (const candidate of candidates) {
    const key = [
      candidate.state ?? "Unknown",
      candidate.city ?? "Unknown",
      candidate.requestedCategory,
    ].join(" / ");
    byStateCityCategory[key] = (byStateCityCategory[key] ?? 0) + 1;
    for (const source of candidate.discoverySources) {
      contributionBySource[source] = (contributionBySource[source] ?? 0) + 1;
    }
    for (const [field, value] of candidateContactValues(candidate)) {
      contactCount += 1;
      if (candidate.evidence.some((item) =>
        item.field === field &&
        item.verificationStatus === "verified" &&
        sameEvidenceValue(field, item.value, value)
      )) backedContactCount += 1;
    }
  }
  return {
    ...context,
    uniqueCandidates: candidates.length,
    relevantCandidates: candidates.filter(isResearchReady).length,
    withPhone: candidates.filter(hasEvidenceBackedPhone).length,
    withEmail: candidates.filter(hasEvidenceBackedEmail).length,
    withWhatsApp: candidates.filter(hasEvidenceBackedWhatsApp).length,
    withOfficialWebsite: candidates.filter(hasOfficialWebsite).length,
    withSocialProfile: candidates.filter(hasPublicSocialProfile).length,
    withAnyUsableContact: candidates.filter(hasAnyUsableContact).length,
    outreachReady: candidates.filter(isOutreachReady).length,
    evidenceCoveragePercent: contactCount
      ? Math.round((backedContactCount / contactCount) * 100)
      : 100,
    byStateCityCategory,
    contributionBySource,
  };
}

export function csvEscape(value: unknown) {
  const text = Array.isArray(value) ? value.join(" | ") : String(value ?? "");
  return /[",\r\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

export function candidatesToCsv(candidates: ResearchCandidate[]) {
  const headers = [
    "business name", "category", "state", "city", "phone", "email", "WhatsApp",
    "website", "Instagram", "Facebook", "TikTok", "X", "YouTube", "source count",
    "evidence count", "research issues", "outreach-ready", "discovery sources",
  ];
  const rows = candidates.map((candidate) => [
    candidate.businessName,
    candidate.requestedCategory,
    candidate.state,
    candidate.city,
    candidate.phoneNumbers,
    candidate.emailAddresses,
    candidate.whatsAppNumbers,
    candidate.website,
    candidate.instagram,
    candidate.facebook,
    candidate.tiktok,
    candidate.x,
    candidate.youtube,
    candidate.discoverySources.length,
    candidate.evidence.length,
    candidate.researchIssues,
    isOutreachReady(candidate),
    candidate.discoverySources,
  ]);
  return [headers, ...rows]
    .map((row) => row.map(csvEscape).join(","))
    .join("\n") + "\n";
}

export function metricsToMarkdown(metrics: EvaluationMetrics) {
  const fixtureWarning = metrics.mode === "synthetic_fixture"
    ? [
        "> These numbers validate pipeline behaviour only.",
        "> They do not measure real Nigerian provider coverage.",
        "",
      ]
    : [];
  const lines = [
    "# Sales Scout research evaluation",
    "",
    `- Mode: ${metrics.mode === "synthetic_fixture" ? "synthetic fixture" : "live"}`,
    "",
    ...fixtureWarning,
    `- Queries attempted: ${metrics.queriesAttempted}`,
    `- Provider successes/failures: ${metrics.providerSuccesses}/${metrics.providerFailures}`,
    `- Total raw results: ${metrics.totalRawResults}`,
    `- Unique candidates: ${metrics.uniqueCandidates}`,
    `- Duplicates merged: ${metrics.duplicatesMerged}`,
    `- Relevant candidates: ${metrics.relevantCandidates}`,
    `- Candidates with phone: ${metrics.withPhone}`,
    `- Candidates with email: ${metrics.withEmail}`,
    `- Candidates with WhatsApp: ${metrics.withWhatsApp}`,
    `- Candidates with official website: ${metrics.withOfficialWebsite}`,
    `- Candidates with social profile: ${metrics.withSocialProfile}`,
    `- Candidates with any usable contact: ${metrics.withAnyUsableContact}`,
    `- Outreach-ready: ${metrics.outreachReady}`,
    `- Evidence coverage: ${metrics.evidenceCoveragePercent}%`,
    `- Estimated provider credits consumed: ${metrics.estimatedProviderCredits}`,
    `- Failure references: ${metrics.failureReferences.join(", ") || "None"}`,
    "",
    "## Results by state / city / category",
    ...Object.entries(metrics.byStateCityCategory)
      .sort().map(([key, value]) => `- ${key}: ${value}`),
    "",
    "## Contribution by source",
    ...Object.entries(metrics.contributionBySource)
      .sort().map(([key, value]) => `- ${key}: ${value}`),
  ];
  return lines.join("\n") + "\n";
}

export async function writeEvaluationOutputs(
  outputDir: string,
  candidates: ResearchCandidate[],
  metrics: EvaluationMetrics,
) {
  await mkdir(outputDir, { recursive: true });
  await Promise.all([
    writeFile(
      path.join(outputDir, "candidates.json"),
      JSON.stringify(candidates, null, 2) + "\n",
      "utf8",
    ),
    writeFile(path.join(outputDir, "candidates.csv"), candidatesToCsv(candidates), "utf8"),
    writeFile(path.join(outputDir, "summary.md"), metricsToMarkdown(metrics), "utf8"),
  ]);
}
