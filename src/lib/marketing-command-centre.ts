import "server-only";
/* eslint-disable @typescript-eslint/no-explicit-any */
import { requireAdmin } from "@/src/lib/admin-auth";
import { createAdminSupabaseClient } from "@/src/lib/supabase/admin";
import { getAdminProducts } from "@/src/lib/products";
import { getProductCampaignReadiness } from "@/src/lib/product-campaign-readiness";

export type RangeKey =
  | "today"
  | "yesterday"
  | "7d"
  | "30d"
  | "month"
  | "previous_month";
const WAT_MS = 60 * 60 * 1000;
function watStart(date: Date) {
  const shifted = new Date(date.getTime() + WAT_MS);
  shifted.setUTCHours(0, 0, 0, 0);
  return new Date(shifted.getTime() - WAT_MS);
}
export function marketingRange(key: RangeKey = "30d", now = new Date()) {
  const today = watStart(now);
  let start = today,
    end = new Date(today.getTime() + 86400000);
  if (key === "yesterday") {
    start = new Date(today.getTime() - 86400000);
    end = today;
  } else if (key === "7d") start = new Date(today.getTime() - 6 * 86400000);
  else if (key === "30d") start = new Date(today.getTime() - 29 * 86400000);
  else if (key === "month") {
    const local = new Date(now.getTime() + WAT_MS);
    start = new Date(
      Date.UTC(local.getUTCFullYear(), local.getUTCMonth(), 1) - WAT_MS,
    );
    end = new Date(
      Date.UTC(local.getUTCFullYear(), local.getUTCMonth() + 1, 1) - WAT_MS,
    );
  } else if (key === "previous_month") {
    const local = new Date(now.getTime() + WAT_MS);
    start = new Date(
      Date.UTC(local.getUTCFullYear(), local.getUTCMonth() - 1, 1) - WAT_MS,
    );
    end = new Date(
      Date.UTC(local.getUTCFullYear(), local.getUTCMonth(), 1) - WAT_MS,
    );
  }
  const duration = end.getTime() - start.getTime();
  return {
    key,
    start: start.toISOString(),
    end: end.toISOString(),
    previousStart: new Date(start.getTime() - duration).toISOString(),
    previousEnd: start.toISOString(),
    timezone: "Africa/Lagos",
  };
}
const amount = (rows: Array<{ total_amount?: unknown }>) =>
  rows.reduce((sum, row) => sum + Number(row.total_amount || 0), 0);
export async function loadMarketingOverview(key: RangeKey) {
  await requireAdmin();
  const range = marketingRange(key);
  const db = createAdminSupabaseClient();
  const between = <T>(query: T, column = "created_at") =>
    (query as any).gte(column, range.start).lt(column, range.end);
  const previous = <T>(query: T) =>
    (query as any)
      .gte("created_at", range.previousStart)
      .lt("created_at", range.previousEnd);
  const [
    ordersResult,
    previousOrdersResult,
    clicksResult,
    inquiriesResult,
    affiliateResult,
    productClicksResult,
    subscribersResult,
    campaignsResult,
    prospectsResult,
    socialResult,
    offersResult,
  ] = await Promise.all([
    between(
      db
        .from("orders")
        .select(
          "id,total_amount,payment_status,order_status,created_at,first_touch_attribution,last_touch_attribution",
        ),
    ).eq("payment_status", "paid"),
    previous(
      db.from("orders").select("total_amount,payment_status,created_at"),
    ).eq("payment_status", "paid"),
    between(
      db.from("marketing_campaign_clicks").select("id,campaign_id,clicked_at"),
      "clicked_at",
    ),
    between(
      db.from("contact_inquiries").select("id,inquiry_type,status,created_at"),
    ),
    between(db.from("affiliate_clicks").select("id,clicked_at"), "clicked_at"),
    between(
      db.from("content_product_clicks").select("id,clicked_at"),
      "clicked_at",
    ),
    between(db.from("content_subscribers").select("id,created_at")),
    db
      .from("marketing_campaigns")
      .select("id,name,slug,starts_at,ends_at,is_active"),
    db
      .from("marketing_prospects")
      .select("id,stage,estimated_value,assigned_follow_up_at,source")
      .limit(500),
    db
      .from("marketing_social_activities")
      .select("id,status,scheduled_at,published_at,platform,content_type")
      .limit(500),
    db
      .from("affiliate_offers")
      .select("id,title,is_active,price_last_checked_at")
      .limit(500),
  ]);
  const paid = (ordersResult.data ?? []) as Array<{
    id: string;
    total_amount: unknown;
    first_touch_attribution: unknown;
    last_touch_attribution: unknown;
  }>;
  const attributed = paid.filter(
    (row) => row.first_touch_attribution || row.last_touch_attribution,
  );
  const revenue = amount(paid),
    previousRevenue = amount(
      (previousOrdersResult.data ?? []) as Array<{ total_amount: unknown }>,
    );
  const inquiries = (inquiriesResult.data ?? []) as Array<{inquiry_type:string}>;
  const prospects = (prospectsResult.data ?? []) as Array<{
    assigned_follow_up_at: string | null;
    stage: string;
  }>;
  const social = (socialResult.data ?? []) as Array<{
    status: string;
    scheduled_at: string | null;
  }>;
  const now = Date.now();
  return {
    range,
    kpis: {
      paidRevenue: revenue,
      paidOrders: paid.length,
      averageOrderValue: paid.length ? revenue / paid.length : 0,
      campaignClicks: clicksResult.data?.length ?? 0,
      attributedOrders: attributed.length,
      attributedPaidRevenue: amount(attributed),
      clickToPaidRate:
        (clicksResult.data?.length ?? 0)
          ? (attributed.length / (clicksResult.data?.length ?? 1)) * 100
          : null,
      contactInquiries: inquiries.filter(
        (x) => x.inquiry_type !== "bulk_business_supply",
      ).length,
      businessInquiries: inquiries.filter(
        (x) => x.inquiry_type === "bulk_business_supply",
      ).length,
      affiliateClicks: affiliateResult.data?.length ?? 0,
      contentProductClicks: productClicksResult.data?.length ?? 0,
      newSubscribers: subscribersResult.data?.length ?? 0,
    },
    trend: {
      paidRevenue: previousRevenue
        ? ((revenue - previousRevenue) / previousRevenue) * 100
        : null,
      paidOrders:
        (previousOrdersResult.data?.length ?? 0)
          ? ((paid.length - (previousOrdersResult.data?.length ?? 0)) /
              (previousOrdersResult.data?.length ?? 1)) *
            100
          : null,
    },
    today: {
      overdueProspects: prospects.filter(
        (x) =>
          x.assigned_follow_up_at &&
          new Date(x.assigned_follow_up_at).getTime() < now &&
          !["won", "lost"].includes(x.stage),
      ).length,
      dueSocial: social.filter(
        (x) =>
          x.status !== "published" &&
          x.scheduled_at &&
          new Date(x.scheduled_at).getTime() <= now,
      ).length,
      campaignsDue: (campaignsResult.data ?? []).filter(
        (x) =>
          (x.starts_at || x.ends_at) &&
          [x.starts_at, x.ends_at].some(
            (v) =>
              v && new Date(v).toDateString() === new Date().toDateString(),
          ),
      ).length,
      offersForReview: (offersResult.data ?? []).filter(
        (x) => !x.is_active || !x.price_last_checked_at,
      ).length,
    },
    unavailable: [
      prospectsResult.error ? "Pipeline migration not applied" : null,
      socialResult.error ? "Social activity migration not applied" : null,
    ].filter(Boolean),
  };
}

