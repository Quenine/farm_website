import type { Product } from "@/src/types";
import { marketingConfig, siteConfig } from "@/src/config/site";
import { CONSENT_COOKIE_MAX_AGE, CONSENT_COOKIE_NAME, serializeConsentCookie } from "@/src/lib/consent-cookie";

export type ConsentPreferences = {
  essential: true;
  analytics: boolean;
  marketing: boolean;
  updatedAt: string;
};

export type AttributionTouch = {
  utm_source?: string;
  utm_medium?: string;
  utm_campaign?: string;
  utm_content?: string;
  utm_term?: string;
  utm_id?: string;
  referrer?: string;
  landing_path?: string;
  first_seen_at?: string;
};

export type AttributionSnapshot = {
  firstTouch: AttributionTouch | null;
  lastTouch: AttributionTouch | null;
};

export type AnalyticsItem = {
  item_id?: string;
  item_name: string;
  item_category?: string;
  item_variant?: string;
  price?: number;
  quantity?: number;
};

export const CONSENT_STORAGE_KEY = "farm_marketing_consent_v1";
export const ATTRIBUTION_STORAGE_KEY = "farm_marketing_attribution_v1";

const campaignKeys = ["utm_source", "utm_medium", "utm_campaign", "utm_content", "utm_term", "utm_id"] as const;
let loadedGaId: string | null = null;
let loadedPixelId: string | null = null;
const firedPurchases = new Set<string>();

function hasWindow() {
  return typeof window !== "undefined";
}

function readJson<T>(key: string): T | null {
  if (!hasWindow()) return null;
  try {
    const raw = window.localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}

function writeJson(key: string, value: unknown) {
  if (!hasWindow()) return;
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Non-essential storage must never affect customer flows.
  }
}

export function getConsentPreferences() {
  return readJson<ConsentPreferences>(CONSENT_STORAGE_KEY);
}

export function saveConsentPreferences(input: { analytics: boolean; marketing: boolean }) {
  const preferences: ConsentPreferences = {
    essential: true,
    analytics: input.analytics,
    marketing: input.marketing,
    updatedAt: new Date().toISOString(),
  };
  writeJson(CONSENT_STORAGE_KEY, preferences);
  if (hasWindow()) {
    const secure = window.location.protocol === "https:" ? "; Secure" : "";
    document.cookie = `${CONSENT_COOKIE_NAME}=${serializeConsentCookie(input)}; Max-Age=${CONSENT_COOKIE_MAX_AGE}; Path=/; SameSite=Lax${secure}`;
  }
  window.dispatchEvent(new CustomEvent("farm-consent-changed", { detail: preferences }));
  return preferences;
}

export function analyticsAllowed() {
  return Boolean(marketingConfig.enabled && googleIntegration().valid && getConsentPreferences()?.analytics && !isAdminPath());
}

export function googleIntegration() {
  const configured = [marketingConfig.googleTagId, marketingConfig.gtmContainerId, marketingConfig.gaMeasurementId].filter(Boolean);
  if (configured.length !== 1) return { type: configured.length > 1 ? "conflict" : "none", id: configured[0] ?? "", valid: false } as const;
  const id = configured[0];
  if (/^(G|GT)-[A-Z0-9]+$/i.test(id)) return { type: "google_tag", id, valid: true } as const;
  if (/^GTM-[A-Z0-9]+$/i.test(id)) return { type: "tag_manager", id, valid: true } as const;
  return { type: "unknown", id, valid: false } as const;
}

function isAdminPath() {
  return hasWindow() && window.location.pathname.startsWith("/admin");
}

export function marketingAllowed() {
  return Boolean(marketingConfig.enabled && marketingConfig.metaPixelId && getConsentPreferences()?.marketing);
}

function appendScript(id: string, src: string) {
  if (!hasWindow() || document.getElementById(id)) return;
  const script = document.createElement("script");
  script.id = id;
  script.async = true;
  script.src = src;
  document.head.appendChild(script);
}

export function ensureGaLoaded() {
  if (!analyticsAllowed()) return;
  const integration = googleIntegration();
  const id = integration.id;
  if (!id || loadedGaId === id) return;
  window.dataLayer = window.dataLayer || [];
  if (integration.type === "tag_manager") {
    window.dataLayer.push({ "gtm.start": Date.now(), event: "gtm.js" });
    appendScript("farm-google-tag", "https://www.googletagmanager.com/gtm.js?id=" + encodeURIComponent(id));
    loadedGaId = id;
    return;
  }
  appendScript("farm-google-tag", "https://www.googletagmanager.com/gtag/js?id=" + encodeURIComponent(id));
  window.gtag = window.gtag || function gtagShim(...args: unknown[]) { window.dataLayer?.push(args); };
  window.gtag("js", new Date());
  window.gtag("config", id, { send_page_view: false, anonymize_ip: true });
  loadedGaId = id;
}

export function ensureMetaPixelLoaded() {
  if (!marketingAllowed()) return;
  const id = marketingConfig.metaPixelId;
  if (!id || loadedPixelId === id) return;
  window.fbq = window.fbq || function fbqShim(...args: unknown[]) { window._fbqQueue = [...(window._fbqQueue ?? []), args]; };
  appendScript("farm-meta-pixel", "https://connect.facebook.net/en_US/fbevents.js");
  window.fbq("init", id);
  loadedPixelId = id;
}

export function trackGaEvent(name: string, params: Record<string, unknown> = {}) {
  try {
    ensureGaLoaded();
    if (!analyticsAllowed()) return;
    const integration = googleIntegration();
    if (integration.type === "tag_manager") window.dataLayer?.push({ event: name, ...params });
    else if (window.gtag) window.gtag("event", name, params);
  } catch {
    // Tracking must never interrupt commerce.
  }
}

