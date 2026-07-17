import Link from "next/link";
import { AdminHeader } from "@/src/components/admin";
import { requireAdmin } from "@/src/lib/admin-auth";
import { getContentIndexingReadiness } from "@/src/lib/content-indexing";
import { createAdminSupabaseClient } from "@/src/lib/supabase/admin";
import { siteConfig } from "@/src/config/site";
import { ChecklistClient, type ChecklistSection } from "./checklist-client";

export const dynamic = "force-dynamic";

const labels: Record<string, string[]> = {
  Technical: ["Canonical domain confirmed", "HTTPS confirmed", "Robots reviewed", "Sitemap reviewed", "RSS reviewed"],
  Content: ["Trash reviewed", "No public test posts", "Five real articles published", "Featured images and metadata reviewed", "Internal links reviewed"],
  Email: ["Official addresses displayed", "Inbound forwarding tested", "Outbound Resend delivery tested", "Reply-To tested"],
  Payments: ["Paystack mode confirmed", "One successful launch test order reviewed"],
  Delivery: ["Delivery coverage checked", "Delivery rates checked", "Product delivery fallbacks reviewed"],
  Marketing: ["Campaign URLs reviewed", "Consent preferences tested", "Search verification configured"],
  Affiliate: ["Eligible offers reviewed", "Retired references resolved", "Click reports compared with network reports", "Affiliate disclosure reviewed"],
  Operations: ["Inquiry inbox monitored", "Order inbox monitored", "WhatsApp monitored", "Support response owner assigned"],
};
const sections: ChecklistSection[] = Object.entries(labels).map(([title, items]) => ({ title, items: items.map((label, index) => ({ id: `${title.toLowerCase()}:${index}`, label })) }));

export default async function AdminLaunchChecklistPage() {
  await requireAdmin();
  const [readiness, setting] = await Promise.all([
    getContentIndexingReadiness(),
    createAdminSupabaseClient().from("app_settings").select("value,updated_at").eq("key", `launch_checklist:${siteConfig.domain}`).maybeSingle(),
  ]);
  const value = (setting.data?.value ?? {}) as { checked?: string[]; updatedAt?: string; checkedBy?: string };
  return <><AdminHeader title="Launch Checklist" body="Automatic readiness checks and persistent admin confirmations. Completing this page never enables indexing automatically." /><section className={`mb-5 rounded-lg border p-5 ${readiness.readyForContentIndexing ? "border-green-200 bg-green-50" : "border-amber-200 bg-amber-50"}`}><h2 className="text-xl font-bold text-green-950">Automatic indexing readiness: {readiness.readyForContentIndexing ? "Ready" : "Blocked"}</h2><p className="mt-2 text-sm">Eligible articles: {readiness.eligibleArticleCount}; sitemap articles while current flags apply: {readiness.sitemapArticleCount}; RSS: {readiness.rssEnabled ? "enabled" : "disabled"}.</p>{readiness.blockers.length ? <ul className="mt-3 ml-5 list-disc space-y-1 text-sm">{readiness.blockers.map((blocker) => <li key={blocker}>{blocker}</li>)}</ul> : null}</section><div className="mb-5 flex gap-2"><Link href="/admin/diagnostics" className="rounded-full border border-green-800 px-4 py-2 text-sm font-bold text-green-950">Full diagnostics</Link><Link href="/admin/affiliate" className="rounded-full border border-green-800 px-4 py-2 text-sm font-bold text-green-950">Affiliate report</Link></div><ChecklistClient sections={sections} initialChecked={value.checked ?? []} updatedAt={value.updatedAt ?? setting.data?.updated_at} checkedBy={value.checkedBy} /></>;
}
