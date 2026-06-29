import type { Product } from "@/src/types";

export function isProductOrderable(product: Product) {
  return (
    product.status === "active" &&
    product.pricingMode !== "quote_required" &&
    product.isOrderableOnline !== false &&
    product.price > 0 &&
    product.stockCount >= product.minimumOrder
  );
}

export function productPriceLabel(product: Product) {
  if (product.pricingMode === "quote_required" || product.price <= 0) {
    return product.displayPriceLabel?.trim() || "Check Availability";
  }
  return null;
}

export function productAvailabilityMessage(product: Product) {
  if (product.pricingMode === "quote_required") {
    return "Available by confirmed supply";
  }
  return product.availability;
}

export function productRequestUrl(product: Product) {
  const message = encodeURIComponent(
    `Hello Noble Farms, I would like to check availability for ${product.name}.`,
  );
  return `https://wa.me/2349035712314?text=${message}`;
}
