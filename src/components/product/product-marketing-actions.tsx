"use client";

import { useEffect, useMemo } from "react";
import { MessageCircle, Share2 } from "lucide-react";
import { siteConfig, whatsappUrl } from "@/src/config/site";
import { productToAnalyticsItem, trackLead, trackShare, trackViewItem } from "@/src/lib/analytics";
import type { Product } from "@/src/types";

export function ProductMarketingActions({ product }: { product: Product }) {
  const item = useMemo(() => productToAnalyticsItem(product, 1), [product]);
  const pageUrl = `${siteConfig.url.replace(/\/$/, "")}/shop/${product.slug}`;
  const shareMessage = `${siteConfig.name}: ${product.name} - ${pageUrl}`;
  const bulkMessage = `Hello ${siteConfig.name}, I want to ask about bulk supply for ${product.name}. ${pageUrl}`;

  useEffect(() => {
    trackViewItem(item);
  }, [item]);

  return (
    <div className="mt-4 grid gap-3 sm:grid-cols-2">
      <a
        href={whatsappUrl(shareMessage)}
        target="_blank"
        rel="noreferrer"
        onClick={() => trackShare("whatsapp", item)}
        className="inline-flex h-11 items-center justify-center gap-2 rounded-full border border-green-800 px-4 text-sm font-bold text-green-950 transition hover:bg-green-50"
      >
        <Share2 size={16} />
        Share on WhatsApp
      </a>
      <a
        href={whatsappUrl(bulkMessage)}
        target="_blank"
        rel="noreferrer"
        onClick={() => trackLead("product_bulk_supply_whatsapp")}
        className="inline-flex h-11 items-center justify-center gap-2 rounded-full bg-green-800 px-4 text-sm font-bold text-white transition hover:bg-green-900"
      >
        <MessageCircle size={16} />
        Ask about bulk supply
      </a>
    </div>
  );
}


