import { lookup } from "node:dns/promises";
import { isIP } from "node:net";
import {
  canonicalizeWebsiteHostname,
  normalizeEmail,
  normalizeNigerianPhone,
  normalizeSocialIdentity,
  type SocialPlatform,
} from "../normalization.ts";
import type {
  ResearchCandidate,
  ResearchCategory,
  ResearchEvidence,
} from "./types.ts";
import { ResearchProviderError } from "./types.ts";

const USER_AGENT = "ShieldsFarmsSalesScoutResearch/1.0 (+https://shieldsfarms.store/contact)";
const MAX_PAGES = 5;
const MAX_REDIRECTS = 2;
const MAX_BYTES = 2 * 1024 * 1024;
const TIMEOUT_MS = 10_000;
const PACE_MS = 250;

const CATEGORY_SCHEMA_TYPES: Partial<Record<ResearchCategory, ReadonlySet<string>>> = {
  Restaurant: new Set(["Restaurant"]),
  Hotel: new Set(["Hotel", "LodgingBusiness"]),
  Supermarket: new Set(["GroceryStore"]),
  Caterer: new Set(["Caterer", "CateringBusiness"]),
  School: new Set(["School"]),
  Hospital: new Set(["Hospital"]),
};
const SUPPORTED_SCHEMA_TYPES = new Set([
  "Organization",
  "LocalBusiness",
  ...Object.values(CATEGORY_SCHEMA_TYPES).flatMap((types) => [...(types ?? [])]),
]);

export function normalizeIpLiteral(address: string) {
  const trimmed = address.trim().toLowerCase();
  const unbracketed = trimmed.startsWith("[") && trimmed.endsWith("]")
    ? trimmed.slice(1, -1)
    : trimmed;
  const dotted = unbracketed.match(/^::ffff:(\d{1,3}(?:\.\d{1,3}){3})$/i);
  if (dotted) return dotted[1];
  const hexadecimal = unbracketed.match(/^::ffff:([0-9a-f]{1,4}):([0-9a-f]{1,4})$/i);
  if (hexadecimal) {
    const value = Number.parseInt(hexadecimal[1], 16) * 65_536 +
      Number.parseInt(hexadecimal[2], 16);
    return [
      value >>> 24,
      (value >>> 16) & 255,
      (value >>> 8) & 255,
      value & 255,
    ].join(".");
  }
  return unbracketed;
}

export function isPrivateOrReservedIp(address: string) {
  const normalized = normalizeIpLiteral(address);
  const version = isIP(normalized);
  if (version === 4) {
    const [a, b, c] = normalized.split(".").map(Number);
    return a === 0 || a === 10 || a === 127 || a >= 224 ||
      (a === 100 && b >= 64 && b <= 127) ||
      (a === 169 && b === 254) ||
      (a === 172 && b >= 16 && b <= 31) ||
      (a === 192 && b === 0) ||
      (a === 192 && b === 168) ||
      (a === 192 && b === 88 && c === 99) ||
      (a === 198 && (b === 18 || b === 19)) ||
      (a === 198 && b === 51 && c === 100) ||
      (a === 203 && b === 0 && c === 113);
  }
  if (version === 6) {
    return normalized === "::" ||
      normalized === "::1" ||
      normalized.startsWith("fc") ||
      normalized.startsWith("fd") ||
      /^fe[89ab]/.test(normalized) ||
      normalized.startsWith("ff") ||
      normalized === "2001:db8" ||
      normalized.startsWith("2001:db8:");
  }
  return true;
}

export function validatePublicWebsiteUrl(input: string, resolvedAddresses: string[] = []) {
  let url: URL;
  try {
    url = new URL(input);
  } catch {
    throw new ResearchProviderError("WEBSITE_URL_INVALID");
  }
  if (!["http:", "https:"].includes(url.protocol) || url.username || url.password) {
    throw new ResearchProviderError("WEBSITE_URL_UNSAFE");
  }
  const host = normalizeIpLiteral(url.hostname);
  if (!host || host === "localhost" || host.endsWith(".localhost")) {
    throw new ResearchProviderError("WEBSITE_URL_UNSAFE");
  }
  if (
    (isIP(host) !== 0 && isPrivateOrReservedIp(host)) ||
    resolvedAddresses.some(isPrivateOrReservedIp)
  ) {
    throw new ResearchProviderError("WEBSITE_DESTINATION_PRIVATE");
  }
  return url;
}

