"use server";

import "server-only";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { ensureContentAdmin, type AdminEntity } from "@/src/lib/content-admin";
import { createContentAdminSupabaseClient } from "@/src/lib/supabase/content-admin-server";

export type AdminMutationState = { ok: true; success: true; message: string; id?: string } | { ok: false; success: false; message: string; fieldErrors?: Record<string, string[]> };

const slugSchema = z.string().trim().min(2).max(180).regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Use lowercase letters, numbers and hyphens only.");
const optionalUrl = z.string().trim().optional().nullable().transform((value) => value || null).refine((value) => !value || /^https?:\/\//i.test(value), "Enter an HTTP or HTTPS URL.");
const requiredUrl = z.string().trim().min(8).max(2000).regex(/^https?:\/\//i, "Enter an HTTP or HTTPS URL.");
const optionalDate = z.string().trim().optional().nullable().transform((value) => value || null);
const bool = z.boolean().default(false);

const entityTables: Partial<Record<AdminEntity, string>> = {
  authors: "content_authors",
  categories: "content_categories",
  tags: "content_tags",
  sources: "content_sources",
  partners: "affiliate_partners",
  offers: "affiliate_offers",
  videos: "content_videos",
};

const schemas = {
  authors: z.object({
    id: z.string().uuid().optional().nullable(),
    name: z.string().trim().min(2).max(160),
    slug: slugSchema,
    role_title: z.string().trim().max(160).optional().nullable().transform((value) => value || null),
    bio: z.string().trim().max(4000).optional().nullable().transform((value) => value || null),
    avatar_url: optionalUrl,
    avatar_alt: z.string().trim().max(180).optional().nullable().transform((value) => value || null),
    social_links: z.string().trim().optional().nullable().transform((value) => value ? JSON.parse(value) : {}),
    credentials_or_experience: z.string().trim().max(4000).optional().nullable().transform((value) => value || null),
    is_active: bool,
  }).refine((value) => !value.avatar_url || Boolean(value.avatar_alt), { path: ["avatar_alt"], message: "Avatar alt text is required when an avatar image is set." }),
  categories: z.object({
    id: z.string().uuid().optional().nullable(),
    name: z.string().trim().min(2).max(160),
    slug: slugSchema,
    description: z.string().trim().max(2000).optional().nullable().transform((value) => value || null),
    seo_title: z.string().trim().max(180).optional().nullable().transform((value) => value || null),
    seo_description: z.string().trim().max(300).optional().nullable().transform((value) => value || null),
    sort_order: z.coerce.number().int().min(0).max(10000).default(100),
    is_active: bool,
  }),
  tags: z.object({
    id: z.string().uuid().optional().nullable(),
    name: z.string().trim().min(2).max(120),
    slug: slugSchema,
    description: z.string().trim().max(1200).optional().nullable().transform((value) => value || null),
    is_active: bool,
  }),
  sources: z.object({
    id: z.string().uuid().optional().nullable(),
    title: z.string().trim().min(2).max(220),
    publisher: z.string().trim().max(180).optional().nullable().transform((value) => value || null),
    url: requiredUrl,
    source_type: z.enum(["government","academic","manufacturer","industry_body","merchant","original_interview","original_field_observation","news","other"]),
    publication_date: optionalDate,
    accessed_at: optionalDate,
    is_primary_source: bool,
    internal_note: z.string().trim().max(4000).optional().nullable().transform((value) => value || null),
    is_active: bool,
  }),
  partners: z.object({
    id: z.string().uuid().optional().nullable(),
    name: z.string().trim().min(2).max(180),
    slug: slugSchema,
    website_url: requiredUrl,
    affiliate_network: z.string().trim().max(180).optional().nullable().transform((value) => value || null),
    default_disclosure: z.string().trim().max(1000).optional().nullable().transform((value) => value || null),
    internal_notes: z.string().trim().max(4000).optional().nullable().transform((value) => value || null),
    is_active: bool,
  }),
  offers: z.object({
    id: z.string().uuid().optional().nullable(),
    partner_id: z.string().uuid("Choose a partner."),
    title: z.string().trim().min(2).max(220),
    slug: slugSchema,
    short_description: z.string().trim().min(5).max(1000),
    destination_url: requiredUrl,
    image_url: optionalUrl,
    image_alt: z.string().trim().max(180).optional().nullable().transform((value) => value || null),
    button_label: z.string().trim().min(2).max(80).default("Check current price"),
    display_price: z.string().trim().max(80).optional().nullable().transform((value) => value || null),
    currency: z.string().trim().max(12).optional().nullable().transform((value) => value || null),
    price_last_checked_at: optionalDate,
    available_regions: z.string().trim().optional().nullable().transform((value) => value ? value.split(",").map((item) => item.trim()).filter(Boolean) : null),
    recommendation_basis: z.enum(["personally_tested","editorial_research","merchant_information"]),
    is_featured: bool,
    is_active: bool,
    internal_commission_note: z.string().trim().max(2000).optional().nullable().transform((value) => value || null),
  }).refine((value) => !value.image_url || Boolean(value.image_alt), { path: ["image_alt"], message: "Image alt text is required when an image is set." }),
  videos: z.object({
    id: z.string().uuid().optional().nullable(),
    post_id: z.string().uuid("Choose a related post."),
    platform: z.enum(["youtube","direct_external"]),
    external_video_id: z.string().trim().max(160).optional().nullable().transform((value) => value || null),
    embed_url: optionalUrl,
    watch_url: optionalUrl,
    title: z.string().trim().min(2).max(220),
    description: z.string().trim().max(2000).optional().nullable().transform((value) => value || null),
    thumbnail_url: optionalUrl,
    thumbnail_alt: z.string().trim().max(180).optional().nullable().transform((value) => value || null),
    duration_seconds: z.coerce.number().int().min(0).optional().nullable().transform((value) => value || null),
    upload_date: optionalDate,
    transcript_markdown: z.string().trim().max(50000).optional().nullable().transform((value) => value || null),
    chapters: z.string().trim().optional().nullable().transform((value) => value ? JSON.parse(value) : null),
    is_active: bool,
  }).refine((value) => !value.thumbnail_url || Boolean(value.thumbnail_alt), { path: ["thumbnail_alt"], message: "Thumbnail alt text is required when a thumbnail is set." }),
};

function flattenPayload(payload: Record<string, unknown>) {
  const output: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(payload)) output[key] = value === "" ? null : value;
  return output;
}

function revalidateContentAdmin() {
  revalidatePath("/admin/content");
  revalidatePath("/admin/affiliate");
  revalidatePath("/blog");
  revalidatePath("/resources");
  revalidatePath("/videos");
  revalidatePath("/tools");
  revalidatePath("/sitemap.xml");
}

export async function saveAdminEntityAction(entity: keyof typeof schemas, payload: Record<string, unknown>): Promise<AdminMutationState> {
  try {
    await ensureContentAdmin(entity as AdminEntity);
    const parsed = schemas[entity].safeParse(flattenPayload(payload));
    if (!parsed.success) return { ok: false, success: false, message: "Please correct the highlighted fields.", fieldErrors: parsed.error.flatten().fieldErrors as Record<string, string[]> };
    const supabase = createContentAdminSupabaseClient();
    const table = entityTables[entity as AdminEntity];
    if (!table) throw new Error("Unsupported entity.");
    const id = (parsed.data as { id?: string | null }).id;
    const data = { ...(parsed.data as Record<string, unknown>) };
    delete data.id;
    const query = id ? supabase.from(table).update(data).eq("id", id).select("id").single() : supabase.from(table).insert(data).select("id").single();
    const { data: saved, error } = await query;
    if (error) throw new Error(error.message);
    revalidateContentAdmin();
    return { ok: true, success: true, message: id ? "Saved changes." : "Created successfully.", id: (saved as { id: string }).id };
  } catch (error) {
    return { ok: false, success: false, message: error instanceof Error ? error.message : "Unable to save." };
  }
}

export async function toggleAdminEntityAction(entity: keyof typeof schemas, id: string, active: boolean): Promise<AdminMutationState> {
  try {
    await ensureContentAdmin(entity as AdminEntity);
    const parsedId = z.string().uuid().parse(id);
    const table = entityTables[entity as AdminEntity];
    if (!table) throw new Error("Unsupported entity.");
    const supabase = createContentAdminSupabaseClient();
    const { error } = await supabase.from(table).update({ is_active: active }).eq("id", parsedId);
    if (error) throw new Error(error.message);
    revalidateContentAdmin();
    return { ok: true, success: true, message: active ? "Activated." : "Deactivated." };
  } catch (error) {
    return { ok: false, success: false, message: error instanceof Error ? error.message : "Unable to update status." };
  }
}

const postSchema = z.object({
  id: z.string().uuid().optional().nullable(),
  title: z.string().trim().min(1, "Title is required for publish.").max(220),
  slug: slugSchema,
  excerpt: z.string().trim().min(1, "Excerpt is required for publish.").max(1000),
  answer_summary: z.string().trim().max(2000).optional().nullable().transform((value) => value || null),
  key_takeaways: z.string().trim().optional().nullable().transform((value) => value ? value.split("\n").map((item) => item.trim()).filter(Boolean) : null),
  content_markdown: z.string().trim().min(1, "Markdown content is required for publish."),
  featured_image_url: optionalUrl,
  featured_image_alt: z.string().trim().max(180).optional().nullable().transform((value) => value || null),
  category_id: z.string().uuid("Choose a category."),
  author_id: z.string().uuid("Choose an author."),
  status: z.enum(["draft","review","published","archived"]),
  content_format: z.enum(["article","video_companion","comparison","resource_guide","case_study","farm_field_note"]),
  post_type: z.enum(["guide","tutorial","buying_guide","review","comparison","case_study","market_insight","farm_update"]),
  audience_scope: z.enum(["nigeria","africa","global"]),
  is_featured: bool,
  contains_affiliate_content: bool,
  custom_affiliate_disclosure: z.string().trim().max(1000).optional().nullable().transform((value) => value || null),
  recommendation_methodology: z.string().trim().max(2000).optional().nullable().transform((value) => value || null),
  seo_title: z.string().trim().max(180).optional().nullable().transform((value) => value || null),
  seo_description: z.string().trim().max(300).optional().nullable().transform((value) => value || null),
  external_canonical_url: optionalUrl,
  published_at: optionalDate,
  tag_ids: z.array(z.string().uuid()).default([]),
  source_ids: z.array(z.string().uuid()).default([]),
  product_links: z.array(z.object({ product_id: z.string().uuid(), sort_order: z.coerce.number().int().default(100), custom_context: z.string().trim().max(500).optional().nullable().transform((value) => value || null) })).default([]),
  offer_links: z.array(z.object({ offer_id: z.string().uuid(), sort_order: z.coerce.number().int().default(100), best_for: z.string().trim().max(220).optional().nullable().transform((value) => value || null), editorial_verdict: z.string().trim().max(1000).optional().nullable().transform((value) => value || null), pros: z.string().trim().optional().nullable().transform((value) => value ? value.split("\n").map((item) => item.trim()).filter(Boolean) : null), cons: z.string().trim().optional().nullable().transform((value) => value ? value.split("\n").map((item) => item.trim()).filter(Boolean) : null) })).default([]),
  action: z.enum(["draft","continue","review","publish","unpublish","archive"]).default("draft"),
}).refine((value) => !value.featured_image_url || Boolean(value.featured_image_alt), { path: ["featured_image_alt"], message: "Featured image alt text is required." })
  .refine((value) => value.action !== "publish" || value.content_markdown.length >= 120, { path: ["content_markdown"], message: "Published content needs at least 120 characters." })
  .refine((value) => value.action !== "publish" || !value.contains_affiliate_content || Boolean(value.custom_affiliate_disclosure || value.recommendation_methodology), { path: ["custom_affiliate_disclosure"], message: "Affiliate posts need disclosure or methodology notes before publishing." });

export async function savePostAction(payload: Record<string, unknown>): Promise<AdminMutationState> {
  try {
    await ensureContentAdmin("posts");
    const parsed = postSchema.safeParse(payload);
    if (!parsed.success) return { ok: false, success: false, message: "Please correct the highlighted fields.", fieldErrors: parsed.error.flatten().fieldErrors as Record<string, string[]> };
    const supabase = createContentAdminSupabaseClient();
    const value = parsed.data;
    const status = value.action === "publish" ? "published" : value.action === "review" ? "review" : value.action === "archive" ? "archived" : value.action === "unpublish" ? "draft" : value.status;
    const postPayload = {
      title: value.title,
      slug: value.slug,
      excerpt: value.excerpt,
      answer_summary: value.answer_summary,
      key_takeaways: value.key_takeaways,
      content_markdown: value.content_markdown,
      featured_image_url: value.featured_image_url,
      featured_image_alt: value.featured_image_alt,
      category_id: value.category_id,
      author_id: value.author_id,
      status,
      content_format: value.content_format,
      post_type: value.post_type,
      audience_scope: value.audience_scope,
      is_featured: value.is_featured,
      contains_affiliate_content: value.contains_affiliate_content,
      custom_affiliate_disclosure: value.custom_affiliate_disclosure,
      recommendation_methodology: value.recommendation_methodology,
      seo_title: value.seo_title,
      seo_description: value.seo_description,
      external_canonical_url: value.external_canonical_url,
      published_at: status === "published" ? value.published_at || new Date().toISOString() : value.published_at,
      reviewed_at: status === "review" || status === "published" ? new Date().toISOString() : null,
    };
    const existing = value.id ? await supabase.from("content_posts").select("slug,status").eq("id", value.id).single() : null;
    if (existing?.data && (existing.data as { status: string; slug: string }).status === "published" && (existing.data as { slug: string }).slug !== value.slug) {
      throw new Error("Published slugs should not change silently. Unpublish first if a slug change is required.");
    }
    const query = value.id ? supabase.from("content_posts").update(postPayload).eq("id", value.id).select("id,slug").single() : supabase.from("content_posts").insert(postPayload).select("id,slug").single();
    const { data, error } = await query;
    if (error) throw new Error(error.message);
    const postId = (data as { id: string }).id;
    await Promise.all([
      supabase.from("content_post_tags").delete().eq("post_id", postId),
      supabase.from("content_post_sources").delete().eq("post_id", postId),
      supabase.from("content_post_products").delete().eq("post_id", postId),
      supabase.from("content_post_affiliate_offers").delete().eq("post_id", postId),
    ]);
    const inserts = [];
    if (value.tag_ids.length) inserts.push(supabase.from("content_post_tags").insert(value.tag_ids.map((tag_id) => ({ post_id: postId, tag_id }))));
    if (value.source_ids.length) inserts.push(supabase.from("content_post_sources").insert(value.source_ids.map((source_id, index) => ({ post_id: postId, source_id, sort_order: index + 1 }))));
    if (value.product_links.length) inserts.push(supabase.from("content_post_products").insert(value.product_links.map((link) => ({ post_id: postId, ...link }))));
    if (value.offer_links.length) inserts.push(supabase.from("content_post_affiliate_offers").insert(value.offer_links.map((link) => ({ post_id: postId, ...link }))));
    const relationResults = await Promise.all(inserts);
    const relationError = relationResults.find((result) => result.error)?.error;
    if (relationError) throw new Error(relationError.message);
    revalidateContentAdmin();
    revalidatePath(`/blog/${value.slug}`);
    return { ok: true, success: true, message: status === "published" ? "Article published." : "Article saved.", id: postId };
  } catch (error) {
    return { ok: false, success: false, message: error instanceof Error ? error.message : "Unable to save article." };
  }
}
