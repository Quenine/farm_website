import type { MetadataRoute } from "next";

import { getSiteUrl } from "@/src/lib/site-url";
import { contentConfig } from "@/src/lib/content-config";

export default function robots(): MetadataRoute.Robots {
  const siteUrl = getSiteUrl();

  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: ["/admin/", "/api/", ...(!contentConfig.indexingEnabled ? ["/blog", "/resources", "/videos", "/tools"] : [])],
    },
    sitemap: `${siteUrl}/sitemap.xml`,
  };
}
