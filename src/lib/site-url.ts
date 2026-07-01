import { siteConfig } from "@/src/config/site";

export type SiteUrlValidation =
  | { valid: true; siteUrl: string }
  | { valid: false; reason: string };

export function validateConfiguredSiteUrl(): SiteUrlValidation {
  const configuredUrl = siteConfig.url.trim();

  if (!configuredUrl) {
    return { valid: false, reason: "NEXT_PUBLIC_SITE_URL is missing." };
  }

  if (configuredUrl.includes('"') || configuredUrl.includes("'")) {
    return {
      valid: false,
      reason: "NEXT_PUBLIC_SITE_URL contains quote characters.",
    };
  }

  if (
    process.env.NODE_ENV === "production" &&
    !configuredUrl.startsWith("https://")
  ) {
    return {
      valid: false,
      reason: "NEXT_PUBLIC_SITE_URL must start with https:// in production.",
    };
  }

  try {
    const url = new URL(configuredUrl);
    if (url.protocol !== "http:" && url.protocol !== "https:") {
      return {
        valid: false,
        reason: "NEXT_PUBLIC_SITE_URL must use http:// or https://.",
      };
    }
    return { valid: true, siteUrl: url.origin };
  } catch {
    return {
      valid: false,
      reason: "NEXT_PUBLIC_SITE_URL is not a valid URL.",
    };
  }
}

export function getSiteUrl() {
  const validation = validateConfiguredSiteUrl();
  return validation.valid ? validation.siteUrl : siteConfig.url;
}

