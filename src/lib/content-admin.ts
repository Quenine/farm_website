import "server-only";

import { contentPublicConfig } from "@/src/config/site";
import { requireAdmin } from "@/src/lib/admin-auth";
import { createAdminSupabaseClient } from "@/src/lib/supabase/admin";
import { hasAdminSupabaseConfig } from "@/src/lib/supabase/config";
import { formatNaira } from "@/src/lib/format";

export type AdminEntity = "authors" | "categories" | "tags" | "sources" | "posts" | "partners" | "offers" | "videos" | "subscribers";

export type AdminRecord = Record<string, unknown>;

const tables: Record<AdminEntity, string> = {
  authors: "content_authors",
  categories: "content_categories",
  tags: "content_tags",
  sources: "content_sources",
  posts: "content_posts",
  partners: "affiliate_partners",
  offers: "affiliate_offers",
  videos: "content_videos",
  subscribers: "content_subscribers",
};

const selectColumns: Record<AdminEntity, string> = {
  authors: "id,name,slug,role_title,bio,avatar_url,avatar_alt,credentials_or_experience,is_active,updated_at,content_posts(count)",
  categories: "id,name,slug,description,seo_title,seo_description,sort_order,is_active,updated_at,content_posts(count)",
  tags: "id,name,slug,description,is_active,updated_at,content_post_tags(count)",
  sources: "id,title,publisher,url,source_type,publication_date,accessed_at,is_primary_source,internal_note,is_active,updated_at,content_post_sources(count)",
  posts: "id,title,slug,excerpt,status,content_format,post_type,audience_scope,contains_affiliate_content,is_featured,published_at,updated_at,content_categories(name,slug),content_authors(name,slug)",
  partners: "id,name,slug,website_url,affiliate_network,default_disclosure,internal_notes,is_active,updated_at,affiliate_offers(count)",
  offers: "id,partner_id,title,slug,short_description,destination_url,image_url,image_alt,button_label,display_price,currency,price_last_checked_at,available_regions,recommendation_basis,is_featured,is_active,internal_commission_note,updated_at,affiliate_partners(name,slug),affiliate_clicks(count),content_post_affiliate_offers(count)",
  videos: "id,post_id,platform,external_video_id,embed_url,watch_url,title,description,thumbnail_url,thumbnail_alt,duration_seconds,upload_date,transcript_markdown,chapters,is_active,updated_at,content_posts(title,slug)",
  subscribers: "id,email,status,source_path,subscription_topic,consented_at,unsubscribed_at,created_at,updated_at",
};

function contentFeatureEnabled(entity: AdminEntity) {
  if (entity === "partners" || entity === "offers") return contentPublicConfig.affiliateEnabled;
  if (entity === "subscribers") return contentPublicConfig.subscriptionsEnabled;
  return contentPublicConfig.hubEnabled;
}

export async function ensureContentAdmin(entity: AdminEntity) {
  await requireAdmin();
  if (!contentFeatureEnabled(entity)) throw new Error("This content feature is disabled for this brand.");
  if (!hasAdminSupabaseConfig()) throw new Error("Supabase admin configuration is required.");
}

function likeFilter(query: unknown, entity: AdminEntity, search: string) {
  const q = query as { or: (value: string) => unknown };
  const value = search.trim();
  if (!value) return query;
  const safe = value.replace(/[,%]/g, " ").trim();
  if (!safe) return query;
  const columns: Record<AdminEntity, string[]> = {
    authors: ["name", "slug", "role_title", "bio"],
    categories: ["name", "slug", "description"],
    tags: ["name", "slug", "description"],
    sources: ["title", "publisher", "url"],
    posts: ["title", "slug", "excerpt"],
    partners: ["name", "slug", "affiliate_network", "website_url"],
    offers: ["title", "slug", "short_description", "destination_url"],
    videos: ["title", "platform", "external_video_id"],
    subscribers: ["email", "source_path", "subscription_topic"],
  };
  return q.or(columns[entity].map((column) => `${column}.ilike.%${safe}%`).join(","));
}

