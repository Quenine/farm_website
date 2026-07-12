"use client";

import { useEffect } from "react";
import { productToAnalyticsItem, trackSearch, trackViewItemList } from "@/src/lib/analytics";
import type { Product } from "@/src/types";

export function ShopAnalytics({ products, search }: { products: Product[]; search: string }) {
  useEffect(() => {
    trackViewItemList(products.slice(0, 24).map((product) => productToAnalyticsItem(product)), "Shop");
    if (search) trackSearch(search);
  }, [products, search]);

  return null;
}
