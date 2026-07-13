const productionMissingMessage = "NEXT_PUBLIC_SITE_URL must be configured with the canonical URL for this deployment.";

export type SiteUrlSource = "environment" | "development_fallback";

export type SiteUrlValidation =
  | { valid: true; siteUrl: string; hostname: string; source: SiteUrlSource; domainEnv?: string; domainMismatch: boolean }
  | { valid: false; reason: string; source: "missing" | "invalid"; domainEnv?: string };

function cleanConfiguredUrl(value: string | undefined) {
  return value?.trim().replace(/\/+$/, "") ?? "";
}

function configuredDomainEnv() {
  return process.env.NEXT_PUBLIC_SITE_DOMAIN?.trim() || undefined;
}

export function validateConfiguredSiteUrl(): SiteUrlValidation {
  const configuredUrl = cleanConfiguredUrl(process.env.NEXT_PUBLIC_SITE_URL);
  const domainEnv = configuredDomainEnv();

  if (!configuredUrl) {
    if (process.env.NODE_ENV === "development") {
      const localUrl = "http://localhost:3000";
      return {
        valid: true,
        siteUrl: localUrl,
        hostname: "localhost",
        source: "development_fallback",
        domainEnv,
        domainMismatch: Boolean(domainEnv && domainEnv !== "localhost"),
      };
    }
    return { valid: false, reason: productionMissingMessage, source: "missing", domainEnv };
  }

  if (configuredUrl.includes('"') || configuredUrl.includes("'")) {
    return { valid: false, reason: "NEXT_PUBLIC_SITE_URL contains quote characters.", source: "invalid", domainEnv };
  }

  let url: URL;
  try {
    url = new URL(configuredUrl);
  } catch {
    return { valid: false, reason: "NEXT_PUBLIC_SITE_URL is not a valid URL.", source: "invalid", domainEnv };
  }

  if (url.protocol !== "http:" && url.protocol !== "https:") {
    return { valid: false, reason: "NEXT_PUBLIC_SITE_URL must use http:// or https://.", source: "invalid", domainEnv };
  }

  if (process.env.NODE_ENV === "production" && url.protocol !== "https:") {
    return { valid: false, reason: "NEXT_PUBLIC_SITE_URL must start with https:// in production.", source: "invalid", domainEnv };
  }

  return {
    valid: true,
    siteUrl: url.origin,
    hostname: url.hostname,
    source: "environment",
    domainEnv,
    domainMismatch: Boolean(domainEnv && domainEnv !== url.hostname),
  };
}

export function getSiteUrl() {
  const validation = validateConfiguredSiteUrl();
  if (!validation.valid) throw new Error(validation.reason);
  return validation.siteUrl;
}

export function getSiteHostname() {
  const validation = validateConfiguredSiteUrl();
  if (!validation.valid) throw new Error(validation.reason);
  return validation.hostname;
}

export function getSiteUrlSource() {
  const validation = validateConfiguredSiteUrl();
  if (!validation.valid) return validation.source;
  return validation.source;
}

export function assertValidSiteUrl() {
  const validation = validateConfiguredSiteUrl();
  if (!validation.valid) throw new Error(validation.reason);
  return validation;
}
