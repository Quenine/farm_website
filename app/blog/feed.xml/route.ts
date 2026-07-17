import { NextResponse } from "next/server";
import { siteConfig } from "@/src/config/site";
import { contentConfig } from "@/src/lib/content-config";
import { getIndexableContentData } from "@/src/lib/content-indexing";

export const dynamic = "force-dynamic";

export async function GET() {
  if (!contentConfig.hubEnabled || !contentConfig.indexingEnabled) return new NextResponse("Content feed disabled.", { status: 404 });
  const data = await getIndexableContentData();
  const base = siteConfig.url.replace(/\/$/, "");
  const xml = (value: string) => value.replace(/[<>&'"]/g, (char) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;", "'": "&apos;", '"': "&quot;" })[char] || char);
  const items = data.posts.map((post) => `<item><title>${xml(post.title)}</title><link>${base}/blog/${encodeURIComponent(post.slug)}</link><guid>${base}/blog/${encodeURIComponent(post.slug)}</guid><description>${xml(post.excerpt)}</description><pubDate>${new Date(post.published_at).toUTCString()}</pubDate></item>`).join("");
  return new NextResponse(`<?xml version="1.0" encoding="UTF-8"?><rss version="2.0"><channel><title>${xml(siteConfig.name)} Agribusiness Content</title><link>${base}/blog</link><description>${xml(siteConfig.description)}</description>${items}</channel></rss>`, { headers: { "content-type": "application/rss+xml; charset=utf-8" } });
}
