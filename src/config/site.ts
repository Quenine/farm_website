import { envFlag } from "@/src/lib/content-features";
import {
  assertValidSiteUrl,
  getSiteHostname,
  getSiteUrl,
  validateConfiguredSiteUrl,
} from "@/src/lib/site-url";

function publicEnv(value: string | undefined, fallback: string) {
  value = value?.trim();
  return value || fallback;
}

function publicBool(value: string | undefined, fallback: boolean) {
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
  name: publicEnv(process.env.NEXT_PUBLIC_SITE_NAME, deploymentName),
  url: canonicalSite.siteUrl,
  domain: canonicalSite.hostname,
  configuredDomain: canonicalSite.domainEnv ?? "",
  domainEnvMismatch: canonicalSite.domainMismatch,
  urlSource: canonicalSite.source,
  tagline: publicEnv(process.env.NEXT_PUBLIC_SITE_TAGLINE, "Fresh farm produce"),
  description: publicEnv(
    process.env.NEXT_PUBLIC_SITE_DESCRIPTION,
    "Order fresh farm produce with secure checkout, order tracking, and reliable fulfilment.",
  ),
  address: publicEnv(process.env.NEXT_PUBLIC_BUSINESS_ADDRESS, ""),
  phone: publicEnv(process.env.NEXT_PUBLIC_BUSINESS_PHONE, ""),
  email: publicEnv(process.env.NEXT_PUBLIC_BUSINESS_EMAIL, ""),
  supportEmail: publicEnv(process.env.NEXT_PUBLIC_SUPPORT_EMAIL, publicEnv(process.env.NEXT_PUBLIC_BUSINESS_EMAIL, "")),
  ordersEmail: publicEnv(process.env.NEXT_PUBLIC_ORDERS_EMAIL, publicEnv(process.env.NEXT_PUBLIC_BUSINESS_EMAIL, "")),
  whatsappPhone: publicEnv(process.env.NEXT_PUBLIC_WHATSAPP_PHONE, publicEnv(process.env.NEXT_PUBLIC_BUSINESS_PHONE, "")),
  logoPath: publicEnv(process.env.NEXT_PUBLIC_LOGO_PATH, "/images/noble-farms-logo.png"),
};

const iconBrand = siteConfig.domain.includes("noble") || siteConfig.logoPath.includes("noble") ? "noble" : "shields";
export const brandIcons = {
  favicon32: `/images/${iconBrand}-favicon-32.png`,
  favicon48: `/images/${iconBrand}-favicon-48.png`,
  apple: `/images/${iconBrand}-apple-touch-icon.png`,
  pwa192: `/images/${iconBrand}-pwa-icon-192.png`,
  pwa512: `/images/${iconBrand}-pwa-icon-512.png`,
  maskable512: `/images/${iconBrand}-pwa-maskable-512.png`,
  badge96: `/images/${iconBrand}-pwa-badge-96.png`,
};

export const marketingConfig = {
  enabled: publicBool(process.env.NEXT_PUBLIC_MARKETING_ENABLED, false),
  gaMeasurementId: publicEnv(process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID, ""),
  googleTagId: publicEnv(process.env.NEXT_PUBLIC_GOOGLE_TAG_ID, ""),
  gtmContainerId: publicEnv(process.env.NEXT_PUBLIC_GTM_CONTAINER_ID, ""),
  metaPixelId: publicEnv(process.env.NEXT_PUBLIC_META_PIXEL_ID, ""),
  primaryRegion: publicEnv(process.env.NEXT_PUBLIC_MARKETING_PRIMARY_REGION, ""),
  businessSupplyEnabled: publicBool(process.env.NEXT_PUBLIC_BUSINESS_SUPPLY_ENABLED, true),
  analyticsTestEnabled: publicBool(process.env.NEXT_PUBLIC_ANALYTICS_TEST_ENABLED, false),
};

export const operationalFeatures = {
  pwaEnabled: publicBool(process.env.NEXT_PUBLIC_PWA_ENABLED, false),
  webPushEnabled: publicBool(process.env.NEXT_PUBLIC_WEB_PUSH_ENABLED, false),
  vapidPublicKey: publicEnv(process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY, ""),
  resetEnabled: publicBool(process.env.NEXT_PUBLIC_PWA_RESET_ENABLED, false),
};

export const contentPublicConfig = {
  hubEnabled: publicBool(process.env.NEXT_PUBLIC_CONTENT_HUB_ENABLED, false),
  affiliateEnabled: publicBool(process.env.NEXT_PUBLIC_AFFILIATE_CONTENT_ENABLED, false),
  toolsEnabled: publicBool(process.env.NEXT_PUBLIC_CONTENT_TOOLS_ENABLED, false),
  subscriptionsEnabled: publicBool(process.env.NEXT_PUBLIC_CONTENT_SUBSCRIPTIONS_ENABLED, false),
  primaryMarket: publicEnv(process.env.NEXT_PUBLIC_CONTENT_PRIMARY_MARKET, "Nigeria and Africa"),
  secondaryMarket: publicEnv(process.env.NEXT_PUBLIC_CONTENT_SECONDARY_MARKET, "Global"),
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

