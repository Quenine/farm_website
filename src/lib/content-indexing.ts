import "server-only";

import { contentConfig } from "@/src/lib/content-config";
import { emailConfig } from "@/src/lib/email-config";
import { createContentAdminSupabaseClient } from "@/src/lib/supabase/content-admin-server";
import { hasAdminSupabaseConfig } from "@/src/lib/supabase/config";
import { siteConfig } from "@/src/config/site";

type IndexPost = {
  id: string; slug: string; title: string; excerpt: string; content_markdown: string;
  featured_image_url: string | null; featured_image_alt: string | null;
  contains_affiliate_content: boolean; recommendation_methodology: string | null;
  seo_title: string | null; seo_description: string | null; external_canonical_url: string | null;
  published_at: string; updated_at: string; category_id: string | null; author_id: string | null;
};

export async function getIndexableContentData() {
  if (!contentConfig.hubEnabled || !hasAdminSupabaseConfig()) return { posts: [] as IndexPost[], categories: [], tags: [], activeCategoryCount: 0, activeTagCount: 0 };
  const supabase = createContentAdminSupabaseClient();
  const now = new Date().toISOString();
  const [postsResult, categoryResult, tagResult] = await Promise.all([supabase.from("content_posts")
    .select("id,slug,title,excerpt,content_markdown,featured_image_url,featured_image_alt,contains_affiliate_content,recommendation_methodology,seo_title,seo_description,external_canonical_url,published_at,updated_at,category_id,author_id,content_categories(id,name,slug),content_post_tags(content_tags(id,name,slug))")
    .eq("status", "published").not("published_at", "is", null).lte("published_at", now).is("deleted_at", null)
    .order("published_at", { ascending: false }), supabase.from("content_categories").select("id", { count: "exact", head: true }).eq("is_active", true).is("deleted_at", null), supabase.from("content_tags").select("id", { count: "exact", head: true }).eq("is_active", true).is("deleted_at", null)]);
  const { data, error } = postsResult;
  if (error) throw new Error("Unable to build eligible content index.");
  const rows = (data ?? []) as unknown as Array<IndexPost & { content_categories: { id: string; name: string; slug: string } | null; content_post_tags: Array<{ content_tags: { id: string; name: string; slug: string } | null }> }>;
  const posts = rows.filter((post) => !post.external_canonical_url);
  const categoryMap = new Map<string, { slug: string; name: string; updated_at: string; count: number }>();
  const tagMap = new Map<string, { slug: string; name: string; updated_at: string; count: number }>();
  for (const post of posts) {
    if (post.content_categories) {
      const current = categoryMap.get(post.content_categories.id);
      categoryMap.set(post.content_categories.id, { slug: post.content_categories.slug, name: post.content_categories.name, updated_at: current && current.updated_at > post.updated_at ? current.updated_at : post.updated_at, count: (current?.count ?? 0) + 1 });
    }
    for (const relation of post.content_post_tags ?? []) {
      if (!relation.content_tags) continue;
      const current = tagMap.get(relation.content_tags.id);
      tagMap.set(relation.content_tags.id, { slug: relation.content_tags.slug, name: relation.content_tags.name, updated_at: current && current.updated_at > post.updated_at ? current.updated_at : post.updated_at, count: (current?.count ?? 0) + 1 });
    }
  }
  return { posts, categories: [...categoryMap.values()], tags: [...tagMap.values()], activeCategoryCount: categoryResult.count ?? categoryMap.size, activeTagCount: tagResult.count ?? tagMap.size };
}

export async function getContentIndexingReadiness() {
  const blockers: string[] = [];
  const canonical = siteConfig.url.replace(/\/$/, "");
  if (siteConfig.domain !== "shieldsfarms.store") blockers.push("Canonical domain must be shieldsfarms.store.");
  if (!canonical.startsWith("https://")) blockers.push("Canonical URL must use HTTPS.");
  let data = { posts: [] as IndexPost[], categories: [] as Array<{ count: number }>, tags: [] as Array<{ count: number }>, activeCategoryCount: 0, activeTagCount: 0 };
  try { data = await getIndexableContentData(); } catch { blockers.push("Sitemap and RSS content data could not be built."); }
  let eligibleOfferSlugs = new Set<string>();
  if (hasAdminSupabaseConfig()) {
    const offerResult = await createContentAdminSupabaseClient().from("affiliate_offers").select("slug,is_active,deleted_at,affiliate_partners(is_active,deleted_at)");
    eligibleOfferSlugs = new Set(((offerResult.data ?? []) as unknown as Array<{ slug: string; is_active: boolean; deleted_at: string | null; affiliate_partners: { is_active: boolean; deleted_at: string | null } | Array<{ is_active: boolean; deleted_at: string | null }> | null }>).filter((offer) => {
      const partner = Array.isArray(offer.affiliate_partners) ? offer.affiliate_partners[0] : offer.affiliate_partners;
      return offer.is_active && !offer.deleted_at && partner?.is_active && !partner.deleted_at;
    }).map((offer) => offer.slug));
  }
  if (data.posts.length < 5) blockers.push(`At least five eligible published articles are required; found ${data.posts.length}.`);
  for (const post of data.posts) {
    const missing = [
      !post.title.trim() && "title", !post.excerpt.trim() && "excerpt", !post.author_id && "author", !post.category_id && "category",
      post.content_markdown.trim().length < 120 && "meaningful body", !post.featured_image_url && "featured image",
      !post.featured_image_alt?.trim() && "featured image alt", !(post.seo_title?.trim() || post.title.trim()) && "SEO title",
      !(post.seo_description?.trim() || post.excerpt.trim()) && "SEO description",
    ].filter(Boolean);
    if (missing.length) blockers.push(`${post.slug}: missing ${missing.join(", ")}.`);
    if (/\b(test|dummy|placeholder)\b/i.test(`${post.title} ${post.slug}`)) blockers.push(`${post.slug}: appears to be a public test post.`);
    if (post.contains_affiliate_content && !post.recommendation_methodology?.trim() && post.content_markdown.includes("[[comparison")) blockers.push(`${post.slug}: comparison methodology is required.`);
    const affiliateTokens = [...post.content_markdown.matchAll(/\[\[affiliate:([^\]]+)\]\]/g)].map((match) => match[1].trim());
    for (const token of affiliateTokens) if (!eligibleOfferSlugs.has(token)) blockers.push(`${post.slug}: affiliate token ${token} is broken or retired.`);
    if (!/(\]\(\/|href=["']\/|\[\[(product|tool|callout):)/i.test(post.content_markdown)) blockers.push(`${post.slug}: no intentional internal link was detected.`);
  }
  if (!emailConfig.publicBusinessEmail || !emailConfig.publicSupportEmail || !emailConfig.publicOrdersEmail || !emailConfig.contactInboxEmail || !emailConfig.fromSupport) blockers.push("Official public and private email routing must be configured.");
  return {
    readyForContentIndexing: blockers.length === 0,
    blockers,
    eligibleArticleCount: data.posts.length,
    sitemapArticleCount: contentConfig.indexingEnabled ? data.posts.length : 0,
    rssEnabled: contentConfig.hubEnabled && contentConfig.indexingEnabled,
    noindexArticleCount: contentConfig.indexingEnabled ? 0 : data.posts.length,
    emptyCategoryCount: Math.max(0, data.activeCategoryCount - data.categories.length),
    emptyTagCount: Math.max(0, data.activeTagCount - data.tags.length),
  };
}
