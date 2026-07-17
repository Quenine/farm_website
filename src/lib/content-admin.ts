import "server-only";

import { contentPublicConfig } from "@/src/config/site";
import { requireAdmin } from "@/src/lib/admin-auth";
import { createContentAdminSupabaseClient } from "@/src/lib/supabase/content-admin-server";
import { hasAdminSupabaseConfig } from "@/src/lib/supabase/config";
import { formatNaira } from "@/src/lib/format";
import { assertSerializableAdminPayload, serializeAdminRecord } from "@/src/lib/admin-serialization";

export type AdminEntity = "authors" | "categories" | "tags" | "sources" | "posts" | "partners" | "offers" | "videos" | "subscribers";

import { adminEntityDefinitions, supportsTrash } from '@/src/lib/content-admin-entities.mjs';
export { adminEntityDefinitions, supportsTrash };

export type AdminRecord = Record<string, unknown>;

const tables = Object.fromEntries(Object.entries(adminEntityDefinitions).map(([entity, definition]) => [entity, definition.table])) as Record<AdminEntity, string>;
const selectColumns = Object.fromEntries(Object.entries(adminEntityDefinitions).map(([entity, definition]) => [entity, definition.select])) as Record<AdminEntity, string>;

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

async function countByColumn(table: string, column: string, ids: string[]) {
  if (ids.length === 0) return new Map<string, number>();
  const supabase = createContentAdminSupabaseClient();
  const { data, error } = await supabase.from(table).select(column).in(column, ids);
  if (error) {
    console.error("[Content Admin Count Failed]", { table, column, code: error.code, message: error.message });
    return new Map<string, number>();
  }
  const counts = new Map<string, number>();
  for (const row of (data ?? []) as unknown as Array<Record<string, unknown>>) {
    const id = String(row[column] ?? "");
    if (id) counts.set(id, (counts.get(id) ?? 0) + 1);
  }
  return counts;
}

function relationOne(value: unknown): AdminRecord | null {
  if (Array.isArray(value)) return (value[0] as AdminRecord | undefined) ?? null;
  return value && typeof value === "object" ? (value as AdminRecord) : null;
}

function flattenDisplayRelations(entity: AdminEntity, record: AdminRecord): AdminRecord {
  if (entity === "offers") {
    const partner = relationOne(record.affiliate_partners);
    const rest = { ...record };
    delete rest.affiliate_partners;
    return { ...rest, partner_name: partner?.name ?? null };
  }
  if (entity === "videos") {
    const post = relationOne(record.content_posts);
    const rest = { ...record };
    delete rest.content_posts;
    return { ...rest, post_title: post?.title ?? null };
  }
  return record;
}

function prepareClientRecords(entity: AdminEntity, records: AdminRecord[]) {
  const serialized = records.map((record) => serializeAdminRecord(flattenDisplayRelations(entity, record)));
  if (process.env.NODE_ENV !== "production") assertSerializableAdminPayload(serialized, entity + ".records");
  return serialized as AdminRecord[];
}

async function withSafeCounts(entity: AdminEntity, records: AdminRecord[]): Promise<AdminRecord[]> {
  const ids = records.map((record) => String(record.id ?? "")).filter(Boolean);
  if (ids.length === 0) return records;
  if (entity === "authors") {
    const counts = await countByColumn("content_posts", "author_id", ids);
    return records.map((record) => ({ ...record, post_count: counts.get(String(record.id)) ?? 0 }));
  }
  if (entity === "categories") {
    const counts = await countByColumn("content_posts", "category_id", ids);
    return records.map((record) => ({ ...record, post_count: counts.get(String(record.id)) ?? 0 }));
  }
  if (entity === "tags") {
    const counts = await countByColumn("content_post_tags", "tag_id", ids);
    return records.map((record) => ({ ...record, post_count: counts.get(String(record.id)) ?? 0 }));
  }
  if (entity === "sources") {
    const counts = await countByColumn("content_post_sources", "source_id", ids);
    return records.map((record) => ({ ...record, post_count: counts.get(String(record.id)) ?? 0 }));
  }
  if (entity === "partners") {
    const counts = await countByColumn("affiliate_offers", "partner_id", ids);
    return records.map((record) => ({ ...record, offer_count: counts.get(String(record.id)) ?? 0 }));
  }
  if (entity === "offers") {
    const [clicks, posts] = await Promise.all([
      countByColumn("affiliate_clicks", "offer_id", ids),
      countByColumn("content_post_affiliate_offers", "offer_id", ids),
    ]);
    return records.map((record) => ({ ...record, click_count: clicks.get(String(record.id)) ?? 0, post_count: posts.get(String(record.id)) ?? 0 }));
  }
  return records;
}

