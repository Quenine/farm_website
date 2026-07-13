import "server-only";

import { cache } from "react";
import { contentConfig } from "@/src/lib/content-config";
import { createContentAdminSupabaseClient } from "@/src/lib/supabase/content-admin-server";
import { hasAdminSupabaseConfig } from "@/src/lib/supabase/config";
import type { Product } from "@/src/types";

export type ContentPostStatus = "draft" | "review" | "published" | "archived";
export type ContentFormat = "article" | "video_companion" | "comparison" | "resource_guide" | "case_study" | "farm_field_note";
export type RecommendationBasis = "personally_tested" | "editorial_research" | "merchant_information";

export type ContentAuthor = {
  id: string;
  name: string;
  slug: string;
  role_title: string | null;
  bio: string | null;
  avatar_url: string | null;
  avatar_alt: string | null;
  credentials_or_experience: string | null;
};

export type ContentCategory = {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  seo_title: string | null;
  seo_description: string | null;
};

export type ContentTag = { id: string; name: string; slug: string; description: string | null };

export type ContentSource = {
  id: string;
  title: string;
  publisher: string | null;
  url: string;
  source_type: string;
  publication_date: string | null;
  accessed_at: string | null;
  citation_label: string | null;
  supporting_note: string | null;
};

export type ContentVideo = {
  id: string;
  platform: string;
  external_video_id: string | null;
  embed_url: string | null;
  watch_url: string | null;
  title: string;
  description: string | null;
  thumbnail_url: string | null;
  thumbnail_alt: string | null;
  duration_seconds: number | null;
  upload_date: string | null;
  transcript_markdown: string | null;
  chapters: Array<{ label: string; time: string }> | null;
};

export type AffiliateOffer = {
  id: string;
  title: string;
  slug: string;
  short_description: string;
  destination_url: string;
  image_url: string | null;
  image_alt: string | null;
  button_label: string;
  display_price: string | null;
  currency: string | null;
  price_last_checked_at: string | null;
  available_regions: string[] | null;
  recommendation_basis: RecommendationBasis;
  is_featured: boolean;
  partner: { id: string; name: string; slug: string; website_url: string; default_disclosure: string | null } | null;
  best_for?: string | null;
  editorial_verdict?: string | null;
  pros?: string[] | null;
  cons?: string[] | null;
};

export type ContentPost = {
  id: string;
  title: string;
  slug: string;
  excerpt: string;
  answer_summary: string | null;
  key_takeaways: string[] | null;
  content_markdown: string;
  featured_image_url: string | null;
  featured_image_alt: string | null;
  status: ContentPostStatus;
  content_format: ContentFormat;
  post_type: string;
  audience_scope: string;
  is_featured: boolean;
  contains_affiliate_content: boolean;
  custom_affiliate_disclosure: string | null;
  recommendation_methodology: string | null;
  seo_title: string | null;
  seo_description: string | null;
  external_canonical_url: string | null;
  published_at: string | null;
  reviewed_at: string | null;
  updated_at: string;
  category: ContentCategory | null;
  author: ContentAuthor | null;
  tags: ContentTag[];
  sources: ContentSource[];
  video: ContentVideo | null;
  products: Product[];
  offers: AffiliateOffer[];
};

export type ContentListFilters = {
  q?: string;
  category?: string;
  tag?: string;
  format?: string;
  audience?: string;
  page?: number;
};

export type ContentListResult = {
  posts: ContentPost[];
  featured: ContentPost[];
  categories: ContentCategory[];
  tags: ContentTag[];
  total: number;
  page: number;
  pageSize: number;
};

const pageSize = 9;

function contentDisabledResult(): ContentListResult {
  return { posts: [], featured: [], categories: [], tags: [], total: 0, page: 1, pageSize };
}

function relationOne<T>(value: T | T[] | null | undefined): T | null {
  return Array.isArray(value) ? value[0] ?? null : value ?? null;
}

function safeArray<T>(value: T[] | null | undefined): T[] {
  return Array.isArray(value) ? value : [];
}

function shouldHideSupabaseError(error: { code?: string; message?: string } | null) {
  return Boolean(error && ["42P01", "42703", "PGRST200", "PGRST204", "PGRST205"].includes(error.code ?? ""));
}

