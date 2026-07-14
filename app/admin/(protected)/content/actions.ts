"use server";

import "server-only";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { ensureContentAdmin, type AdminEntity } from "@/src/lib/content-admin";
import { createContentAdminSupabaseClient } from "@/src/lib/supabase/content-admin-server";

export type SavedPostSummary = { id: string; slug: string; status: string; publishedAt: string | null; updatedAt: string };
export type AdminMutationState = { ok: true; success: true; message: string; id?: string; post?: SavedPostSummary; fieldErrors: Record<string, string[]> } | { ok: false; success: false; message: string; fieldErrors: Record<string, string[]> };
export type ContentImageUploadResult = { success: true; url: string; path: string } | { success: false; message: string; fieldErrors?: Record<string, string[]> };

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
  revalidatePath("/admin");
  revalidatePath("/admin/content");
  revalidatePath("/admin/content/posts");
  revalidatePath("/admin/affiliate");
  revalidatePath("/blog");
  revalidatePath("/resources");
  revalidatePath("/videos");
  revalidatePath("/tools");
  revalidatePath("/blog/feed.xml");
  revalidatePath("/sitemap.xml");
}

async function revalidateContentMutation(input: { supabase: ReturnType<typeof createContentAdminSupabaseClient>; oldSlug?: string | null; newSlug?: string | null }) {
  revalidateContentAdmin();
  const paths = new Set(["/blog", "/resources", "/videos", "/blog/feed.xml", "/sitemap.xml"]);
  if (input.newSlug) paths.add(`/blog/${input.newSlug}`);
  if (input.oldSlug && input.oldSlug !== input.newSlug) paths.add(`/blog/${input.oldSlug}`);
  const [categories, tags] = await Promise.all([
    input.supabase.from("content_categories").select("slug").eq("is_active", true),
    input.supabase.from("content_tags").select("slug").eq("is_active", true),
  ]);
  for (const category of categories.data ?? []) paths.add(`/blog/category/${category.slug}`);
  for (const tag of tags.data ?? []) paths.add(`/blog/tag/${tag.slug}`);
  for (const path of paths) revalidatePath(path);
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
    return { ok: true, success: true, message: id ? "Saved changes." : "Created successfully.", id: (saved as { id: string }).id, fieldErrors: {} };
  } catch (error) {
    return { ok: false, success: false, message: error instanceof Error ? error.message : "Unable to save.", fieldErrors: {} };
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
    return { ok: true, success: true, message: active ? "Activated." : "Deactivated.", fieldErrors: {} };
  } catch (error) {
    return { ok: false, success: false, message: error instanceof Error ? error.message : "Unable to update status.", fieldErrors: {} };
  }
}

type PostAction = "draft" | "continue" | "review" | "publish" | "unpublish" | "archive";
type FieldErrors = Record<string, string[]>;

const postActions = ["draft", "continue", "review", "publish", "unpublish", "archive"] as const;
const contentFormats = ["article", "video_companion", "comparison", "resource_guide", "case_study", "farm_field_note"] as const;
const postTypes = ["guide", "tutorial", "buying_guide", "review", "comparison", "case_study", "market_insight", "farm_update"] as const;
const audienceScopes = ["nigeria", "africa", "global"] as const;

function stringField(payload: Record<string, unknown>, key: string) {
  const value = payload[key];
  return typeof value === "string" ? value.trim() : "";
}

function boolField(payload: Record<string, unknown>, key: string) {
  return payload[key] === true;
}

function enumField<T extends readonly string[]>(payload: Record<string, unknown>, key: string, values: T, fallback: T[number]) {
  const value = stringField(payload, key);
  return (values as readonly string[]).includes(value) ? value as T[number] : fallback;
}

function optionalUuid(value: unknown) {
  const parsed = z.string().uuid().safeParse(value);
  return parsed.success ? parsed.data : null;
}

function uuidList(value: unknown) {
  return Array.isArray(value) ? value.map((item) => optionalUuid(item)).filter(Boolean) as string[] : [];
}

function slugFromTitle(value: string) {
  return value.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/-+/g, "-").replace(/(^-|-$)/g, "");
}

function validateSlug(value: string) {
  return /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(value);
}