function diagnosticCode(entity: AdminEntity, stage: "LOAD" | "SERIALIZE") {
  const prefix: Record<AdminEntity, string> = {
    authors: "CONTENT-AUTHORS",
    categories: "CONTENT-CATEGORIES",
    tags: "CONTENT-TAGS",
    sources: "CONTENT-SOURCES",
    posts: "CONTENT-POSTS",
    partners: "AFFILIATE-PARTNERS",
    offers: "AFFILIATE-OFFERS",
    videos: "CONTENT-VIDEOS",
    subscribers: "CONTENT-SUBSCRIBERS",
  };
  return `${prefix[entity]}-${stage}-001`;
}

function adminLoadMessage(entity: AdminEntity, message: string) {
  const code = diagnosticCode(entity, "LOAD");
  const label: Record<AdminEntity, string> = {
    authors: "Authors",
    categories: "Categories",
    tags: "Tags",
    sources: "Sources",
    posts: "Posts",
    partners: "Affiliate partners",
    offers: "Affiliate offers",
    videos: "Videos",
    subscribers: "Subscribers",
  };
  if (/column|schema cache|relationship|table|does not exist/i.test(message)) {
    return "The " + label[entity] + " page could not load because the content database migration appears incomplete. Diagnostic ID: " + code + ". Run database/step-content-affiliate-publisher.sql and database/verify-content-admin-operational.sql.";
  }
  return "The " + label[entity] + " page could not be loaded. Diagnostic ID: " + code + ". Check Content diagnostics.";
}

export async function loadAdminEntity(entity: AdminEntity, filters: Record<string, string | undefined> = {}) {
  await ensureContentAdmin(entity);
  const supabase = createContentAdminSupabaseClient();
  const requestedPage = Number.parseInt(filters.page ?? '1', 10);
  const page = Number.isFinite(requestedPage) ? Math.max(1, requestedPage) : 1;
  const pageSize = 25;
  let query = supabase
    .from(tables[entity])
    .select(selectColumns[entity], { count: "exact" })
    .range((page - 1) * pageSize, page * pageSize - 1);

  query = likeFilter(query, entity, filters.q ?? "") as typeof query;
  if (supportsTrash(entity)) {
    if (filters.trash === 'trash') query = query.not('deleted_at', 'is', null);
    else if (filters.trash !== 'all') query = query.is('deleted_at', null);
  }
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
  if (error) {
    console.error("[Content Admin Load Failed]", { route: `/admin/${entity === "partners" || entity === "offers" ? "affiliate" : "content"}/${entity}`, stage: "load", entity, diagnosticId: diagnosticCode(entity, "LOAD"), code: error.code, message: error.message });
    return { records: [] as AdminRecord[], count: 0, page, pageSize, error: adminLoadMessage(entity, error.message) };
  }
  const records = await withSafeCounts(entity, (data ?? []) as unknown as AdminRecord[]);
  try {
    const total = count ?? 0;
    return { records: prepareClientRecords(entity, records), count: total, page, pageSize, totalPages: Math.max(1, Math.ceil(total / pageSize)) };
  } catch (serializationError) {
    console.error("[Content Admin Serialize Failed]", { route: `/admin/${entity === "partners" || entity === "offers" ? "affiliate" : "content"}/${entity}`, stage: "serialize", entity, diagnosticId: diagnosticCode(entity, "SERIALIZE"), message: serializationError instanceof Error ? serializationError.message : "Unknown serialization error" });
    return { records: [] as AdminRecord[], count: 0, page, pageSize, error: "The " + entity + " list could not be prepared for display. Diagnostic ID: " + diagnosticCode(entity, "SERIALIZE") + "." };
  }
}