function productFromRelation(row: Record<string, unknown>): Product | null {
  if (!row.id || !row.slug || !row.name) return null;
  return {
    id: String(row.id),
    slug: String(row.slug),
    name: String(row.name),
    description: String(row.description ?? ""),
    price: Number(row.price ?? 0),
    unit: String(row.unit ?? "unit"),
    stock: `${Number(row.stock_quantity ?? 0)} available`,
    stockCount: Number(row.stock_quantity ?? 0),
    minimumOrder: Number(row.minimum_order_quantity ?? 1),
    minimumUnit: String(row.unit ?? "unit"),
    category: "Farm Product",
    availability: "Available now",
    badge: "Shop product",
    status: "active",
    pricingMode: "fixed",
    isOrderableOnline: true,
  };
}

const postSelect = `
  id,
  title,
  slug,
  excerpt,
  answer_summary,
  key_takeaways,
  content_markdown,
  featured_image_url,
  featured_image_alt,
  status,
  content_format,
  post_type,
  audience_scope,
  is_featured,
  contains_affiliate_content,
  custom_affiliate_disclosure,
  recommendation_methodology,
  seo_title,
  seo_description,
  external_canonical_url,
  published_at,
  reviewed_at,
  updated_at,
  content_categories ( id, name, slug, description, seo_title, seo_description ),
  content_authors ( id, name, slug, role_title, bio, avatar_url, avatar_alt, credentials_or_experience ),
  content_post_tags ( content_tags ( id, name, slug, description ) ),
  content_post_sources ( citation_label, supporting_note, sort_order, content_sources ( id, title, publisher, url, source_type, publication_date, accessed_at ) ),
  content_videos ( id, platform, external_video_id, embed_url, watch_url, title, description, thumbnail_url, thumbnail_alt, duration_seconds, upload_date, transcript_markdown, chapters ),
  content_post_products ( sort_order, custom_context, products ( id, name, slug, description, price, unit, stock_quantity, minimum_order_quantity ) ),
  content_post_affiliate_offers ( sort_order, best_for, editorial_verdict, pros, cons, affiliate_offers ( id, title, slug, short_description, destination_url, image_url, image_alt, button_label, display_price, currency, price_last_checked_at, available_regions, recommendation_basis, is_featured, affiliate_partners ( id, name, slug, website_url, default_disclosure ) ) )
`;

type RawPost = Record<string, unknown>;

export function readingMinutes(markdown: string) {
  const words = markdown.replace(/\[\[[^\]]+\]\]/g, "").trim().split(/\s+/).filter(Boolean).length;
  return Math.max(1, Math.ceil(words / 220));
}