export async function loadAdminEntity(entity: AdminEntity, filters: Record<string, string | undefined> = {}) {
  await ensureContentAdmin(entity);
  const supabase = createAdminSupabaseClient();
  const page = Math.max(1, Number(filters.page ?? 1));
  const pageSize = 25;
  let query = supabase
    .from(tables[entity])
    .select(selectColumns[entity], { count: "exact" })
    .range((page - 1) * pageSize, page * pageSize - 1);

  query = likeFilter(query, entity, filters.q ?? "") as typeof query;
  if (filters.active && filters.active !== "all" && ["authors", "categories", "tags", "sources", "partners", "offers", "videos"].includes(entity)) query = query.eq("is_active", filters.active === "active");
  if (entity === "posts") {
    if (filters.status && filters.status !== "all") query = query.eq("status", filters.status);
    if (filters.format && filters.format !== "all") query = query.eq("content_format", filters.format);
    if (filters.postType && filters.postType !== "all") query = query.eq("post_type", filters.postType);
    if (filters.audience && filters.audience !== "all") query = query.eq("audience_scope", filters.audience);
    if (filters.affiliate === "yes") query = query.eq("contains_affiliate_content", true);
    if (filters.affiliate === "no") query = query.eq("contains_affiliate_content", false);
    if (filters.sort === "published") query = query.order("published_at", { ascending: false, nullsFirst: false });
    else if (filters.sort === "title") query = query.order("title", { ascending: true });
    else query = query.order("updated_at", { ascending: false });
  } else if (entity === "categories") {
    query = query.order("sort_order", { ascending: true }).order("name", { ascending: true });
  } else if (entity === "subscribers") {
    if (filters.status && filters.status !== "all") query = query.eq("status", filters.status);
    if (filters.topic && filters.topic !== "all") query = query.eq("subscription_topic", filters.topic);
    query = query.order("created_at", { ascending: false });
  } else if (entity === "sources") {
    if (filters.sourceType && filters.sourceType !== "all") query = query.eq("source_type", filters.sourceType);
    if (filters.primary === "yes") query = query.eq("is_primary_source", true);
    if (filters.primary === "no") query = query.eq("is_primary_source", false);
    query = query.order("updated_at", { ascending: false });
  } else if (entity === "offers") {
    if (filters.partnerId && filters.partnerId !== "all") query = query.eq("partner_id", filters.partnerId);
    if (filters.basis && filters.basis !== "all") query = query.eq("recommendation_basis", filters.basis);
    query = query.order("updated_at", { ascending: false });
  } else if (entity === "videos") {
    if (filters.platform && filters.platform !== "all") query = query.eq("platform", filters.platform);
    query = query.order("updated_at", { ascending: false });
  } else {
    query = query.order("updated_at", { ascending: false });
  }

  const { data, error, count } = await query;
  if (error) throw new Error(error.message);
  return { records: (data ?? []) as unknown as AdminRecord[], count: count ?? 0, page, pageSize };
}

export async function loadAdminOptions() {
  await requireAdmin();
  if (!hasAdminSupabaseConfig()) return { authors: [], categories: [], tags: [], sources: [], products: [], partners: [], offers: [], posts: [] };
  const supabase = createAdminSupabaseClient();
  const [authors, categories, tags, sources, products, partners, offers, posts] = await Promise.all([
    contentPublicConfig.hubEnabled ? supabase.from("content_authors").select("id,name,slug,is_active").order("name") : Promise.resolve({ data: [] }),
    contentPublicConfig.hubEnabled ? supabase.from("content_categories").select("id,name,slug,is_active").order("sort_order").order("name") : Promise.resolve({ data: [] }),
    contentPublicConfig.hubEnabled ? supabase.from("content_tags").select("id,name,slug,is_active").order("name") : Promise.resolve({ data: [] }),
    contentPublicConfig.hubEnabled ? supabase.from("content_sources").select("id,title,url,is_active").order("title") : Promise.resolve({ data: [] }),
    contentPublicConfig.hubEnabled ? supabase.from("products").select("id,name,slug,price,unit,status,stock_quantity,product_media(url,alt_text,is_primary)").order("name") : Promise.resolve({ data: [] }),
    contentPublicConfig.affiliateEnabled ? supabase.from("affiliate_partners").select("id,name,slug,is_active").order("name") : Promise.resolve({ data: [] }),
    contentPublicConfig.affiliateEnabled ? supabase.from("affiliate_offers").select("id,title,slug,is_active").order("title") : Promise.resolve({ data: [] }),
    contentPublicConfig.hubEnabled ? supabase.from("content_posts").select("id,title,slug,status").order("updated_at", { ascending: false }).limit(200) : Promise.resolve({ data: [] }),
  ]);
  return {
    authors: authors.data ?? [],
    categories: categories.data ?? [],
    tags: tags.data ?? [],
    sources: sources.data ?? [],
    products: products.data ?? [],
    partners: partners.data ?? [],
    offers: offers.data ?? [],
    posts: posts.data ?? [],
  };
}

export async function loadPostForEdit(id: string) {
  await ensureContentAdmin("posts");
  const supabase = createAdminSupabaseClient();
  const { data, error } = await supabase
    .from("content_posts")
    .select("*, content_post_tags(tag_id), content_post_sources(source_id), content_post_products(product_id,sort_order,custom_context), content_post_affiliate_offers(offer_id,sort_order,best_for,editorial_verdict,pros,cons), content_videos(*)")
    .eq("id", id)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data as AdminRecord | null;
}

