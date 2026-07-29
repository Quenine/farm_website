import type { ProspectPlatform } from "./domain.ts";

const socialHosts: Partial<Record<ProspectPlatform, readonly string[]>> = {
  instagram: ["instagram.com"],
  facebook: ["facebook.com", "fb.com"],
  tiktok: ["tiktok.com"],
  x: ["x.com", "twitter.com"],
  youtube: ["youtube.com", "youtu.be"],
};

const reservedPaths: Partial<Record<ProspectPlatform, ReadonlySet<string>>> = {
  instagram: new Set(["p", "reel", "reels", "stories", "explore", "accounts"]),
  facebook: new Set(["groups", "events", "marketplace", "watch", "share", "photo"]),
  tiktok: new Set(["video", "tag", "music", "discover"]),
  x: new Set(["home", "explore", "search", "i", "intent", "share"]),
  youtube: new Set(["watch", "shorts", "playlist", "results", "feed"]),
};

export type SocialPlatform = "instagram" | "facebook" | "tiktok" | "x" | "youtube";
export type NormalizedSocialIdentity = { platform: SocialPlatform; identity: string };

function cleanHostname(hostname: string) {
  return hostname.toLowerCase().replace(/^www\./, "").replace(/^m\./, "");
}

function platformForHost(hostname: string): SocialPlatform | null {
  const host = cleanHostname(hostname);
  return (Object.entries(socialHosts) as Array<[SocialPlatform, readonly string[]]>)
    .find(([, hosts]) => hosts.includes(host))?.[0] ?? null;
}

const validHandle = (value: string) => /^[a-z0-9._-]{1,100}$/i.test(value);

export function normalizeSocialIdentity(
  value: string,
  expectedPlatform?: SocialPlatform,
): NormalizedSocialIdentity | null {
  const input = value.trim();
  if (!input) return null;
  const looksLikeUrl = /^(?:https?:\/\/|www\.|m\.)/i.test(input);
  if (!looksLikeUrl) {
    if (!expectedPlatform) return null;
    const identity = input.replace(/^@+/, "").replace(/\/+$/, "").toLowerCase();
    return validHandle(identity) ? { platform: expectedPlatform, identity } : null;
  }

  try {
    const url = new URL(/^https?:\/\//i.test(input) ? input : `https://${input}`);
    const platform = platformForHost(url.hostname);
    if (!platform || (expectedPlatform && platform !== expectedPlatform)) return null;
    const parts = url.pathname.split("/").filter(Boolean);
    if (!parts.length) return null;

    let identity = parts[0];
    if (platform === "tiktok") {
      if (!identity.startsWith("@") || parts.length !== 1) return null;
    } else if (platform === "youtube") {
      if (parts.length !== 1 || !identity.startsWith("@")) return null;
    } else if (parts.length !== 1) {
      return null;
    }

    identity = identity.replace(/^@+/, "").toLowerCase();
    if (reservedPaths[platform]?.has(identity) || !validHandle(identity)) return null;
    return { platform, identity };
  } catch {
    return null;
  }
}

export function normalizeNigerianPhone(value: string): string | null {
  const input = value.trim();
  if (!input || /[a-z]/i.test(input) || /[^\d\s()+-]/.test(input)) return null;
  if ((input.match(/\+/g) ?? []).length > 1 || (input.includes("+") && !input.startsWith("+"))) {
    return null;
  }
  const digits = input.replace(/\D/g, "");
  let national: string;
  if (/^0[789]\d{9}$/.test(digits)) national = digits.slice(1);
  else if (/^[789]\d{9}$/.test(digits)) national = digits;
  else if (/^234[789]\d{9}$/.test(digits)) national = digits.slice(3);
  else return null;
  return `+234${national}`;
}

export function normalizeEmail(value: string): string | null {
  const email = value.trim().toLowerCase();
  if (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.includes("..")) {
    return null;
  }
  return email;
}

const socialHostSet = new Set(Object.values(socialHosts).flat());

export function canonicalizeWebsiteHostname(value: string): string | null {
  const input = value.trim();
  if (!input) return null;
  try {
    const url = new URL(/^[a-z][a-z\d+.-]*:\/\//i.test(input) ? input : `https://${input}`);
    if (!["http:", "https:"].includes(url.protocol) || url.username || url.password) return null;
    const hostname = url.hostname.toLowerCase().replace(/^www\./, "");
    if (!hostname || hostname === "localhost" || !hostname.includes(".") ||
        socialHostSet.has(hostname) || !/^[a-z\d.-]+$/.test(hostname)) return null;
    const port =
      (url.protocol === "http:" && url.port === "80") ||
      (url.protocol === "https:" && url.port === "443") ? "" : url.port;
    return port ? `${hostname}:${port}` : hostname;
  } catch {
    return null;
  }
}

const legalSuffixes = new Set(["ltd", "limited", "plc", "llc", "inc", "incorporated"]);

export function normalizeBusinessName(value: string): string {
  const words = value.normalize("NFKC").toLowerCase()
    .replace(/[\p{P}\p{S}]+/gu, " ").trim().split(/\s+/).filter(Boolean);
  while (words.length > 1 && legalSuffixes.has(words.at(-1)!)) words.pop();
  return words.join(" ");
}

export function normalizeLocationComparison(value: string): string {
  return value.normalize("NFKC").toLowerCase()
    .replace(/[\p{P}\p{S}]+/gu, " ").trim().replace(/\s+/g, " ");
}