export function trackPixelEvent(name: string, params: Record<string, unknown> = {}) {
  try {
    ensureMetaPixelLoaded();
    if (!marketingAllowed() || !window.fbq) return;
    window.fbq("track", name, params);
  } catch {
    // Tracking must never interrupt commerce.
  }
}

export function productToAnalyticsItem(product: Product, quantity = 1): AnalyticsItem {
  return {
    item_id: product.id ?? product.slug,
    item_name: product.name,
    item_category: product.category,
    item_variant: product.unit,
    price: product.price,
    quantity,
  };
}

export function trackPageView(path = hasWindow() ? `${window.location.pathname}${window.location.search}` : "/") {
  trackGaEvent("page_view", { page_location: hasWindow() ? window.location.href : `${siteConfig.url}${path}`, page_path: path });
  trackPixelEvent("PageView");
}

export function trackViewItemList(items: AnalyticsItem[], listName = "Shop") {
  trackGaEvent("view_item_list", { item_list_name: listName, currency: "NGN", items });
}

export function trackSelectItem(item: AnalyticsItem, listName = "Shop") {
  trackGaEvent("select_item", { item_list_name: listName, items: [item] });
}

export function trackViewItem(item: AnalyticsItem) {
  trackGaEvent("view_item", { currency: "NGN", value: item.price, items: [item] });
  trackPixelEvent("ViewContent", { currency: "NGN", value: item.price, content_name: item.item_name, content_ids: [item.item_id] });
}

export function trackAddToCart(item: AnalyticsItem) {
  const value = Number(item.price ?? 0) * Number(item.quantity ?? 1);
  trackGaEvent("add_to_cart", { currency: "NGN", value, items: [item] });
  trackPixelEvent("AddToCart", { currency: "NGN", value, content_name: item.item_name, content_ids: [item.item_id] });
}

export function trackRemoveFromCart(item: AnalyticsItem) {
  trackGaEvent("remove_from_cart", { currency: "NGN", items: [item] });
}

export function trackViewCart(items: AnalyticsItem[], value: number) {
  trackGaEvent("view_cart", { currency: "NGN", value, items });
}

export function trackBeginCheckout(items: AnalyticsItem[], value: number) {
  trackGaEvent("begin_checkout", { currency: "NGN", value, items });
  trackPixelEvent("InitiateCheckout", { currency: "NGN", value });
}

export function trackAddShippingInfo(method: string, value: number) {
  trackGaEvent("add_shipping_info", { currency: "NGN", value, shipping_tier: method });
}

export function trackPurchase(input: { transactionId: string; value: number; shipping: number; items: AnalyticsItem[] }) {
  if (firedPurchases.has(input.transactionId) || readJson<Record<string, true>>("farm_tracked_purchases_v1")?.[input.transactionId]) return;
  firedPurchases.add(input.transactionId);
  trackGaEvent("purchase", {
    transaction_id: input.transactionId,
    currency: "NGN",
    value: input.value,
    shipping: input.shipping,
    items: input.items,
  });
  trackPixelEvent("Purchase", { currency: "NGN", value: input.value, content_ids: input.items.map((item) => item.item_id) });
  writeJson("farm_tracked_purchases_v1", { ...(readJson<Record<string, true>>("farm_tracked_purchases_v1") ?? {}), [input.transactionId]: true });
}

export function trackSearch(searchTerm: string) {
  if (!searchTerm.trim()) return;
  trackGaEvent("search", { search_term: searchTerm.trim() });
}

export function trackLead(label: string) {
  trackGaEvent("generate_lead", { method: label });
  trackPixelEvent("Lead", { content_name: label });
}

export function trackSafeEvent(name: string, params: Record<string, string | number | boolean> = {}) {
  trackGaEvent(name, params);
}

export function trackShare(method: string, item?: AnalyticsItem) {
  trackGaEvent("share", { method, content_type: item ? "product" : "cart", item_id: item?.item_id, item_name: item?.item_name });
}

export function captureAttributionFromLocation() {
  if (!hasWindow()) return;
  const params = new URLSearchParams(window.location.search);
  const hasCampaign = campaignKeys.some((key) => params.has(key));
  const stored = readJson<AttributionSnapshot>(ATTRIBUTION_STORAGE_KEY) ?? { firstTouch: null, lastTouch: null };
  if (!hasCampaign && stored.firstTouch) return;

  const touch: AttributionTouch = {
    referrer: document.referrer || undefined,
    landing_path: `${window.location.pathname}${window.location.search}`,
    first_seen_at: new Date().toISOString(),
  };
  for (const key of campaignKeys) {
    const value = params.get(key)?.trim();
    if (value) touch[key] = value.slice(0, 160);
  }
  if (!hasCampaign && !touch.referrer) return;

  writeJson(ATTRIBUTION_STORAGE_KEY, {
    firstTouch: stored.firstTouch ?? touch,
    lastTouch: hasCampaign ? touch : stored.lastTouch,
  });
}

export function getAttributionSnapshot(): AttributionSnapshot {
  return readJson<AttributionSnapshot>(ATTRIBUTION_STORAGE_KEY) ?? { firstTouch: null, lastTouch: null };
}

declare global {
  interface Window {
    dataLayer?: unknown[];
    gtag?: (...args: unknown[]) => void;
    fbq?: (...args: unknown[]) => void;
    _fbqQueue?: unknown[][];
  }
}