export async function loadTrashDependencies(entity: AdminEntity, records: AdminRecord[]) {
  const ids = records.map((record) => String(record.id ?? "")).filter(Boolean);
  if (!ids.length) return records;
  const supabase = createContentAdminSupabaseClient();
  const relation: Partial<Record<AdminEntity, [string, string]>> = {
    authors: ["content_posts", "author_id"], categories: ["content_posts", "category_id"],
    tags: ["content_post_tags", "tag_id"], sources: ["content_post_sources", "source_id"],
    videos: ["content_videos", "id"], partners: ["affiliate_offers", "partner_id"],
    offers: ["content_post_affiliate_offers", "offer_id"],
  };
  if (entity === "posts") {
    const tables = [
      ["content_post_tags", "post_id"], ["content_post_sources", "post_id"],
      ["content_post_products", "post_id"], ["content_post_affiliate_offers", "post_id"],
      ["content_videos", "post_id"], ["affiliate_clicks", "post_id"], ["content_product_clicks", "post_id"],
    ] as const;
    const counts = await Promise.all(tables.map(async ([table, column]) => {
      const result = await supabase.from(table).select(column).in(column, ids);
      return (result.data ?? []) as unknown as Array<Record<string, unknown>>;
    }));
    return records.map((record) => ({ ...record, dependency_count: counts.reduce((sum, rows) => sum + rows.filter((row) => row.post_id === record.id).length, 0) }));
  }
  const config = relation[entity];
  if (!config) return records;
  const [table, column] = config;
  const result = await supabase.from(table).select(column).in(column, ids);
  const rows = (result.data ?? []) as unknown as Array<Record<string, unknown>>;
  return records.map((record) => ({ ...record, dependency_count: rows.filter((row) => row[column] === record.id).length }));
}