export async function assertPublicDestination(input: string) {
  const url = validatePublicWebsiteUrl(input);
  let records: Array<{ address: string }>;
  try {
    records = await lookup(normalizeIpLiteral(url.hostname), { all: true, verbatim: true });
  } catch {
    throw new ResearchProviderError("WEBSITE_DNS_FAILED");
  }
  if (!records.length) throw new ResearchProviderError("WEBSITE_DNS_FAILED");
  validatePublicWebsiteUrl(url.href, records.map((item) => item.address));
  return url;
}

export function isPlausibleOfficialWebsite(input: string) {
  try {
    const url = validatePublicWebsiteUrl(input);
    return !/\/(?:login|signin|account|private)(?:\/|$)/i.test(url.pathname);
  } catch {
    return false;
  }
}

export function robotsAllows(robotsText: string, pathname: string, userAgent = USER_AGENT) {
  const groups: Array<{ agents: string[]; disallow: string[] }> = [];
  let current: { agents: string[]; disallow: string[] } | null = null;
  for (const raw of robotsText.split(/\r?\n/)) {
    const line = raw.replace(/#.*$/, "").trim();
    if (!line) continue;
    const separator = line.indexOf(":");
    if (separator < 0) continue;
    const name = line.slice(0, separator).trim().toLowerCase();
    const value = line.slice(separator + 1).trim();
    if (name === "user-agent") {
      if (!current || current.disallow.length) {
        current = { agents: [], disallow: [] };
        groups.push(current);
      }
      current.agents.push(value.toLowerCase());
    } else if (name === "disallow" && current && value) {
      current.disallow.push(value);
    }
  }
  const agent = userAgent.toLowerCase();
  return !groups
    .filter((group) => group.agents.some((value) => value === "*" || agent.includes(value)))
    .some((group) => group.disallow.some((value) => value === "/" || pathname.startsWith(value)));
}

export type ExtractedWebsiteFacts = {
  canonicalUrl: string | null;
  phoneNumbers: string[];
  emailAddresses: string[];
  whatsAppNumbers: string[];
  instagram: string[];
  facebook: string[];
  tiktok: string[];
  x: string[];
  youtube: string[];
  publicDescription: string | null;
  addresses: string[];
  country: string | null;
  state: string | null;
  city: string | null;
  schemaTypes: string[];
  evidence: ResearchEvidence[];
};

const unique = (values: string[]) => [...new Set(values.filter(Boolean))];

function attributes(html: string, name: string) {
  const regex = new RegExp(`\\b${name}\\s*=\\s*["']([^"']+)["']`, "gi");
  return [...html.matchAll(regex)].map((match) => match[1].trim());
}

function makeEvidence(
  sourceUrl: string,
  observedAt: string,
  field: string,
  value: string,
): ResearchEvidence {
  return {
    source: "official_website",
    sourceUrl,
    observedAt,
    field,
    value,
    confidence: "high",
    verificationStatus: "verified",
  };
}

function normalizeSchemaType(value: unknown) {
  if (typeof value !== "string" || !value.trim()) return null;
  const raw = value.trim().replace(/^https?:\/\/schema\.org\//i, "")
    .replace(/^schema:/i, "");
  return /^[A-Za-z][A-Za-z0-9]*$/.test(raw) ? raw : null;
}

function safeCanonicalUrl(value: string | null, sourceUrl: string) {
  try {
    const source = new URL(sourceUrl);
    const candidate = value ? new URL(value, source) : source;
    return ["http:", "https:"].includes(candidate.protocol) && candidate.origin === source.origin
      ? candidate.href
      : source.href;
  } catch {
    try {
      return new URL(sourceUrl).href;
    } catch {
      return null;
    }
  }
}

function normalizedSocialUrls(values: string[], platform: SocialPlatform) {
  const byIdentity = new Map<string, string>();
  for (const value of values) {
    const normalized = normalizeSocialIdentity(value, platform);
    if (normalized && !byIdentity.has(normalized.identity)) {
      byIdentity.set(normalized.identity, value);
    }
  }
  return [...byIdentity.values()];
}

export function extractWebsiteFacts(
  html: string,
  sourceUrl: string,
  observedAt: string,
): ExtractedWebsiteFacts {
  const hrefs = attributes(html, "href");
  const phoneNumbers = unique(hrefs
    .filter((href) => href.toLowerCase().startsWith("tel:"))
    .map((href) => normalizeNigerianPhone(
      decodeURIComponent(href.slice(4)).split(/[;,]/)[0].trim(),
    ))
    .filter((value): value is string => Boolean(value)));
  const emailAddresses = unique(hrefs
    .filter((href) => href.toLowerCase().startsWith("mailto:"))
    .map((href) => normalizeEmail(decodeURIComponent(href.slice(7)).split("?")[0].trim()))
    .filter((value): value is string => Boolean(value)));
  const whatsAppNumbers = unique(hrefs.flatMap((href) => {
    try {
      const url = new URL(href, sourceUrl);
      if (!["wa.me", "api.whatsapp.com"].includes(url.hostname.toLowerCase())) return [];
      const raw = url.hostname === "wa.me"
        ? url.pathname.slice(1)
        : url.searchParams.get("phone") ?? "";
      const normalized = normalizeNigerianPhone(raw);
      return normalized ? [normalized] : [];
    } catch {
      return [];
    }
  }));
  const social = {
    instagram: [] as string[],
    facebook: [] as string[],
    tiktok: [] as string[],
    x: [] as string[],
    youtube: [] as string[],
  };
  for (const href of hrefs) {
    const normalized = normalizeSocialIdentity(href);
    if (normalized) social[normalized.platform].push(href);
  }

  const canonicalTag = [...html.matchAll(
    /<link\b[^>]*rel=["'][^"']*canonical[^"']*["'][^>]*>/gi,
  )][0]?.[0];
  const canonicalValue = canonicalTag ? attributes(canonicalTag, "href")[0] ?? null : null;
  const canonicalUrl = safeCanonicalUrl(canonicalValue, sourceUrl);
  const metaTag = [...html.matchAll(
    /<meta\b[^>]*(?:name|property)=["'](?:description|og:description)["'][^>]*>/gi,
  )][0]?.[0];
  let publicDescription = metaTag ? attributes(metaTag, "content")[0] ?? null : null;
  const addresses: string[] = [];
  const schemaTypes: string[] = [];
  let country: string | null = null;
  let state: string | null = null;
  let city: string | null = null;
  for (const match of html.matchAll(
    /<script\b[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi,
  )) {
    try {
      const parsed = JSON.parse(match[1]) as unknown;
      for (const item of Array.isArray(parsed) ? parsed : [parsed]) {
        if (!item || typeof item !== "object") continue;
        const record = item as Record<string, unknown>;
        const types = Array.isArray(record["@type"]) ? record["@type"] : [record["@type"]];
        const normalizedTypes = types
          .map(normalizeSchemaType)
          .filter((type): type is string => Boolean(type));
        if (!normalizedTypes.some((type) => SUPPORTED_SCHEMA_TYPES.has(type))) continue;
        schemaTypes.push(
          ...normalizedTypes.filter((type) => SUPPORTED_SCHEMA_TYPES.has(type)),
        );
        if (typeof record.description === "string" && record.description.trim()) {
          publicDescription = record.description.trim();
        }
        if (typeof record.address === "string" && record.address.trim()) {
          addresses.push(record.address.trim());
        } else if (record.address && typeof record.address === "object") {
          const address = record.address as Record<string, unknown>;
          const stringPart = (key: string) =>
            typeof address[key] === "string" && address[key].trim()
              ? address[key].trim()
              : null;
          city ??= stringPart("addressLocality");
          state ??= stringPart("addressRegion");
          country ??= stringPart("addressCountry");
          const joined = ["streetAddress", "addressLocality", "addressRegion", "addressCountry"]
            .map(stringPart).filter((value): value is string => Boolean(value)).join(", ");
          if (joined) addresses.push(joined);
        }
      }
    } catch {
      continue;
    }
  }
  const facts = {
    canonicalUrl,
    phoneNumbers,
    emailAddresses,
    whatsAppNumbers,
    instagram: normalizedSocialUrls(social.instagram, "instagram"),
    facebook: normalizedSocialUrls(social.facebook, "facebook"),
    tiktok: normalizedSocialUrls(social.tiktok, "tiktok"),
    x: normalizedSocialUrls(social.x, "x"),
    youtube: normalizedSocialUrls(social.youtube, "youtube"),
    publicDescription,
    addresses: unique(addresses),
    schemaTypes: unique(schemaTypes),
    country,
    state,
    city,
  };
  const evidence: ResearchEvidence[] = [];
  for (const [field, values] of Object.entries({
    phone: facts.phoneNumbers,
    email: facts.emailAddresses,
    whatsapp: facts.whatsAppNumbers,
    instagram: facts.instagram,
    facebook: facts.facebook,
    tiktok: facts.tiktok,
    x: facts.x,
    youtube: facts.youtube,
    address: facts.addresses,
    schemaType: facts.schemaTypes,
  })) {
    for (const value of values) evidence.push(makeEvidence(sourceUrl, observedAt, field, value));
  }
  for (const [field, value] of [
    ["website", canonicalUrl],
    ["publicDescription", publicDescription],
    ["country", country],
    ["state", state],
    ["city", city],
  ] as const) {
    if (value) evidence.push(makeEvidence(sourceUrl, observedAt, field, value));
  }
  return { ...facts, evidence };
}

function normalizedUnique(
  existing: string[],
  incoming: string[],
  normalize: (value: string) => string | null,
) {
  const values = new Map<string, string>();
  for (const value of [...existing, ...incoming]) {
    const normalized = normalize(value);
    if (normalized && !values.has(normalized)) values.set(normalized, normalized);
  }
  return [...values.values()];
}

function mergeSocial(existing: string[], incoming: string[], platform: SocialPlatform) {
  const values = new Map<string, string>();
  for (const value of [...existing, ...incoming]) {
    const normalized = normalizeSocialIdentity(value, platform);
    if (normalized && !values.has(normalized.identity)) values.set(normalized.identity, value);
  }
  return [...values.values()];
}

export function mergeWebsiteFactsIntoCandidate(
  candidate: ResearchCandidate,
  facts: ExtractedWebsiteFacts,
  sourceUrl: string,
): ResearchCandidate {
  const conflicts: string[] = [];
  const website = facts.canonicalUrl ?? candidate.website;
  if (
    candidate.website && facts.canonicalUrl &&
    canonicalizeWebsiteHostname(candidate.website) !==
      canonicalizeWebsiteHostname(facts.canonicalUrl)
  ) {
    conflicts.push(`Conflicting website evidence retained: ${candidate.website} | ${facts.canonicalUrl}`);
  }
  const address = candidate.address ?? facts.addresses[0] ?? null;
  if (candidate.address && facts.addresses.length &&
      !facts.addresses.includes(candidate.address)) {
    conflicts.push("Conflicting address evidence retained from official website.");
  }
  if (
    candidate.publicDescription && facts.publicDescription &&
    candidate.publicDescription !== facts.publicDescription
  ) {
    conflicts.push("Conflicting public description retained from official website.");
  }
  const mergeLocation = (
    field: "country" | "state" | "city",
    current: string | null,
    incoming: string | null,
  ) => {
    if (current && incoming && current.toLowerCase() !== incoming.toLowerCase()) {
      conflicts.push(`Conflicting ${field} evidence retained from official website.`);
    }
    return current ?? incoming;
  };
  const supportedCategoryTypes = CATEGORY_SCHEMA_TYPES[candidate.requestedCategory];
  const schemaSupportsCategory = Boolean(
    supportedCategoryTypes &&
    facts.schemaTypes.some((type) => supportedCategoryTypes.has(type)),
  );
  const alreadyVerifiedCategory = candidate.evidence.some((item) =>
    item.field === "requestedCategory" &&
    item.value === candidate.requestedCategory &&
    item.verificationStatus === "verified"
  );
  const schemaEvidence = facts.evidence.find((item) => item.field === "schemaType");
  const categoryEvidence = schemaSupportsCategory && !alreadyVerifiedCategory
    ? [makeEvidence(
        sourceUrl,
        schemaEvidence?.observedAt ?? candidate.lastObservedAt,
        "requestedCategory",
        candidate.requestedCategory,
      )]
    : [];
  return {
    ...candidate,
    website,
    address,
    country: mergeLocation("country", candidate.country, facts.country),
    state: mergeLocation("state", candidate.state, facts.state),
    city: mergeLocation("city", candidate.city, facts.city),
    publicDescription: facts.publicDescription ?? candidate.publicDescription,
    phoneNumbers: normalizedUnique(
      candidate.phoneNumbers, facts.phoneNumbers, normalizeNigerianPhone,
    ),
    emailAddresses: normalizedUnique(
      candidate.emailAddresses, facts.emailAddresses, normalizeEmail,
    ),
    whatsAppNumbers: normalizedUnique(
      candidate.whatsAppNumbers, facts.whatsAppNumbers, normalizeNigerianPhone,
    ),
    instagram: mergeSocial(candidate.instagram, facts.instagram, "instagram"),
    facebook: mergeSocial(candidate.facebook, facts.facebook, "facebook"),
    tiktok: mergeSocial(candidate.tiktok, facts.tiktok, "tiktok"),
    x: mergeSocial(candidate.x, facts.x, "x"),
    youtube: mergeSocial(candidate.youtube, facts.youtube, "youtube"),
    evidence: [...candidate.evidence, ...facts.evidence, ...categoryEvidence],
    discoverySources: candidate.discoverySources.includes("official_website")
      ? candidate.discoverySources
      : [...candidate.discoverySources, "official_website"],
    researchIssues: [...new Set([...candidate.researchIssues, ...conflicts])],
    lastObservedAt: facts.evidence.reduce(
      (latest, item) => item.observedAt > latest ? item.observedAt : latest,
      candidate.lastObservedAt,
    ),
    sourceIdentities: {
      ...candidate.sourceIdentities,
      official_website: canonicalizeWebsiteHostname(website ?? sourceUrl) ?? sourceUrl,
    },
  };
}

export type WebsiteResearchPlanItem = {
  hostname: string;
  url: string;
  candidateIndexes: number[];
};

function hasOfficialWebsiteProviderField(candidate: ResearchCandidate) {
  return candidate.website != null && candidate.evidence.some((item) =>
    ["geoapify_places", "geoapify_place_details"].includes(item.source) &&
    item.field === "website" &&
    canonicalizeWebsiteHostname(item.value) ===
      canonicalizeWebsiteHostname(candidate.website ?? "")
  );
}

function hasPublicWebOfficialWebsiteEvidence(candidate: ResearchCandidate) {
  return candidate.website != null && candidate.evidence.some((item) =>
    item.source === "public_web_search" &&
    item.field === "website" &&
    item.verificationStatus !== "rejected" &&
    canonicalizeWebsiteHostname(item.value) ===
      canonicalizeWebsiteHostname(candidate.website ?? "")
  );
}

function hasTavilyLikelyOfficialWebsiteEvidence(candidate: ResearchCandidate) {
  return candidate.website != null && candidate.evidence.some((item) =>
    item.source === "tavily_search" &&
    item.field === "website" &&
    item.verificationStatus === "plausible" &&
    canonicalizeWebsiteHostname(item.value) ===
      canonicalizeWebsiteHostname(candidate.website ?? "")
  );
}

export function buildWebsiteResearchPlan(
  candidates: ResearchCandidate[],
  maxWebsites: number,
): WebsiteResearchPlanItem[] {
  const plan = new Map<string, WebsiteResearchPlanItem>();
  candidates.forEach((candidate, index) => {
    const eligible = hasOfficialWebsiteProviderField(candidate) ||
      hasTavilyLikelyOfficialWebsiteEvidence(candidate) ||
      hasPublicWebOfficialWebsiteEvidence(candidate);
    if (!eligible || !candidate.website || !isPlausibleOfficialWebsite(candidate.website)) return;
    const hostname = canonicalizeWebsiteHostname(candidate.website);
    if (!hostname) return;
    const existing = plan.get(hostname);
    if (existing) existing.candidateIndexes.push(index);
    else if (plan.size < maxWebsites) {
      plan.set(hostname, { hostname, url: candidate.website, candidateIndexes: [index] });
    }
  });
  return [...plan.values()];
}

type RobotsCache = Map<string, string>;

type ResearchDeadline = {
  deadlineAtMs?: number;
  now?: () => number;
  setTimeout?: (callback: () => void, milliseconds: number) => ReturnType<typeof setTimeout>;
  clearTimeout?: (timer: ReturnType<typeof setTimeout>) => void;
};

type TimedResponse = {
  response: Response;
  dispose: () => void;
  didAbort: () => boolean;
};

function isAbortError(error: unknown) {
  return error instanceof DOMException && error.name === "AbortError";
}

async function fetchResponse(
  url: URL,
  accept: string,
  deadline: ResearchDeadline = {},
): Promise<TimedResponse> {
  const now = deadline.now ?? Date.now;
  if (deadline.deadlineAtMs != null && now() >= deadline.deadlineAtMs) {
    throw new ResearchProviderError("WEBSITE_TIMEOUT");
  }
  const remaining = deadline.deadlineAtMs == null
    ? TIMEOUT_MS
    : deadline.deadlineAtMs - now();
  const controller = new AbortController();
  let timedOut = false;
  const schedule = deadline.setTimeout ?? setTimeout;
  const cancel = deadline.clearTimeout ?? clearTimeout;
  const timeout = schedule(() => {
    timedOut = true;
    controller.abort();
  }, Math.min(TIMEOUT_MS, remaining));
  const dispose = () => cancel(timeout);
  try {
    const response = await fetch(url, {
      redirect: "manual",
      signal: controller.signal,
      headers: {
        "User-Agent": USER_AGENT,
        Accept: accept,
      },
    });
    return {
      response,
      dispose,
      didAbort: () => timedOut || controller.signal.aborted,
    };
  } catch (error) {
    dispose();
    throw new ResearchProviderError(
      timedOut || controller.signal.aborted || isAbortError(error)
        ? "WEBSITE_TIMEOUT"
        : "WEBSITE_REQUEST_FAILED",
    );
  }
}

async function readBoundedBody(
  request: TimedResponse,
  oversizedReference: string,
) {
  const declared = Number(request.response.headers.get("content-length") ?? "0");
  if (declared > MAX_BYTES) throw new ResearchProviderError(oversizedReference);
  try {
    const bytes = new Uint8Array(await request.response.arrayBuffer());
    if (bytes.byteLength > MAX_BYTES) {
      throw new ResearchProviderError(oversizedReference);
    }
    return new TextDecoder().decode(bytes);
  } catch (error) {
    if (request.didAbort() || isAbortError(error)) {
      throw new ResearchProviderError("WEBSITE_TIMEOUT");
    }
    throw error;
  }
}

async function loadRobotsForOrigin(
  origin: string,
  robotsCache: RobotsCache,
  deadline: ResearchDeadline = {},
) {
  const cached = robotsCache.get(origin);
  if (cached !== undefined) return cached;
  try {
    const robotsUrl = await assertPublicDestination(
      new URL("/robots.txt", origin).href,
    );
    const request = await fetchResponse(robotsUrl, "text/plain", deadline);
    try {
      const response = request.response;
      if (response.status === 404 || response.status === 410) {
        robotsCache.set(origin, "");
        return "";
      }
      if (response.status !== 200) {
        throw new ResearchProviderError("WEBSITE_ROBOTS_UNAVAILABLE");
      }
      const contentType = response.headers.get("content-type")?.toLowerCase() ?? "";
      if (contentType && !contentType.startsWith("text/")) {
        throw new ResearchProviderError("WEBSITE_ROBOTS_UNAVAILABLE");
      }
      const text = await readBoundedBody(request, "WEBSITE_ROBOTS_UNAVAILABLE");
      robotsCache.set(origin, text);
      return text;
    } finally {
      request.dispose();
    }
  } catch (error) {
    if (
      error instanceof ResearchProviderError &&
      [
        "WEBSITE_DESTINATION_PRIVATE",
        "WEBSITE_URL_INVALID",
        "WEBSITE_URL_UNSAFE",
        "WEBSITE_TIMEOUT",
      ].includes(error.reference)
    ) {
      throw error;
    }
    throw new ResearchProviderError("WEBSITE_ROBOTS_UNAVAILABLE");
  }
}

async function assertRobotsAllowed(
  url: URL,
  robotsCache: RobotsCache,
  deadline: ResearchDeadline = {},
) {
  const robotsText = await loadRobotsForOrigin(url.origin, robotsCache, deadline);
  if (!robotsAllows(robotsText, url.pathname)) {
    throw new ResearchProviderError("WEBSITE_ROBOTS_DISALLOWED");
  }
}

async function safeFetch(
  input: string,
  robotsCache: RobotsCache,
  redirects = 0,
  deadline: ResearchDeadline = {},
): Promise<{ url: URL; body: string }> {
  const url = await assertPublicDestination(input);
  await assertRobotsAllowed(url, robotsCache, deadline);
  const request = await fetchResponse(
    url,
    "text/html,application/xhtml+xml",
    deadline,
  );
  try {
    const response = request.response;
    if (response.status >= 300 && response.status < 400) {
      if (redirects >= MAX_REDIRECTS) {
        throw new ResearchProviderError("WEBSITE_REDIRECT_LIMIT");
      }
      const location = response.headers.get("location");
      if (!location) throw new ResearchProviderError("WEBSITE_REDIRECT_INVALID");
      const target = await assertPublicDestination(new URL(location, url).href);
      await assertRobotsAllowed(target, robotsCache, deadline);
      return safeFetch(target.href, robotsCache, redirects + 1, deadline);
    }
    if (!response.ok) throw new ResearchProviderError("WEBSITE_REQUEST_FAILED");
    const contentType = response.headers.get("content-type")?.toLowerCase() ?? "";
    if (
      !contentType.includes("text/html") &&
      !contentType.includes("application/xhtml+xml")
    ) {
      throw new ResearchProviderError("WEBSITE_CONTENT_TYPE_UNSUPPORTED");
    }
    return {
      url,
      body: await readBoundedBody(request, "WEBSITE_RESPONSE_TOO_LARGE"),
    };
  } finally {
    request.dispose();
  }
}
function candidateLinks(html: string, base: URL, allowedOrigin: string) {
  const priorities = ["contact", "about", "location", "service", "menu"];
  return attributes(html, "href").flatMap((href) => {
    try {
      const url = new URL(href, base);
      return url.origin === allowedOrigin &&
        !/\/(?:login|signin|account|private)(?:\/|$)/i.test(url.pathname)
        ? [url] : [];
    } catch {
      return [];
    }
  }).sort((left, right) => {
    const a = priorities.findIndex((word) => left.pathname.toLowerCase().includes(word));
    const b = priorities.findIndex((word) => right.pathname.toLowerCase().includes(word));
    return (a < 0 ? 99 : a) - (b < 0 ? 99 : b);
  });
}

export async function researchOfficialWebsite(input: string, deadline: ResearchDeadline = {}) {
  if (typeof window !== "undefined") {
    throw new ResearchProviderError("WEBSITE_RESEARCH_SERVER_ONLY");
  }
  if (!isPlausibleOfficialWebsite(input)) {
    throw new ResearchProviderError("WEBSITE_NOT_PLAUSIBLY_OFFICIAL");
  }
  const robotsCache: RobotsCache = new Map();
  const first = await safeFetch(input, robotsCache, 0, deadline);
  const finalOrigin = first.url.origin;
  const queue: Array<{ url: URL; body: string | null }> = [{
    url: first.url,
    body: first.body,
  }];
  const visited = new Set<string>();
  const pages: Array<{ url: string; facts: ExtractedWebsiteFacts }> = [];
  while (queue.length && pages.length < MAX_PAGES &&
    (deadline.deadlineAtMs == null || (deadline.now ?? Date.now)() < deadline.deadlineAtMs)) {
    const next = queue.shift();
    if (!next || visited.has(next.url.href)) continue;
    visited.add(next.url.href);
    const page = next.body == null
      ? await safeFetch(next.url.href, robotsCache, 0, deadline)
      : { url: next.url, body: next.body };
    const observedAt = new Date().toISOString();
    pages.push({
      url: page.url.href,
      facts: extractWebsiteFacts(page.body, page.url.href, observedAt),
    });
    for (const link of candidateLinks(page.body, page.url, finalOrigin)) {
      if (!visited.has(link.href) && !queue.some((item) => item.url.href === link.href)) {
        queue.push({ url: link, body: null });
      }
    }
    if (queue.length && (deadline.deadlineAtMs == null ||
      (deadline.now ?? Date.now)() + PACE_MS < deadline.deadlineAtMs)) {
      await new Promise((resolve) => setTimeout(resolve, PACE_MS));
    }
  }
  return pages;
}

export const WEBSITE_RESEARCH_LIMITS = {
  maxPages: MAX_PAGES,
  maxRedirects: MAX_REDIRECTS,
  maxBytes: MAX_BYTES,
  timeoutMs: TIMEOUT_MS,
  paceMs: PACE_MS,
} as const;