export async function loadProductPerformance() {
  await requireAdmin();
  const db = createAdminSupabaseClient();
  const [{ products }, ordersResult, itemsResult, clicksResult, campaignsResult, campaignClicksResult] =
    await Promise.all([
      getAdminProducts(),
      db
        .from("orders")
        .select(
          "id,total_amount,first_touch_attribution,last_touch_attribution",
        )
        .eq("payment_status", "paid")
        .limit(2000),
      db
        .from("order_items")
        .select("order_id,product_id,quantity,total_price")
        .limit(5000),
      db.from("content_product_clicks").select("product_id").limit(5000),
      db.from("marketing_campaigns").select("id,target_path").limit(1000),
      db.from("marketing_campaign_clicks").select("campaign_id").limit(10000),
    ]);
  const paidIds = new Set((ordersResult.data ?? []).map((x) => x.id));
  const attributedPaidIds = new Set((ordersResult.data ?? []).filter((order) => order.first_touch_attribution || order.last_touch_attribution).map((order) => order.id));
  return products.map((product) => {
    const items = (itemsResult.data ?? []).filter(
      (x) => x.product_id === product.id && paidIds.has(x.order_id),
    );
    const orderCount = new Set(items.map((x) => x.order_id)).size;
    const readiness = getProductCampaignReadiness(product);
    const campaignIds = new Set((campaignsResult.data ?? []).filter((campaign) => campaign.target_path === `/shop/${product.slug}`).map((campaign) => campaign.id));
    return {
      id: product.id!, name: product.name, slug: product.slug, category: product.category,
      status: product.status ?? "inactive", availability: product.availability,
      price: product.price, unit: product.unit, stock_quantity: product.stockCount,
      campaignReadiness: readiness.state,
      campaignReadinessIssues: readiness.missing,
      paidQuantity: items.reduce((s, x) => s + Number(x.quantity), 0),
      paidRevenue: items.reduce((s, x) => s + Number(x.total_price), 0),
      paidOrders: orderCount,
      averageQuantity: orderCount
        ? items.reduce((s, x) => s + Number(x.quantity), 0) / orderCount
        : 0,
      contentClicks: (clicksResult.data ?? []).filter(
        (x) => x.product_id === product.id,
      ).length,
      campaignClicks: (campaignClicksResult.data ?? []).filter((click) => campaignIds.has(click.campaign_id)).length,
      attributedPaidRevenue: items.filter((item) => attributedPaidIds.has(item.order_id)).reduce((sum, item) => sum + Number(item.total_price), 0),
      ga: null,
    };
  });
}

export type ProductPerformanceFilters = { search?: string; category?: string; availability?: string; readiness?: string };
export function filterProductPerformance<T extends { name:string; slug:string; category:string; status:string; availability:string; campaignReadiness:string }>(products:T[], filters:ProductPerformanceFilters) {
  const search=filters.search?.trim().toLowerCase();
  return products.filter((product)=>(!search||product.name.toLowerCase().includes(search)||product.slug.toLowerCase().includes(search))&&(!filters.category||product.category===filters.category)&&(!filters.availability||product.status===filters.availability||product.availability===filters.availability)&&(!filters.readiness||product.campaignReadiness===filters.readiness));
}

export async function loadMarketingTable(table: string, select = "*") {
  await requireAdmin();
  const result = await createAdminSupabaseClient()
    .from(table)
    .select(select)
    .order("created_at", { ascending: false })
    .limit(500);
  return { rows: result.data ?? [], error: result.error?.message ?? null };
}
