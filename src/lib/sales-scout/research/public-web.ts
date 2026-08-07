import {
  canonicalizeWebsiteHostname,
  normalizeBusinessName,
  normalizeEmail,
  normalizeLocationComparison,
  normalizeNigerianPhone,
  normalizeSocialIdentity,
} from "../normalization.ts";
import { ResearchProviderError, type ResearchCandidate, type ResearchEvidence, type ResearchTerritory } from "./types.ts";

export const MAX_PUBLIC_WEB_SEARCHES_PER_CANDIDATE = 4;

export type PublicWebSearchResult = {
  position: number | null;
  title: string;
  link: string;
  snippet: string;
};

export type PublicWebSearchResponse = {
  provider: "serpapi";
  query: string;
  results: PublicWebSearchResult[];
  callReference: string;
};

export type PublicWebSearchProvider = (input: {
  query: string;
  territory: ResearchTerritory;
  deadlineAtMs: number;
  now: () => number;
}) => Promise<PublicWebSearchResponse>;

export type EntityMatch = {
  status: "verified" | "plausible" | "rejected";
  reasons: string[];
};

const unique = <T>(values: T[]) => [...new Set(values)];
const quoted = (value: string) => `"${value.replaceAll('"', " ").trim()}"`;

export function buildPublicWebResearchQueries(candidate: ResearchCandidate) {
  const location = [candidate.city ?? candidate.requestedTerritory.city,
    candidate.state ?? candidate.requestedTerritory.state].filter(Boolean).join(" ");
  const name = quoted(candidate.businessName);
  return [
    `${name} ${location}`,
    `site:instagram.com ${name} ${candidate.city ?? candidate.requestedTerritory.city}`,
    `site:facebook.com ${name} ${candidate.city ?? candidate.requestedTerritory.city}`,
    `${name} ${candidate.city ?? candidate.requestedTerritory.city} phone whatsapp contact`,
  ].slice(0, MAX_PUBLIC_WEB_SEARCHES_PER_CANDIDATE);
}

function normalizedText(result: PublicWebSearchResult) {
  return normalizeLocationComparison(`${result.title} ${result.snippet} ${result.link}`);
}

function knownPhoneMatch(candidate: ResearchCandidate, text: string) {
  const known = new Set(candidate.phoneNumbers.map(normalizeNigerianPhone).filter(Boolean));
  return extractPhones(text).some((phone) => known.has(normalizeNigerianPhone(phone)));
}

function knownDomainMatch(candidate: ResearchCandidate, link: string) {
  const known = candidate.website ? canonicalizeWebsiteHostname(candidate.website) : null;
  return Boolean(known && known === canonicalizeWebsiteHostname(link));
}

export function matchPublicWebResult(
  candidate: ResearchCandidate,
  result: PublicWebSearchResult,
): EntityMatch {
  const text = normalizedText(result);
  const normalizedName = normalizeBusinessName(candidate.businessName);
  const nameMatched = Boolean(normalizedName && text.includes(normalizedName));
  const city = normalizeLocationComparison(candidate.city ?? candidate.requestedTerritory.city);
  const state = normalizeLocationComparison(candidate.state ?? candidate.requestedTerritory.state);
  const cityMatched = Boolean(city && text.includes(city));
  const stateMatched = Boolean(state && text.includes(state));
  const phoneMatched = knownPhoneMatch(candidate, `${result.title} ${result.snippet}`);
  const domainMatched = knownDomainMatch(candidate, result.link);
  const categoryMatched = text.includes(normalizeLocationComparison(candidate.requestedCategory));
  const reasons = [
    nameMatched ? "normalized business name matches" : "business name is not corroborated",
    cityMatched ? "city matches" : stateMatched ? "state matches but city does not" : "territory is not corroborated",
    phoneMatched ? "known phone matches" : null,
    domainMatched ? "known domain matches" : null,
    categoryMatched ? "business category matches" : null,
  ].filter((value): value is string => Boolean(value));
  if (!nameMatched || (!cityMatched && !phoneMatched && !domainMatched)) {
    return { status: "rejected", reasons };
  }
  const corroborationCount = [cityMatched, phoneMatched, domainMatched, categoryMatched].filter(Boolean).length;
  return { status: corroborationCount >= 2 ? "verified" : "plausible", reasons };
}

function extractPhones(value: string) {
  return unique((value.match(/(?:\+?234|0)[\s()-]*[789](?:[\s()-]*\d){9}/g) ?? [])
    .map((phone) => normalizeNigerianPhone(phone)).filter((phone): phone is string => Boolean(phone)));
}

function extractEmails(value: string) {
  return unique((value.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi) ?? [])
    .map(normalizeEmail).filter((email): email is string => Boolean(email)));
}

function explicitWhatsAppNumbers(value: string) {
  const numbers: string[] = [];
  for (const match of value.matchAll(/(?:https?:\/\/)?(?:wa\.me\/|api\.whatsapp\.com\/send\?phone=)(\d{10,15})/gi)) {
    const normalized = normalizeNigerianPhone(match[1]);
    if (normalized) numbers.push(normalized);
  }
  return unique(numbers);
}