async function uniqueSlug(supabase: ReturnType<typeof createContentAdminSupabaseClient>, base: string, existingId: string | null) {
  for (let index = 0; index < 50; index += 1) {
    const candidate = index === 0 ? base : `${base}-${index + 1}`;
    const { data, error } = await supabase.from("content_posts").select("id").eq("slug", candidate).maybeSingle();
    if (error) throw new Error(error.message);
    if (!data || data.id === existingId) return candidate;
  }
  return `${base}-${Date.now().toString(36)}`;
}

function addError(errors: FieldErrors, key: string, message: string) {
  errors[key] = [...(errors[key] ?? []), message];
}

function addMarkdownImageErrors(errors: FieldErrors, markdown: string) {
  const imagePattern = /!\[([^\]]*)\]\(([^\s)]+)(?:\s+"[^"]*")?\)/g;
  let match: RegExpExecArray | null;
  let index = 0;
  while ((match = imagePattern.exec(markdown)) !== null) {
    index += 1;
    const alt = match[1]?.trim() ?? "";
    const src = match[2]?.trim() ?? "";
    if (!alt) addError(errors, "content_markdown", `Inline image ${index} requires descriptive alt text.`);
    if (!/^(https?:\/\/|\/)/i.test(src)) addError(errors, "content_markdown", `Inline image ${index} uses an unsafe or unsupported URL.`);
    if (/^(javascript:|data:)/i.test(src)) addError(errors, "content_markdown", `Inline image ${index} uses an unsafe URL scheme.`);
  }
  const malformedCount = (markdown.match(/!\[/g) ?? []).length;
  if (malformedCount > index) addError(errors, "content_markdown", "One or more inline images appear malformed. Use ![alt text](https://example.com/image.jpg). ");
}


function affiliateTokenSlugs(markdown: string) {
  const slugs = new Set<string>();
  const pattern = /\[\[affiliate:([^\]]+)\]\]/gi;
  let match: RegExpExecArray | null;
  while ((match = pattern.exec(markdown)) !== null) {
    const slug = match[1]?.trim();
    if (slug) slugs.add(slug);
  }
  return [...slugs];
}

function hasMeaningfulMethodology(value: string | null) {
  const text = value?.trim();
  if (!text) return false;
  return !/^(try it out|test|n\/?a|properly disclosed)$/i.test(text);
}

function relationOne<T>(value: T | T[] | null | undefined): T | null {
  return Array.isArray(value) ? value[0] ?? null : value ?? null;
}

function relationLinks(payload: Record<string, unknown>) {
  const rawProducts = Array.isArray(payload.product_links) ? payload.product_links : [];
  const rawOffers = Array.isArray(payload.offer_links) ? payload.offer_links : [];
  return {
    tagIds: uuidList(payload.tag_ids),
    sourceIds: uuidList(payload.source_ids),
    productLinks: rawProducts.map((item) => {
      const row = item && typeof item === "object" ? item as Record<string, unknown> : {};
      const product_id = optionalUuid(row.product_id);
      return product_id ? {
        product_id,
        sort_order: Number.isFinite(Number(row.sort_order)) ? Number(row.sort_order) : 100,
        custom_context: typeof row.custom_context === "string" && row.custom_context.trim() ? row.custom_context.trim() : null,
      } : null;
    }).filter(Boolean) as Array<{ product_id: string; sort_order: number; custom_context: string | null }>,
    offerLinks: Array.from(new Map(rawOffers.map((item, index) => {
      const row = item && typeof item === "object" ? item as Record<string, unknown> : {};
      const offer_id = optionalUuid(row.offer_id);
      return offer_id ? [offer_id, {
        offer_id,
        sort_order: Number.isFinite(Number(row.sort_order)) ? Number(row.sort_order) : index + 1,
        best_for: typeof row.best_for === "string" && row.best_for.trim() ? row.best_for.trim() : null,
        editorial_verdict: typeof row.editorial_verdict === "string" && row.editorial_verdict.trim() ? row.editorial_verdict.trim() : null,
        pros: Array.isArray(row.pros) ? row.pros.filter((value): value is string => typeof value === "string" && Boolean(value.trim())).map((value) => value.trim()) : null,
        cons: Array.isArray(row.cons) ? row.cons.filter((value): value is string => typeof value === "string" && Boolean(value.trim())).map((value) => value.trim()) : null,
      }] as const : null;
    }).filter(Boolean) as Array<readonly [string, { offer_id: string; sort_order: number; best_for: string | null; editorial_verdict: string | null; pros: string[] | null; cons: string[] | null }]>).values()),
  };
}

