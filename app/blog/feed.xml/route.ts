import { NextResponse } from "next/server";
import { contentPublicConfig, siteConfig } from "@/src/config/site";
import { getContentIndexData } from "@/src/lib/content";

export const dynamic = "force-dynamic";

export async function GET() {
  if (!contentPublicConfig.hubEnabled) return new NextResponse("Content feed disabled.", { status: 404 });
  const data = await getContentIndexData({ page: 1 });
  const base = siteConfig.url.replace(/\/$/, "");
  const items = data.posts.map((post) => `<item><title><![CDATA[${post.title}]]></title><link>${base}/blog/${post.slug}</link><guid>${base}/blog/${post.slug}</guid><description><![CDATA[${post.excerpt}]]></description><pubDate>${post.published_at ? new Date(post.published_at).toUTCString() : new Date(post.updated_at).toUTCString()}</pubDate></item>`).join("");
  return new NextResponse(`<?xml version="1.0" encoding="UTF-8"?><rss version="2.0"><channel><title>${siteConfig.name} Agribusiness Content</title><link>${base}/blog</link><description>${siteConfig.description}</description>${items}</channel></rss>`, { headers: { "content-type": "application/rss+xml; charset=utf-8" } });
}