export function mapPost(row: RawPost): ContentPost {
  const tagRows = safeArray(row.content_post_tags as Array<{ content_tags?: ContentTag | ContentTag[] | null }> | null);
  const sourceRows = safeArray(row.content_post_sources as Array<{ citation_label?: string | null; supporting_note?: string | null; sort_order?: number; content_sources?: ContentSource | ContentSource[] | null }> | null);
  const productRows = safeArray(row.content_post_products as Array<{ products?: Record<string, unknown> | Record<string, unknown>[] | null }> | null);
  const offerRows = safeArray(row.content_post_affiliate_offers as Array<Record<string, unknown>> | null);
  return {
    id: String(row.id),
    title: String(row.title),
    slug: String(row.slug),
    excerpt: String(row.excerpt),
    answer_summary: (row.answer_summary as string | null) ?? null,
    key_takeaways: (row.key_takeaways as string[] | null) ?? null,
    content_markdown: String(row.content_markdown ?? ""),
    featured_image_url: (row.featured_image_url as string | null) ?? null,
    featured_image_alt: (row.featured_image_alt as string | null) ?? null,
    status: row.status as ContentPostStatus,
    content_format: row.content_format as ContentFormat,
    post_type: String(row.post_type),
    audience_scope: String(row.audience_scope),
    is_featured: Boolean(row.is_featured),
    contains_affiliate_content: Boolean(row.contains_affiliate_content),
    custom_affiliate_disclosure: (row.custom_affiliate_disclosure as string | null) ?? null,
    recommendation_methodology: (row.recommendation_methodology as string | null) ?? null,
    seo_title: (row.seo_title as string | null) ?? null,
    seo_description: (row.seo_description as string | null) ?? null,
    external_canonical_url: (row.external_canonical_url as string | null) ?? null,
    published_at: (row.published_at as string | null) ?? null,
    reviewed_at: (row.reviewed_at as string | null) ?? null,
    updated_at: String(row.updated_at),
    category: relationOne(row.content_categories as ContentCategory | ContentCategory[] | null),
    author: relationOne(row.content_authors as ContentAuthor | ContentAuthor[] | null),
    tags: tagRows.map((tagRow) => relationOne(tagRow.content_tags)).filter(Boolean) as ContentTag[],
    sources: sourceRows
      .map((sourceRow) => {
        const source = relationOne(sourceRow.content_sources);
        return source ? { ...source, citation_label: sourceRow.citation_label ?? null, supporting_note: sourceRow.supporting_note ?? null } : null;
      })
      .filter(Boolean) as ContentSource[],
    video: relationOne(row.content_videos as ContentVideo | ContentVideo[] | null),
    products: productRows.map((productRow) => productFromRelation(relationOne(productRow.products) ?? {})).filter(Boolean) as Product[],
    offers: offerRows
      .map((offerRow) => {
        const offer = relationOne(offerRow.affiliate_offers as Record<string, unknown> | Record<string, unknown>[] | null);
        if (!offer) return null;
        return {
          id: String(offer.id),
          title: String(offer.title),
          slug: String(offer.slug),
          short_description: String(offer.short_description ?? ""),
          destination_url: String(offer.destination_url ?? ""),
          image_url: (offer.image_url as string | null) ?? null,
          image_alt: (offer.image_alt as string | null) ?? null,
          button_label: String(offer.button_label ?? "Check current price"),
          display_price: (offer.display_price as string | null) ?? null,
          currency: (offer.currency as string | null) ?? null,
          price_last_checked_at: (offer.price_last_checked_at as string | null) ?? null,
          available_regions: (offer.available_regions as string[] | null) ?? null,
          recommendation_basis: offer.recommendation_basis as RecommendationBasis,
          is_featured: Boolean(offer.is_featured),
          partner: relationOne(offer.affiliate_partners as AffiliateOffer["partner"] | AffiliateOffer["partner"][] | null),
          best_for: (offerRow.best_for as string | null) ?? null,
          editorial_verdict: (offerRow.editorial_verdict as string | null) ?? null,
          pros: (offerRow.pros as string[] | null) ?? null,
          cons: (offerRow.cons as string[] | null) ?? null,
        };
      })
      .filter(Boolean) as AffiliateOffer[],
  };
}

export const getContentIndexData = cache(async (filters: ContentListFilters = {}): Promise<ContentListResult> => {
  if (!contentConfig.hubEnabled || !hasAdminSupabaseConfig()) return contentDisabledResult();
  const supabase = createContentAdminSupabaseClient();
  const page = Math.max(1, Number(filters.page ?? 1));
  let query = supabase
    .from("content_posts")
    .select(postSelect, { count: "exact" })
    .eq("status", "published")
    .not("published_at", "is", null)
    .lte("published_at", new Date().toISOString())
    .order("is_featured", { ascending: false })
    .order("published_at", { ascending: false })
    .range((page - 1) * pageSize, page * pageSize - 1);

  if (filters.format) query = query.eq("content_format", filters.format);
  if (filters.audience) query = query.eq("audience_scope", filters.audience);
  if (filters.q) query = query.textSearch("search_vector", filters.q.trim(), { type: "websearch" });
  if (filters.category) query = query.eq("content_categories.slug", filters.category);
  if (filters.tag) query = query.eq("content_post_tags.content_tags.slug", filters.tag);

  const [{ data, error, count }, categoriesResult, tagsResult] = await Promise.all([
    query,
    supabase.from("content_categories").select("id, name, slug, description, seo_title, seo_description").eq("is_active", true).order("sort_order"),
    supabase.from("content_tags").select("id, name, slug, description").eq("is_active", true).order("name"),
  ]);
  if (shouldHideSupabaseError(error)) return contentDisabledResult();
  if (error) throw new Error(`Unable to load content: ${error.message}`);
  const posts = ((data ?? []) as RawPost[]).map(mapPost);
  return {
    posts,
    featured: posts.filter((post) => post.is_featured).slice(0, 3),
    categories: shouldHideSupabaseError(categoriesResult.error) ? [] : ((categoriesResult.data ?? []) as ContentCategory[]),
    tags: shouldHideSupabaseError(tagsResult.error) ? [] : ((tagsResult.data ?? []) as ContentTag[]),
    total: count ?? posts.length,
    page,
    pageSize,
  };
});