function evidence(
  result: PublicWebSearchResult,
  observedAt: string,
  field: string,
  value: string,
  match: EntityMatch,
): ResearchEvidence {
  return {
    source: "public_web_search",
    sourceUrl: result.link,
    observedAt,
    field,
    value,
    confidence: match.status === "verified" ? "high" : match.status === "plausible" ? "medium" : "low",
    verificationStatus: match.status,
  };
}

export function mergePublicWebResult(
  candidate: ResearchCandidate,
  result: PublicWebSearchResult,
  observedAt: string,
) {
  const match = matchPublicWebResult(candidate, result);
  const matchEvidence = evidence(result, observedAt, "entityMatch",
    `${match.status}: ${match.reasons.join("; ")}`, match);
  if (match.status === "rejected") {
    return {
      candidate: { ...candidate, evidence: [...candidate.evidence, matchEvidence] },
      match,
    };
  }

  const combined = `${result.title} ${result.snippet} ${result.link}`;
  const social = (["instagram", "facebook"] as const).flatMap((platform) => {
    const normalized = normalizeSocialIdentity(result.link, platform);
    return normalized ? [{ platform, url: result.link }] : [];
  });
  const phones = extractPhones(`${result.title} ${result.snippet}`);
  const emails = extractEmails(`${result.title} ${result.snippet}`);
  const whatsApp = explicitWhatsAppNumbers(combined);
  const socialLink = social.length > 0;
  const website = !socialLink && !/\b(?:wa\.me|whatsapp\.com|google\.|serpapi\.)/i.test(result.link)
    ? canonicalizeWebsiteHostname(result.link) ? result.link : null : null;
  const addedEvidence: ResearchEvidence[] = [matchEvidence];
  for (const phone of phones) addedEvidence.push(evidence(result, observedAt, "phone", phone, match));
  for (const email of emails) addedEvidence.push(evidence(result, observedAt, "email", email, match));
  for (const phone of whatsApp) addedEvidence.push(evidence(result, observedAt, "whatsapp", phone, match));
  for (const item of social) addedEvidence.push(evidence(result, observedAt, item.platform, item.url, match));
  if (website) addedEvidence.push(evidence(result, observedAt, "website", website, match));
  return {
    match,
    candidate: {
      ...candidate,
      website: candidate.website ?? website,
      phoneNumbers: unique([...candidate.phoneNumbers, ...phones]),
      emailAddresses: unique([...candidate.emailAddresses, ...emails]),
      whatsAppNumbers: unique([...candidate.whatsAppNumbers, ...whatsApp]),
      instagram: unique([...candidate.instagram, ...social.filter((item) => item.platform === "instagram").map((item) => item.url)]),
      facebook: unique([...candidate.facebook, ...social.filter((item) => item.platform === "facebook").map((item) => item.url)]),
      evidence: [...candidate.evidence, ...addedEvidence],
      discoverySources: unique([...candidate.discoverySources, "public_web_search" as const]),
      lastObservedAt: observedAt,
    },
  };
}

function hasUsefulRoute(candidate: ResearchCandidate) {
  return Boolean(candidate.phoneNumbers.length || candidate.emailAddresses.length ||
    candidate.whatsAppNumbers.length || candidate.website || candidate.instagram.length ||
    candidate.facebook.length);
}

export async function researchCandidateWithPublicWeb(
  seed: ResearchCandidate,
  search: PublicWebSearchProvider,
  deadline: { deadlineAtMs: number; now: () => number },
) {
  let candidate = seed;
  let actualCalls = 0;
  const callEvidence: ResearchEvidence[] = [];
  const failureReferences:string[]=[];
  if (hasUsefulRoute(candidate)) return { candidate, actualCalls, callEvidence, failureReferences };
  for (const query of buildPublicWebResearchQueries(seed)) {
    if (actualCalls >= MAX_PUBLIC_WEB_SEARCHES_PER_CANDIDATE || deadline.now() >= deadline.deadlineAtMs) break;
    actualCalls += 1;
    const observedAt = new Date(deadline.now()).toISOString();
    let response:PublicWebSearchResponse;
    try{response=await search({ query, territory: seed.requestedTerritory, ...deadline });}
    catch(error){const reference=error instanceof ResearchProviderError?error.reference:"PUBLIC_WEB_SEARCH_FAILED";failureReferences.push(reference);callEvidence.push({source:"public_web_search",sourceUrl:"https://serpapi.com/",observedAt,field:"providerCall",value:`serpapi:${actualCalls}:failed:${reference}`,confidence:"low",verificationStatus:"unavailable"});candidate={...candidate,researchIssues:unique([...candidate.researchIssues,reference])};break;}
    callEvidence.push({
      source: "public_web_search",
      sourceUrl: `https://serpapi.com/searches/${encodeURIComponent(response.callReference)}`,
      observedAt,
      field: "providerCall",
      value: `serpapi:${actualCalls}:${query}`,
      confidence: "high",
      verificationStatus: "verified",
    });
    for (const result of response.results) {
      candidate = mergePublicWebResult(candidate, result, observedAt).candidate;
    }
    if (hasUsefulRoute(candidate)) break;
  }
  return { candidate: { ...candidate, evidence: [...candidate.evidence, ...callEvidence] }, actualCalls, callEvidence, failureReferences };
}
