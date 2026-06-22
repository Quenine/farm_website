const PRODUCTION_SITE_URL = "https://noblefarms.xyz";

export function getSiteUrl() {
  const configuredUrl =
    process.env.NEXT_PUBLIC_SITE_URL?.trim() || PRODUCTION_SITE_URL;

  try {
    const url = new URL(configuredUrl);

    if (url.protocol !== "http:" && url.protocol !== "https:") {
      return PRODUCTION_SITE_URL;
    }

    return url.origin;
  } catch {
    return PRODUCTION_SITE_URL;
  }
}
