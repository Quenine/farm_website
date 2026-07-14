import "server-only";

import { requireAdmin } from "@/src/lib/admin-auth";
import { getContentFeatures } from "@/src/lib/content-features";
import { siteConfig } from "@/src/config/site";
import { hasContentAdminDataClient, createContentAdminSupabaseClient } from "@/src/lib/supabase/content-admin-server";
import { adminEntityDefinitions } from '@/src/lib/content-admin-entities.mjs';

export type ContentDiagnosticStatus = "ready" | "empty" | "failed" | "configured";
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

async function runStorageCheck(name: string, code: string, query: () => PromiseLike<{ error: unknown; data?: unknown[] | null }>): Promise<ContentDiagnosticCheck> {
  try {
    const result = await query();
    const error = result.error as { message?: string } | null;
    if (error) return { name, code, status: "failed", rowCount: null, message: sanitize(error.message || "Storage check failed") };
    const rowCount = result.data?.length ?? 0;
    return { name, code, status: rowCount > 0 ? "ready" : "empty", rowCount, message: rowCount > 0 ? "Ready" : "Empty but ready" };
  } catch (error) {
    return { name, code, status: "failed", rowCount: null, message: sanitize(error instanceof Error ? error.message : "Storage check failed") };
  }
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

function configuredCheck(name: string, code: string): ContentDiagnosticCheck {
  return { name, code, status: 'configured', rowCount: null, message: 'Configured, not runtime-tested.' };
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
  const entityChecks = Object.entries(adminEntityDefinitions).map(([entity, definition]) =>
    runCheck(`${entity} production loader query`, `ENTITY-${entity.toUpperCase()}-001`, () =>
      supabase.from(definition.table).select(definition.select, { count: 'exact', head: true })),
  );
  const trashChecks = Object.entries(adminEntityDefinitions)
    .filter(([, definition]) => definition.trash)
    .map(([entity, definition]) => runCheck(`${entity} trash columns`, `TRASH-${entity.toUpperCase()}-001`, () =>
      supabase.from(definition.table).select('deleted_at,deleted_by', { count: 'exact', head: true })));
  const checks = await Promise.all([
    ...entityChecks,
    ...trashChecks,
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
    runStorageCheck("content-media bucket available", "CONTENT-MEDIA-BUCKET-001", async () => { const buckets = await supabase.storage.listBuckets(); return { error: buckets.error, data: (buckets.data ?? []).filter((bucket) => bucket.name === "content-media") }; }),
    configuredCheck('Inline upload endpoint', 'CONTENT-MEDIA-ENDPOINT-001'),
    configuredCheck('Public media URL', 'CONTENT-MEDIA-PUBLIC-001'),
    runCheck("Supported media MIME types", "CONTENT-MEDIA-MIME-001", () => Promise.resolve({ error: null, count: 3, data: [{ type: "image/jpeg" }, { type: "image/png" }, { type: "image/webp" }] })),
    runCheck("Affiliate offer picker data query", "AFF-OFFER-PICKER-001", () => supabase.from("affiliate_offers").select("id,title,slug,is_active,affiliate_partners(name,slug,is_active)", { count: "exact", head: true })),
    configuredCheck('Deletion actions', 'CONTENT-DELETE-ACTIONS-001'),
  ]);
  return { configuration, checks };
}
