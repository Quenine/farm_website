import { trackGaEvent } from "@/src/lib/analytics";

export function trackViewContentPost(slug: string) {
  trackGaEvent("view_content_post", { content_slug: slug });
}

export function trackContentSearch(term: string) {
  if (term.trim()) trackGaEvent("content_search", { search_term: term.trim() });
}

export function trackSelectContentPost(slug: string) {
  trackGaEvent("select_content_post", { content_slug: slug });
}

export function trackVideoContent(slug: string) {
  trackGaEvent("view_video_content", { content_slug: slug });
}

export function trackAffiliateClick(slug: string) {
  trackGaEvent("affiliate_click", { offer_slug: slug });
}

export function trackContentProductClick(productSlug: string) {
  trackGaEvent("content_product_click", { product_slug: productSlug });
}

export function trackComparisonInteraction(slug: string) {
  trackGaEvent("comparison_interaction", { content_slug: slug });
}

export function trackContentToolStart(toolName: string) {
  trackGaEvent("tool_start", { tool_name: toolName });
}

export function trackContentToolComplete(toolName: string) {
  trackGaEvent("tool_complete", { tool_name: toolName });
}

export function trackResourceSelect(slug: string) {
  trackGaEvent("resource_select", { resource_slug: slug });
}

export function trackSubscriberSignup(topic: string) {
  trackGaEvent("subscriber_signup", { topic });
}

export function trackShareContent(slug: string, method: string) {
  trackGaEvent("share_content", { content_slug: slug, method });
}