async function validatePostPayload(payload: Record<string, unknown>, supabase: ReturnType<typeof createContentAdminSupabaseClient>) {
  const errors: FieldErrors = {};
  const action = enumField(payload, "action", postActions, "draft") as PostAction;
  const id = optionalUuid(payload.id);
  const title = stringField(payload, "title");
  const excerpt = stringField(payload, "excerpt");
  const content_markdown = typeof payload.content_markdown === "string" ? payload.content_markdown : "";
  const rawSlug = slugFromTitle(stringField(payload, "slug"));
  let slug = rawSlug || slugFromTitle(title);
  const author_id = optionalUuid(payload.author_id);
  const category_id = optionalUuid(payload.category_id);
  const featured_image_url = stringField(payload, "featured_image_url") || null;
  const featured_image_alt = stringField(payload, "featured_image_alt") || null;
  const clientPublishedAt = stringField(payload, "published_at") || null;
  const contains_affiliate_content = boolField(payload, "contains_affiliate_content");
  const custom_affiliate_disclosure = stringField(payload, "custom_affiliate_disclosure") || null;
  const recommendation_methodology = stringField(payload, "recommendation_methodology") || null;
  const external_canonical_url = stringField(payload, "external_canonical_url") || null;
  const links = relationLinks(payload);

  if (!title) addError(errors, "title", "Title is required to save a draft.");
  if (!slug) addError(errors, "slug", "Enter a title so a slug can be generated.");
  else if (!validateSlug(slug)) addError(errors, "slug", "Use lowercase letters, numbers, and hyphens only.");
  if (featured_image_url && !/^https?:\/\//i.test(featured_image_url)) addError(errors, "featured_image_url", "Enter an HTTP or HTTPS URL.");
  if (featured_image_url && !featured_image_alt) addError(errors, "featured_image_alt", "Featured image alt text is required when a featured image exists.");
  if (external_canonical_url && !/^https?:\/\//i.test(external_canonical_url)) addError(errors, "external_canonical_url", "Enter an HTTP or HTTPS URL.");

  const needsReviewFields = action === "review" || action === "publish";
  if (needsReviewFields) {
    if (!excerpt) addError(errors, "excerpt", "Excerpt is required before review or publication.");
    if (content_markdown.trim().length < 120) addError(errors, "content_markdown", "Add meaningful article content before sending to review or publication.");
    if (!author_id) addError(errors, "author_id", "Author is required before review or publication.");
    if (!category_id) addError(errors, "category_id", "Category is required before review or publication.");
    addMarkdownImageErrors(errors, content_markdown);
  }

  const affiliateSlugs = affiliateTokenSlugs(content_markdown);
  const hasComparisonToken = /\[\[comparison:post-offers\]\]/i.test(content_markdown);
  const hasAffiliateRecommendations = contains_affiliate_content || links.offerLinks.length > 0 || affiliateSlugs.length > 0 || hasComparisonToken || /\[\[recommend:/i.test(content_markdown);
  const standardAffiliateDisclosureIsRendered = true;

  if (needsReviewFields && hasAffiliateRecommendations) {
    if (!standardAffiliateDisclosureIsRendered) addError(errors, "contains_affiliate_content", "Standard affiliate disclosure must be available before review or publication.");
    if (!hasMeaningfulMethodology(recommendation_methodology)) {
      addError(errors, "recommendation_methodology", "Add meaningful recommendation methodology. Placeholder text such as Try it out, Test, N/A, or Properly disclosed is not accepted.");
    }
    if (hasComparisonToken && links.offerLinks.length < 2) {
      addError(errors, "offer_links", "Attach at least two affiliate offers before inserting a comparison.");
    }

    const linkedOfferIds = [...new Set(links.offerLinks.map((link) => link.offer_id))];
    const offerRows: Array<{ id: string; slug: string; title: string; is_active: boolean; affiliate_partners?: { name?: string; is_active?: boolean } | Array<{ name?: string; is_active?: boolean }> | null }> = [];
    if (linkedOfferIds.length) {
      const { data, error } = await supabase.from("affiliate_offers").select("id,slug,title,is_active,affiliate_partners(name,is_active)").in("id", linkedOfferIds);
      if (error) throw new Error(error.message);
      offerRows.push(...((data ?? []) as typeof offerRows));
    }
    if (affiliateSlugs.length) {
      const missingSlugs = affiliateSlugs.filter((slug) => !offerRows.some((offer) => offer.slug === slug));
      if (missingSlugs.length) {
        const { data, error } = await supabase.from("affiliate_offers").select("id,slug,title,is_active,affiliate_partners(name,is_active)").in("slug", missingSlugs);
        if (error) throw new Error(error.message);
        offerRows.push(...((data ?? []) as typeof offerRows));
      }
    }

    const offersById = new Map(offerRows.map((offer) => [offer.id, offer]));
    const offersBySlug = new Map(offerRows.map((offer) => [offer.slug, offer]));
    for (const offerId of linkedOfferIds) {
      const offer = offersById.get(offerId);
      if (!offer) addError(errors, "offer_links", "One attached affiliate offer no longer exists.");
      else if (!offer.is_active) addError(errors, "offer_links", `Attached affiliate offer "${offer.title}" is inactive.`);
      const partner = relationOne(offer?.affiliate_partners);
      if (offer && partner?.is_active === false) addError(errors, "offer_links", `Affiliate partner for "${offer.title}" is inactive.`);
    }
    const attachedIds = new Set(linkedOfferIds);
    for (const slug of affiliateSlugs) {
      const offer = offersBySlug.get(slug);
      if (!offer) addError(errors, "content_markdown", `Affiliate token references an unknown offer: ${slug}.`);
      else if (!attachedIds.has(offer.id)) addError(errors, "offer_links", `Attach the affiliate offer used by token [[affiliate:${slug}]].`);
      else if (!offer.is_active) addError(errors, "content_markdown", `Affiliate token [[affiliate:${slug}]] references an inactive offer.`);
      const partner = relationOne(offer?.affiliate_partners);
      if (offer && partner?.is_active === false) addError(errors, "content_markdown", `Affiliate token [[affiliate:${slug}]] belongs to an inactive partner.`);
    }
  }

  if (Object.keys(errors).length > 0) return { ok: false as const, errors };

  let existing: { slug: string; status: string; published_at: string | null } | null = null;
  if (id) {
    const existingResult = await supabase.from("content_posts").select("slug,status,published_at").eq("id", id).single();
    if (existingResult.error) throw new Error(existingResult.error.message);
    existing = existingResult.data as { slug: string; status: string; published_at: string | null };
  }

  slug = await uniqueSlug(supabase, slug, id);
  if (existing?.status === "published" && existing.slug !== slug) {
    return { ok: false as const, errors: { slug: ["Changing a published slug may break the old public URL. Unpublish first if a slug change is required."] } };
  }

  const status = action === "publish" ? "published" : action === "review" ? "review" : action === "archive" ? "archived" : action === "unpublish" ? "draft" : existing?.status === "published" ? "published" : "draft";
  const published_at = status === "published" ? (existing?.published_at ?? new Date().toISOString()) : clientPublishedAt;
  return { ok: true as const, value: {
    id,
    action,
    status,
    slug,
    title,
    excerpt,
    content_markdown,
    answer_summary: stringField(payload, "answer_summary") || null,
    key_takeaways: stringField(payload, "key_takeaways") ? stringField(payload, "key_takeaways").split("\n").map((item) => item.trim()).filter(Boolean) : null,
    featured_image_url,
    featured_image_alt,
    category_id,
    author_id,
    content_format: enumField(payload, "content_format", contentFormats, "article"),
    post_type: enumField(payload, "post_type", postTypes, "guide"),
    audience_scope: enumField(payload, "audience_scope", audienceScopes, "nigeria"),
    is_featured: boolField(payload, "is_featured"),
    contains_affiliate_content: contains_affiliate_content || links.offerLinks.length > 0 || affiliateSlugs.length > 0,
    custom_affiliate_disclosure,
    recommendation_methodology,
    seo_title: stringField(payload, "seo_title") || null,
    seo_description: stringField(payload, "seo_description") || null,
    external_canonical_url,
    published_at,
    tag_ids: links.tagIds,
    source_ids: links.sourceIds,
    product_links: links.productLinks,
    offer_links: links.offerLinks,
  } };
}

export async function savePostAction(payload: Record<string, unknown>): Promise<AdminMutationState> {
  try {
    await ensureContentAdmin("posts");
    const supabase = createContentAdminSupabaseClient();
    const parsed = await validatePostPayload(payload, supabase);
    if (!parsed.ok) return { ok: false, success: false, message: "Please correct the fields listed below.", fieldErrors: parsed.errors };
    const value = parsed.value;
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
      status: value.status,
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
      published_at: value.published_at,
      reviewed_at: value.status === "review" || value.status === "published" ? new Date().toISOString() : null,
    };
    const oldSlugResult = value.id ? await supabase.from("content_posts").select("slug,status,published_at").eq("id", value.id).single() : null;
    if (oldSlugResult?.error) throw new Error(oldSlugResult.error.message);
    const oldSlug = (oldSlugResult?.data as { slug?: string } | null)?.slug ?? null;
    const query = value.id ? supabase.from("content_posts").update(postPayload).eq("id", value.id).select("id,slug,status,published_at,updated_at").single() : supabase.from("content_posts").insert(postPayload).select("id,slug,status,published_at,updated_at").single();
    const { data, error } = await query;
    if (error) throw new Error(error.message);
    const savedPost = data as { id: string; slug: string; status: string; published_at: string | null; updated_at: string };
    const postId = savedPost.id;
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
    await revalidateContentMutation({ supabase, oldSlug, newSlug: savedPost.slug });
    const messages: Record<PostAction, string> = {
      draft: "Draft saved.",
      continue: "Draft saved. You can continue editing.",
      review: "Article sent for review.",
      publish: "Article published.",
      unpublish: "Draft saved.",
      archive: "Article archived.",
    };
    return { ok: true, success: true, message: messages[value.action], id: postId, post: { id: savedPost.id, slug: savedPost.slug, status: savedPost.status, publishedAt: savedPost.published_at, updatedAt: savedPost.updated_at }, fieldErrors: {} };
  } catch (error) {
    return { ok: false, success: false, message: error instanceof Error ? error.message : "Unable to save article.", fieldErrors: {} };
  }
}


const contentImageTypes: Record<string, string> = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp" };
const contentImageMaxBytes = 5 * 1024 * 1024;

export async function uploadContentImageAction(formData: FormData): Promise<ContentImageUploadResult> {
  try {
    await ensureContentAdmin("posts");
    const file = formData.get("file");
    if (!(file instanceof File)) return { success: false, message: "Choose an image to upload.", fieldErrors: { file: ["Choose an image to upload."] } };
    const extension = contentImageTypes[file.type];
    if (!extension) return { success: false, message: "Upload a JPEG, PNG, or WebP image. SVG files are not allowed.", fieldErrors: { file: ["Upload a JPEG, PNG, or WebP image. SVG files are not allowed."] } };
    if (file.size <= 0 || file.size > contentImageMaxBytes) return { success: false, message: "Image must be 5MB or smaller.", fieldErrors: { file: ["Image must be 5MB or smaller."] } };
    const supabase = createContentAdminSupabaseClient();
    const safeName = file.name.replace(/\.[^.]+$/, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "").slice(0, 80) || "content-image";
    const storagePath = `content/${new Date().toISOString().slice(0, 10)}/${crypto.randomUUID()}-${safeName}.${extension}`;
    const { error } = await supabase.storage.from("content-media").upload(storagePath, file, { contentType: file.type, cacheControl: "31536000", upsert: false });
    if (error) throw new Error(error.message);
    const { data } = supabase.storage.from("content-media").getPublicUrl(storagePath);
    return { success: true, url: data.publicUrl, path: storagePath };
  } catch (error) {
    return { success: false, message: error instanceof Error ? error.message : "Unable to upload image." };
  }
}
