import "server-only";

import { contentConfig, indexNowCanSubmit } from "@/src/lib/content-config";
import { siteConfig } from "@/src/config/site";

const recent = new Map<string, number>();

export async function submitIndexNowArticle(slug: string) {
  if (!indexNowCanSubmit()) return { submitted: false, reason: "disabled" as const };
  const url = `${siteConfig.url.replace(/\/$/, "")}/blog/${slug}`;
  const previous = recent.get(url) ?? 0;
  if (Date.now() - previous < 5 * 60 * 1000) return { submitted: false, reason: "deduplicated" as const };
  recent.set(url, Date.now());
  try {
    const response = await fetch("https://api.indexnow.org/indexnow", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ host: siteConfig.domain, key: contentConfig.indexNowKey, keyLocation: `${siteConfig.url.replace(/\/$/, "")}/${contentConfig.indexNowKey}.txt`, urlList: [url] }),
    });
    if (!response.ok) throw new Error("provider_rejected");
    return { submitted: true, reason: "submitted" as const };
  } catch {
    console.error("[IndexNow Submission Failed]", { path: `/blog/${slug}`, reason: "provider_unavailable_or_rejected" });
    return { submitted: false, reason: "failed" as const };
  }
}
