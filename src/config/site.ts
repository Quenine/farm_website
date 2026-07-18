import { envFlag } from "@/src/lib/content-features";
import {
  assertValidSiteUrl,
  getSiteHostname,
  getSiteUrl,
  validateConfiguredSiteUrl,
} from "@/src/lib/site-url";

function publicEnv(name: string, fallback: string) {
  const value = process.env[name]?.trim();
  return value || fallback;
}

function publicBool(name: string, fallback: boolean) {
  const value = process.env[name];
  if (value === undefined || value.trim() === "") return fallback;
  return envFlag(value);
}

function phoneDigits(value: string) {
  return value.replace(/\D/g, "");
}

const canonicalSite = assertValidSiteUrl();
const deploymentName = canonicalSite.hostname.includes("shields")
  ? "Shields Farms"
  : canonicalSite.hostname.includes("noble")
    ? "Noble Farms"
    : "Farm Commerce";

export const siteConfig = {
  name: publicEnv("NEXT_PUBLIC_SITE_NAME", deploymentName),
  url: canonicalSite.siteUrl,
  domain: canonicalSite.hostname,
  configuredDomain: canonicalSite.domainEnv ?? "",
  domainEnvMismatch: canonicalSite.domainMismatch,
  urlSource: canonicalSite.source,
  tagline: publicEnv("NEXT_PUBLIC_SITE_TAGLINE", "Fresh farm produce"),
  description: publicEnv(
    "NEXT_PUBLIC_SITE_DESCRIPTION",
    "Order fresh farm produce with secure checkout, order tracking, and reliable fulfilment.",
  ),
  address: publicEnv("NEXT_PUBLIC_BUSINESS_ADDRESS", ""),
  phone: publicEnv("NEXT_PUBLIC_BUSINESS_PHONE", ""),
  email: publicEnv("NEXT_PUBLIC_BUSINESS_EMAIL", ""),
  supportEmail: publicEnv("NEXT_PUBLIC_SUPPORT_EMAIL", publicEnv("NEXT_PUBLIC_BUSINESS_EMAIL", "")),
  ordersEmail: publicEnv("NEXT_PUBLIC_ORDERS_EMAIL", publicEnv("NEXT_PUBLIC_BUSINESS_EMAIL", "")),
  whatsappPhone: publicEnv("NEXT_PUBLIC_WHATSAPP_PHONE", publicEnv("NEXT_PUBLIC_BUSINESS_PHONE", "")),
  logoPath: publicEnv("NEXT_PUBLIC_LOGO_PATH", "/images/noble-farms-logo.png"),
};

export const marketingConfig = {
  enabled: publicBool("NEXT_PUBLIC_MARKETING_ENABLED", false),
  gaMeasurementId: publicEnv("NEXT_PUBLIC_GA_MEASUREMENT_ID", ""),
  googleTagId: publicEnv("NEXT_PUBLIC_GOOGLE_TAG_ID", ""),
  gtmContainerId: publicEnv("NEXT_PUBLIC_GTM_CONTAINER_ID", ""),
  metaPixelId: publicEnv("NEXT_PUBLIC_META_PIXEL_ID", ""),
  primaryRegion: publicEnv("NEXT_PUBLIC_MARKETING_PRIMARY_REGION", ""),
  businessSupplyEnabled: publicBool("NEXT_PUBLIC_BUSINESS_SUPPLY_ENABLED", true),
};

export const operationalFeatures = {
  pwaEnabled: publicBool("NEXT_PUBLIC_PWA_ENABLED", false),
  webPushEnabled: publicBool("NEXT_PUBLIC_WEB_PUSH_ENABLED", false),
  vapidPublicKey: publicEnv("NEXT_PUBLIC_VAPID_PUBLIC_KEY", ""),
};

export const contentPublicConfig = {
  hubEnabled: publicBool("NEXT_PUBLIC_CONTENT_HUB_ENABLED", false),
  affiliateEnabled: publicBool("NEXT_PUBLIC_AFFILIATE_CONTENT_ENABLED", false),
  toolsEnabled: publicBool("NEXT_PUBLIC_CONTENT_TOOLS_ENABLED", false),
  subscriptionsEnabled: publicBool("NEXT_PUBLIC_CONTENT_SUBSCRIPTIONS_ENABLED", false),
  primaryMarket: publicEnv("NEXT_PUBLIC_CONTENT_PRIMARY_MARKET", "Nigeria and Africa"),
  secondaryMarket: publicEnv("NEXT_PUBLIC_CONTENT_SECONDARY_MARKET", "Global"),
};

export const siteContact = {
  phoneHref: `tel:${siteConfig.phone}`,
  emailHref: `mailto:${siteConfig.email}`,
  supportEmailHref: `mailto:${siteConfig.supportEmail}`,
  ordersEmailHref: `mailto:${siteConfig.ordersEmail}`,
  whatsappHref: `https://wa.me/${phoneDigits(siteConfig.whatsappPhone)}`,
  trackOrderUrl: `${getSiteUrl().replace(/\/$/, "")}/track-order`,
};

export const siteUrlDiagnostics = validateConfiguredSiteUrl;
export const siteHostname = getSiteHostname;

export function whatsappUrl(message: string) {
  return `${siteContact.whatsappHref}?text=${encodeURIComponent(message)}`;
}