export async function loadContentDashboard() {
  await ensureContentAdmin("posts");
  const supabase = createAdminSupabaseClient();
  const [posts, affiliateClicks, productClicks, subscribers, paidOrders] = await Promise.all([
    supabase.from("content_posts").select("id,status,content_format,contains_affiliate_content"),
    supabase.from("affiliate_clicks").select("id", { count: "exact", head: true }),
    supabase.from("content_product_clicks").select("id", { count: "exact", head: true }),
    contentPublicConfig.subscriptionsEnabled ? supabase.from("content_subscribers").select("id", { count: "exact", head: true }).eq("status", "active") : Promise.resolve({ count: 0 }),
    supabase.from("orders").select("id,total_amount,payment_status,content_attribution").eq("payment_status", "paid").not("content_attribution", "is", null).limit(500),
  ]);
  const rows = (posts.data ?? []) as Array<{ status: string; content_format: string; contains_affiliate_content: boolean }>;
  const orders = (paidOrders.data ?? []) as Array<{ total_amount: number | string }>;
  return {
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
    contentAssistedPaidOrders: orders.length,
    contentAssistedPaidRevenue: orders.reduce((sum, order) => sum + Number(order.total_amount ?? 0), 0),
  };
}

export async function loadAffiliateDashboard() {
  await ensureContentAdmin("partners");
  const supabase = createAdminSupabaseClient();
  const [partners, offers, clicks, topOffers, topPosts] = await Promise.all([
    supabase.from("affiliate_partners").select("id,is_active"),
    supabase.from("affiliate_offers").select("id,is_active"),
    supabase.from("affiliate_clicks").select("id", { count: "exact", head: true }),
    supabase.from("affiliate_clicks").select("offer_id, affiliate_offers(title,slug)").limit(1000),
    supabase.from("affiliate_clicks").select("post_id, content_posts(title,slug)").limit(1000),
  ]);
  function aggregate(rows: AdminRecord[], idKey: string, relationKey: string) {
    const map = new Map<string, { label: string; count: number }>();
    for (const row of rows) {
      const id = String(row[idKey] ?? "");
      if (!id) continue;
      const rel = Array.isArray(row[relationKey]) ? (row[relationKey] as AdminRecord[])[0] : row[relationKey] as AdminRecord | undefined;
      const label = String(rel?.title ?? rel?.slug ?? id);
      map.set(id, { label, count: (map.get(id)?.count ?? 0) + 1 });
    }
    return [...map.values()].sort((a, b) => b.count - a.count).slice(0, 8);
  }
  const partnerRows = (partners.data ?? []) as Array<{ is_active: boolean }>;
  const offerRows = (offers.data ?? []) as Array<{ is_active: boolean }>;
  return {
    totalPartners: partnerRows.length,
    activePartners: partnerRows.filter((row) => row.is_active).length,
    totalOffers: offerRows.length,
    activeOffers: offerRows.filter((row) => row.is_active).length,
    affiliateClicks: clicks.count ?? 0,
    topOffers: aggregate((topOffers.data ?? []) as unknown as AdminRecord[], "offer_id", "affiliate_offers"),
    topPosts: aggregate((topPosts.data ?? []) as unknown as AdminRecord[], "post_id", "content_posts"),
  };
}

export async function loadCommerceReport() {
  await ensureContentAdmin("posts");
  const supabase = createAdminSupabaseClient();
  const [clicks, orders, relationships] = await Promise.all([
    supabase.from("content_product_clicks").select("post_id,product_id,clicked_at,content_posts(title,slug),products(name,slug)").order("clicked_at", { ascending: false }).limit(500),
    supabase.from("orders").select("id,order_reference,total_amount,payment_status,created_at,content_attribution").not("content_attribution", "is", null).order("created_at", { ascending: false }).limit(100),
    supabase.from("content_post_products").select("post_id,product_id,sort_order,custom_context,content_posts(title,slug),products(name,slug,price,unit)").order("sort_order"),
  ]);
  const clickRows = (clicks.data ?? []) as unknown as AdminRecord[];
  const orderRows = (orders.data ?? []) as Array<{ total_amount: number | string; payment_status: string }>;
  function top(rows: AdminRecord[], key: string, rel: string) {
    const map = new Map<string, { label: string; count: number }>();
    for (const row of rows) {
      const id = String(row[key] ?? "");
      if (!id) continue;
      const relation = Array.isArray(row[rel]) ? (row[rel] as AdminRecord[])[0] : row[rel] as AdminRecord | undefined;
      const label = String(relation?.title ?? relation?.name ?? relation?.slug ?? id);
      map.set(id, { label, count: (map.get(id)?.count ?? 0) + 1 });
    }
    return [...map.values()].sort((a, b) => b.count - a.count).slice(0, 10);
  }
  const paid = orderRows.filter((order) => order.payment_status === "paid");
  return {
    productClicks: clickRows.length,
    contentAssistedOrders: orderRows.length,
    contentAssistedPaidOrders: paid.length,
    contentAssistedPaidRevenue: formatNaira(paid.reduce((sum, order) => sum + Number(order.total_amount ?? 0), 0)),
    topPosts: top(clickRows, "post_id", "content_posts"),
    topProducts: top(clickRows, "product_id", "products"),
    recentOrders: orders.data ?? [],
    relationships: relationships.data ?? [],
  };
}
