import type { MetadataRoute } from "next";

import { contentConfig } from "@/src/lib/content-config";
import { getSiteUrl } from "@/src/lib/site-url";

export default function sitemap(): MetadataRoute.Sitemap {
  const siteUrl = getSiteUrl();
  const routes = ["", "/shop", "/business-supply", "/about", "/contact", "/delivery", "/refund-policy", "/privacy-policy", "/terms", "/track-order"];
  if (contentConfig.hubEnabled && contentConfig.indexingEnabled) {
    routes.push("/blog", "/resources", "/videos");
    if (contentConfig.toolsEnabled) routes.push("/tools");
    if (contentConfig.affiliateEnabled) routes.push("/affiliate-disclosure");
    routes.push("/editorial-policy");
  }

  return routes.map((route) => ({
    url: `${siteUrl}${route}`,
    lastModified: new Date(),
    changeFrequency: route === "" || route === "/shop" ? "daily" : "monthly",
    priority: route === "" ? 1 : route === "/shop" ? 0.9 : 0.6,
  }));
}

