import type { MetadataRoute } from "next";

import { contentConfig } from "@/src/lib/content-config";
import { getSiteUrl } from "@/src/lib/site-url";
import { getIndexableContentData } from "@/src/lib/content-indexing";
import { getPublicProducts } from "@/src/lib/products";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const siteUrl = getSiteUrl();
  const routes = ["", "/shop", "/business-supply", "/about", "/contact", "/delivery", "/refund-policy", "/privacy-policy", "/terms", "/track-order"];
  if (contentConfig.hubEnabled && contentConfig.indexingEnabled) {
    routes.push("/blog", "/resources", "/videos");
    if (contentConfig.toolsEnabled) routes.push("/tools");
    if (contentConfig.affiliateEnabled) routes.push("/affiliate-disclosure");
    routes.push("/editorial-policy");
  }

  const result: MetadataRoute.Sitemap = routes.map((route) => ({
    url: `${siteUrl}${route}`,
    lastModified: new Date(),
    changeFrequency: route === "" || route === "/shop" ? "daily" : "monthly",
    priority: route === "" ? 1 : route === "/shop" ? 0.9 : 0.6,
  }));
  const products = await getPublicProducts();
  for (const product of products.filter((item) => item.status === "active")) {
    result.push({ url: siteUrl + "/shop/" + product.slug, lastModified: new Date(), changeFrequency: "weekly", priority: 0.8 });
  }
  if (contentConfig.hubEnabled && contentConfig.indexingEnabled) {
    const data = await getIndexableContentData();
    for (const post of data.posts) result.push({ url: `${siteUrl}/blog/${post.slug}`, lastModified: new Date(post.updated_at), changeFrequency: "weekly", priority: 0.75 });
    for (const category of data.categories) result.push({ url: `${siteUrl}/blog/category/${category.slug}`, lastModified: new Date(category.updated_at), changeFrequency: "weekly", priority: 0.65 });
    for (const tag of data.tags) result.push({ url: `${siteUrl}/blog/tag/${tag.slug}`, lastModified: new Date(tag.updated_at), changeFrequency: "monthly", priority: 0.55 });
  }
  return result;
}

