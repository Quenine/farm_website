import "server-only";

import { requireAdmin } from "@/src/lib/admin-auth";
import { getContentFeatures } from "@/src/lib/content-features";
import { siteConfig } from "@/src/config/site";
import { hasContentAdminDataClient, createContentAdminSupabaseClient } from "@/src/lib/supabase/content-admin-server";

export type ContentDiagnosticStatus = "ready" | "empty" | "failed";
export type ContentDiagnosticCheck = {
  name: string;
  code: string;
  status: ContentDiagnosticStatus;
  rowCount: number | null;
  message: string;
};

function sanitize(value: unknown) {
  return String(value ?? "").replace(/(eyJ[A-Za-z0-9_-]+.[A-Za-z0-9_-]+.[A-Za-z0-9_-]+)/g, "[redacted-token]").slice(0, 240);
}

async function runCheck(name: string, code: string, query: () => PromiseLike<{ error: unknown; count: number | null; data?: unknown[] | null }>): Promise<ContentDiagnosticCheck> {
  try {
    const result = await query();
    const error = result.error as { code?: string; message?: string; details?: string; hint?: string } | null;
    if (error) {
      console.error("[Content Admin Diagnostic Failed]", { diagnosticId: code, supabaseCode: error.code, message: error.message, details: error.details, hint: error.hint });
      return { name, code, status: "failed", rowCount: null, message: sanitize(error.message || error.details || "Query failed") };
    }
    const rowCount = result.count ?? result.data?.length ?? 0;
    return { name, code, status: rowCount > 0 ? "ready" : "empty", rowCount, message: rowCount > 0 ? "Ready" : "Empty but ready" };
  } catch (error) {
    console.error("[Content Admin Diagnostic Exception]", { diagnosticId: code, message: error instanceof Error ? error.message : "Unknown error" });
    return { name, code, status: "failed", rowCount: null, message: sanitize(error instanceof Error ? error.message : "Query failed") };
  }
}

export async function loadContentDiagnostics() {
  await requireAdmin();
  const features = getContentFeatures();
  const configuration = {
    contentHubEnabled: features.contentHubEnabled,
    affiliateContentEnabled: features.affiliateContentEnabled,
    contentToolsEnabled: features.contentToolsEnabled,
    contentSubscriptionsEnabled: features.contentSubscriptionsEnabled,
    contentIndexingEnabled: features.contentIndexingEnabled,
    canonicalSiteUrl: siteConfig.url,
    adminDataClientAvailable: hasContentAdminDataClient(),
  };
  if (!configuration.adminDataClientAvailable) {
    return { configuration, checks: [] as ContentDiagnosticCheck[] };
  }
  const supabase = createContentAdminSupabaseClient();
  const checks = await Promise.all([
    runCheck("Categories query", "CAT-QUERY-001", () => supabase.from("content_categories").select("id", { count: "exact", head: true })),
    runCheck("Tags query", "TAG-QUERY-001", () => supabase.from("content_tags").select("id", { count: "exact", head: true })),
    runCheck("Authors query", "AUTH-QUERY-001", () => supabase.from("content_authors").select("id", { count: "exact", head: true })),
    runCheck("Sources query", "SRC-QUERY-001", () => supabase.from("content_sources").select("id", { count: "exact", head: true })),
    runCheck("Videos query", "VID-QUERY-001", () => supabase.from("content_videos").select("id", { count: "exact", head: true })),
    runCheck("Subscribers query", "SUB-QUERY-001", () => supabase.from("content_subscribers").select("id", { count: "exact", head: true })),
    runCheck("Affiliate partners query", "AFF-PARTNERS-QUERY-001", () => supabase.from("affiliate_partners").select("id", { count: "exact", head: true })),
    runCheck("Affiliate offers query", "AFF-OFFERS-QUERY-001", () => supabase.from("affiliate_offers").select("id", { count: "exact", head: true })),
    runCheck("Products relationship query", "PRODUCT-REL-QUERY-001", () => supabase.from("products").select("id,product_media(id)", { count: "exact", head: true })),
    runCheck("Orders attribution query", "ORDERS-ATTR-QUERY-001", () => supabase.from("orders").select("content_attribution", { count: "exact", head: true })),
  ]);
  return { configuration, checks };
}