export async function loadAdminOptions() {
  await requireAdmin();
  if (!hasAdminSupabaseConfig()) return { authors: [], categories: [], tags: [], sources: [], products: [], partners: [], offers: [], posts: [] };
  const supabase = createContentAdminSupabaseClient();
  const [authors, categories, tags, sources, products, partners, offers, posts] = await Promise.all([
    contentPublicConfig.hubEnabled ? supabase.from("content_authors").select("id,name,slug,is_active,deleted_at").is("deleted_at", null).order("name") : Promise.resolve({ data: [] }),
    contentPublicConfig.hubEnabled ? supabase.from("content_categories").select("id,name,slug,is_active,deleted_at").is("deleted_at", null).order("sort_order").order("name") : Promise.resolve({ data: [] }),
    contentPublicConfig.hubEnabled ? supabase.from("content_tags").select("id,name,slug,is_active,deleted_at").is("deleted_at", null).order("name") : Promise.resolve({ data: [] }),
    contentPublicConfig.hubEnabled ? supabase.from("content_sources").select("id,title,url,is_active,deleted_at").is("deleted_at", null).order("title") : Promise.resolve({ data: [] }),
    contentPublicConfig.hubEnabled ? supabase.from("products").select("id,name,slug,price,unit,status,stock_quantity,product_media(url,alt_text,is_primary)").order("name") : Promise.resolve({ data: [] }),
    contentPublicConfig.affiliateEnabled ? supabase.from("affiliate_partners").select("id,name,slug,is_active,deleted_at").is("deleted_at", null).order("name") : Promise.resolve({ data: [] }),
    contentPublicConfig.affiliateEnabled ? supabase.from("affiliate_offers").select("id,title,slug,short_description,recommendation_basis,available_regions,is_active,deleted_at,affiliate_partners(name,slug,is_active)").is("deleted_at", null).order("title") : Promise.resolve({ data: [] }),
    contentPublicConfig.hubEnabled ? supabase.from("content_posts").select("id,title,slug,status,deleted_at").is("deleted_at", null).order("updated_at", { ascending: false }).limit(200) : Promise.resolve({ data: [] }),
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
  const supabase = createContentAdminSupabaseClient();
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
  const supabase = createContentAdminSupabaseClient();
  const [posts, trashedPosts, affiliateClicks, productClicks, subscribers, paidOrders] = await Promise.all([
    supabase.from("content_posts").select("id,status,content_format,contains_affiliate_content").is("deleted_at", null),
    supabase.from("content_posts").select("id", { count: "exact", head: true }).not("deleted_at", "is", null),
    supabase.from("affiliate_clicks").select("id", { count: "exact", head: true }),
    supabase.from("content_product_clicks").select("id", { count: "exact", head: true }),
    contentPublicConfig.subscriptionsEnabled ? supabase.from("content_subscribers").select("id", { count: "exact", head: true }).eq("status", "active") : Promise.resolve({ count: 0 }),
    supabase.from("orders").select("id,total_amount,payment_status,content_attribution").eq("payment_status", "paid").not("content_attribution", "is", null).limit(500),
  ]);
  if (posts.error) {
    console.error("[Content Dashboard Load Failed]", { code: posts.error.code, message: posts.error.message });
    return { posts: 0, drafts: 0, review: 0, published: 0, archived: 0, trashedPosts: 0, videos: 0, comparisons: 0, affiliatePosts: 0, affiliateClicks: 0, productClicks: 0, activeSubscribers: 0, contentAssistedPaidOrders: 0, contentAssistedPaidRevenue: 0 };
  }
  const rows = (posts.data ?? []) as Array<{ status: string; content_format: string; contains_affiliate_content: boolean }>;
  const orders = (paidOrders.data ?? []) as Array<{ total_amount: number | string }>;
  return {
    posts: rows.length,
    drafts: rows.filter((row) => row.status === "draft").length,
    review: rows.filter((row) => row.status === "review").length,
    published: rows.filter((row) => row.status === "published").length,
    archived: rows.filter((row) => row.status === "archived").length,
    trashedPosts: trashedPosts.count ?? 0,
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
  const supabase = createContentAdminSupabaseClient();
  const [partners, offers, trashedPartners, trashedOffers, clicks, topOffers, topPosts, references] = await Promise.all([
    supabase.from("affiliate_partners").select("id,is_active").is("deleted_at", null),
    supabase.from("affiliate_offers").select("id,title,slug,is_active,affiliate_partners(is_active,deleted_at)").is("deleted_at", null),
    supabase.from("affiliate_partners").select("id", { count: "exact", head: true }).not("deleted_at", "is", null),
    supabase.from("affiliate_offers").select("id", { count: "exact", head: true }).not("deleted_at", "is", null),
    supabase.from("affiliate_clicks").select("id", { count: "exact", head: true }),
    supabase.from("affiliate_clicks").select("offer_id,clicked_at, affiliate_offers(title,slug)").order("clicked_at", { ascending: false }).limit(1000),
    supabase.from("affiliate_clicks").select("post_id, content_posts(title,slug)").limit(1000),
    supabase.from("content_post_affiliate_offers").select("offer_id,affiliate_offers(title,slug,is_active,deleted_at,affiliate_partners(is_active,deleted_at)),content_posts(title,slug,status,deleted_at)").limit(2000),
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
  const offerRows = (offers.data ?? []) as unknown as Array<{ id: string; title: string; is_active: boolean; affiliate_partners: { is_active: boolean; deleted_at: string | null } | Array<{ is_active: boolean; deleted_at: string | null }> | null }>;
  const eligibleOffers = offerRows.filter((row) => {
    const partner = Array.isArray(row.affiliate_partners) ? row.affiliate_partners[0] : row.affiliate_partners;
    return row.is_active && partner?.is_active && !partner.deleted_at;
  });
  const clickedOfferIds = new Set(((topOffers.data ?? []) as Array<{ offer_id: string }>).map((row) => row.offer_id));
  const referenceRows = (references.data ?? []) as unknown as AdminRecord[];
  const publishedArticleIds = new Set<string>();
  const retiredReferences: Array<{ label: string; count: number }> = [];
  for (const row of referenceRows) {
    const post = Array.isArray(row.content_posts) ? (row.content_posts as AdminRecord[])[0] : row.content_posts as AdminRecord | undefined;
    const offer = Array.isArray(row.affiliate_offers) ? (row.affiliate_offers as AdminRecord[])[0] : row.affiliate_offers as AdminRecord | undefined;
    const partner = Array.isArray(offer?.affiliate_partners) ? (offer?.affiliate_partners as AdminRecord[])[0] : offer?.affiliate_partners as AdminRecord | undefined;
    if (post?.status === "published" && !post.deleted_at) publishedArticleIds.add(String(post.slug));
    if (offer && (offer.is_active !== true || offer.deleted_at || partner?.is_active !== true || partner?.deleted_at)) retiredReferences.push({ label: `${String(offer.title ?? offer.slug)} in ${String(post?.title ?? post?.slug ?? "unknown post")}`, count: 1 });
  }
  const clickRows = (topOffers.data ?? []) as unknown as Array<{ clicked_at?: string }>;
  const now = Date.now();
  return {
    totalPartners: partnerRows.length,
    activePartners: partnerRows.filter((row) => row.is_active).length,
    totalOffers: offerRows.length,
    activeOffers: eligibleOffers.length,
    eligibleOffers: eligibleOffers.length,
    trashedPartners: trashedPartners.count ?? 0,
    trashedOffers: trashedOffers.count ?? 0,
    affiliateClicks: clicks.count ?? 0,
    topOffers: aggregate((topOffers.data ?? []) as unknown as AdminRecord[], "offer_id", "affiliate_offers"),
    topPosts: aggregate((topPosts.data ?? []) as unknown as AdminRecord[], "post_id", "content_posts"),
    clicksLast7Days: clickRows.filter((row) => row.clicked_at && now - new Date(row.clicked_at).getTime() <= 7 * 86400000).length,
    clicksLast30Days: clickRows.filter((row) => row.clicked_at && now - new Date(row.clicked_at).getTime() <= 30 * 86400000).length,
    offersWithNoClicks: eligibleOffers.filter((offer) => !clickedOfferIds.has(offer.id)).map((offer) => ({ label: offer.title, count: 0 })),
    publishedArticlesWithOffers: publishedArticleIds.size,
    retiredReferences,
  };
}

export async function loadCommerceReport() {
  await ensureContentAdmin("posts");
  const supabase = createContentAdminSupabaseClient();
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


export async function loadContentOperationalDiagnostics() {
  await requireAdmin();
  const checks = {
    contentHubEnabled: contentPublicConfig.hubEnabled,
    affiliateContentEnabled: contentPublicConfig.affiliateEnabled,
    contentToolsEnabled: contentPublicConfig.toolsEnabled,
    contentSubscriptionsEnabled: contentPublicConfig.subscriptionsEnabled,
    hasAdminConfig: hasAdminSupabaseConfig(),
    contentTablesAvailable: false,
    affiliateTablesAvailable: false,
    requiredColumnsAvailable: false,
    taxonomySeeded: false,
    productsTableAvailable: false,
    ordersContentAttributionAvailable: false,
  };
  if (!hasAdminSupabaseConfig()) return checks;
  const supabase = createContentAdminSupabaseClient();
  try {
    const [authors, categories, partners, products, ordersColumn] = await Promise.all([
      supabase.from("content_authors").select("id,name,slug,is_active,credentials_or_experience,avatar_url,avatar_alt,social_links", { count: "exact", head: true }),
      supabase.from("content_categories").select("id,name,slug,is_active,sort_order,seo_title,seo_description", { count: "exact", head: true }),
      supabase.from("affiliate_partners").select("id,name,slug,is_active,affiliate_network,default_disclosure,internal_notes", { count: "exact", head: true }),
      supabase.from("products").select("id", { count: "exact", head: true }),
      supabase.from("orders").select("content_attribution", { count: "exact", head: true }),
    ]);
    checks.contentTablesAvailable = !authors.error && !categories.error;
    checks.affiliateTablesAvailable = !partners.error;
    checks.requiredColumnsAvailable = !authors.error && !categories.error && !partners.error;
    checks.productsTableAvailable = !products.error;
    checks.ordersContentAttributionAvailable = !ordersColumn.error;
    const taxonomy = await supabase.from("content_categories").select("id", { count: "exact", head: true }).eq("is_active", true);
    checks.taxonomySeeded = (taxonomy.count ?? 0) > 0;
  } catch (error) {
    console.error("[Content Diagnostics Failed]", { message: error instanceof Error ? error.message : "Unknown error" });
  }
  return checks;
}