export async function getPublishedPostBySlug(slug: string) {
  if (!contentConfig.hubEnabled || !hasAdminSupabaseConfig()) return null;
  const supabase = createContentAdminSupabaseClient();
  const { data, error } = await supabase
    .from("content_posts")
    .select(postSelect)
    .eq("slug", slug)
    .eq("status", "published")
    .not("published_at", "is", null)
    .lte("published_at", new Date().toISOString())
    .maybeSingle();
  if (shouldHideSupabaseError(error)) return null;
  if (error) throw new Error(`Unable to load article: ${error.message}`);
  return data ? mapPost(data as RawPost) : null;
}

export async function getActiveAffiliateOffer(slug: string) {
  if (!contentConfig.affiliateEnabled || !hasAdminSupabaseConfig()) return null;
  const supabase = createContentAdminSupabaseClient();
  const { data, error } = await supabase
    .from("affiliate_offers")
    .select("id, title, slug, destination_url, is_active, affiliate_partners ( id, name, slug, website_url, is_active )")
    .eq("slug", slug)
    .eq("is_active", true)
    .maybeSingle();
  if (shouldHideSupabaseError(error)) return null;
  if (error) throw new Error(`Unable to load affiliate offer: ${error.message}`);
  const partner = relationOne((data as Record<string, unknown> | null)?.affiliate_partners as Record<string, unknown> | Record<string, unknown>[] | null);
  if (!data || !partner || partner.is_active === false) return null;
  return data as { id: string; title: string; slug: string; destination_url: string };
}

export async function getContentAdminSummary() {
  if (!contentConfig.hubEnabled || !hasAdminSupabaseConfig()) {
    return { configured: false, posts: 0, drafts: 0, review: 0, published: 0, videos: 0, comparisons: 0, affiliatePosts: 0, affiliateClicks: 0, productClicks: 0, activeSubscribers: 0, contentAssistedPaidOrders: 0, contentAssistedPaidRevenue: 0 };
  }
  const supabase = createContentAdminSupabaseClient();
  const [posts, affiliateClicks, productClicks, subscribers, orders] = await Promise.all([
    supabase.from("content_posts").select("status, content_format, contains_affiliate_content"),
    supabase.from("affiliate_clicks").select("id", { count: "exact", head: true }),
    supabase.from("content_product_clicks").select("id", { count: "exact", head: true }),
    supabase.from("content_subscribers").select("id", { count: "exact", head: true }).eq("status", "active"),
    supabase.from("orders").select("id,total_amount,payment_status,content_attribution").eq("payment_status", "paid").not("content_attribution", "is", null),
  ]);
  if (shouldHideSupabaseError(posts.error)) {
    return { configured: false, posts: 0, drafts: 0, review: 0, published: 0, videos: 0, comparisons: 0, affiliatePosts: 0, affiliateClicks: 0, productClicks: 0, activeSubscribers: 0, contentAssistedPaidOrders: 0, contentAssistedPaidRevenue: 0 };
  }
  if (posts.error) throw new Error(`Unable to load content summary: ${posts.error.message}`);
  const rows = (posts.data ?? []) as Array<{ status: string; content_format: string; contains_affiliate_content: boolean }>;
  const paidOrders = (orders.data ?? []) as Array<{ total_amount: number | string }>;
  return {
    configured: true,
    posts: rows.length,
    drafts: rows.filter((row) => row.status === "draft").length,
    review: rows.filter((row) => row.status === "review").length,
    published: rows.filter((row) => row.status === "published").length,
    videos: rows.filter((row) => row.content_format === "video_companion").length,
    comparisons: rows.filter((row) => row.content_format === "comparison").length,
    affiliatePosts: rows.filter((row) => row.contains_affiliate_content).length,
    affiliateClicks: affiliateClicks.count ?? 0,
    productClicks: productClicks.count ?? 0,
    activeSubscribers: subscribers.count ?? 0,
    contentAssistedPaidOrders: paidOrders.length,
    contentAssistedPaidRevenue: paidOrders.reduce((sum, order) => sum + Number(order.total_amount ?? 0), 0),
  };
}

export function validHttpUrl(value: string) {
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:" ? url : null;
  } catch {
    return null;
  }
}
