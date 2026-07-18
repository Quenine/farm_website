import type { Product } from "@/src/types";

export type CampaignReadiness = {
  state: "ready" | "needs_attention" | "not_campaignable";
  missing: string[];
};

export function getProductCampaignReadiness(product: Product): CampaignReadiness {
  const missing: string[] = [];
  const active = product.status === "active";
  const quoteSupported = product.pricingMode === "quote_required" && Boolean(product.displayPriceLabel?.trim());
  if (!active) missing.push("Public active state");
  if (!(product.price > 0) && !quoteSupported) missing.push("Valid price or price-request state");
  if (product.pricingMode === "fixed" && product.stockCount <= 0) missing.push("Available stock");
  if (!product.primaryMedia?.url) missing.push("Primary image");
  if (product.name.trim().length < 3) missing.push("Meaningful title");
  if (product.description.trim().length < 40) missing.push("Meaningful description");
  if (!product.unit.trim()) missing.push("Quantity unit");
  if (!(product.minimumOrder > 0) || !((product.quantityStep ?? 0) > 0)) missing.push("Minimum and quantity step");
  if (!(product.supportsHomeDelivery || product.supportsPickupPoint || product.supportsFarmPickup)) missing.push("Delivery or pickup method");
  if (!product.slug.trim()) missing.push("Public product URL");
  if (product.pricingMode === "fixed" && !product.isOrderableOnline) missing.push("Checkout eligibility");
  if (!active) return { state: "not_campaignable", missing };
  return { state: missing.length ? "needs_attention" : "ready", missing };
}
