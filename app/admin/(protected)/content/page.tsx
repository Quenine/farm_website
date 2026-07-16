import Link from "next/link";
import { notFound } from "next/navigation";
import { AdminHeader, StatCard } from "@/src/components/admin";
import { AdminSubnav } from "@/src/components/content-admin/admin-subnav";
import { contentPublicConfig, siteConfig } from "@/src/config/site";
import { loadContentDashboard, loadContentOperationalDiagnostics } from "@/src/lib/content-admin";
import { formatNaira } from "@/src/lib/format";

export const dynamic = "force-dynamic";

export default async function ContentAdminPage() {
  if (!contentPublicConfig.hubEnabled) notFound();
  const [summary, diagnostics] = await Promise.all([loadContentDashboard(), loadContentOperationalDiagnostics()]);
  const cards = [
    ["Total posts", summary.posts, "Non-trashed content records.", "/admin/content/posts"],
    ["Drafts", summary.drafts, "Work in progress.", "/admin/content/posts?status=draft"],
    ["In review", summary.review, "Needs editorial approval.", "/admin/content/posts?status=review"],
    ["Published", summary.published, "Public eligible content.", "/admin/content/posts?status=published"],
    ["Archived", summary.archived, "Archived but not deleted.", "/admin/content/posts?status=archived"],
    ["Trash", summary.trashedPosts, "Soft-deleted content records.", "/admin/content/trash"],
    ["Videos", summary.videos, "Video companion content.", "/admin/content/videos"],
    ["Comparisons", summary.comparisons, "Comparison content.", "/admin/content/posts?format=comparison"],
    ["Affiliate-enabled", summary.affiliatePosts, "Posts requiring disclosure.", "/admin/content/posts?affiliate=yes"],
    ["Product clicks", summary.productClicks, "Content-to-commerce clicks.", "/admin/content/commerce"],
    ["Active subscribers", summary.activeSubscribers, "Update-list subscribers.", "/admin/content/subscribers"],
    ["Content-assisted paid orders", summary.contentAssistedPaidOrders, "Attribution, not direct causation.", "/admin/content/commerce"],
    ["Content-assisted paid revenue", formatNaira(summary.contentAssistedPaidRevenue), "Paid orders carrying content attribution.", "/admin/content/commerce"],
  ] as const;
  const diagnosticRows = [
    ["CONTENT_HUB_ENABLED", diagnostics.contentHubEnabled],
    ["AFFILIATE_CONTENT_ENABLED", diagnostics.affiliateContentEnabled],
    ["CONTENT_TOOLS_ENABLED", diagnostics.contentToolsEnabled],
    ["CONTENT_SUBSCRIPTIONS_ENABLED", diagnostics.contentSubscriptionsEnabled],
    ["Content tables available", diagnostics.contentTablesAvailable],
    ["Affiliate tables available", diagnostics.affiliateTablesAvailable],
    ["Required columns available", diagnostics.requiredColumnsAvailable],
    ["Taxonomy seeded", diagnostics.taxonomySeeded],
    ["Products table available", diagnostics.productsTableAvailable],
    ["Orders content_attribution available", diagnostics.ordersContentAttributionAvailable],
  ] as const;
  return <div><AdminHeader title="Content" body={`Manage ${siteConfig.name} agribusiness articles, sources, videos, tools, product links and content-assisted attribution.`} /><AdminSubnav /><section className="mb-6 rounded-lg bg-white p-5 shadow-sm"><div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between"><div><h2 className="text-xl font-bold text-green-950">Content setup diagnostics</h2><p className="mt-1 text-sm text-stone-600">Safe deployment checks for feature flags and content database readiness. Canonical URL: {siteConfig.url}</p></div><Link href="/admin/diagnostics" className="rounded-full border border-green-800 px-4 py-2 text-sm font-bold text-green-950">Full diagnostics</Link></div><div className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">{diagnosticRows.map(([label, ok]) => <div key={label} className="flex items-center justify-between rounded-lg bg-green-50 p-3 text-sm"><span className="font-semibold text-green-950">{label}</span><span className={ok ? "font-bold text-green-800" : "font-bold text-amber-700"}>{ok ? "Yes" : "No"}</span></div>)}</div></section><div className="mb-6 flex flex-wrap gap-3"><Link href="/admin/content/posts/new" className="rounded-full bg-green-800 px-5 py-3 text-sm font-bold text-white">Create Article</Link><Link href="/admin/content/commerce" className="rounded-full border border-green-800 px-5 py-3 text-sm font-bold text-green-950">Content Commerce</Link></div><div className="grid gap-4 md:grid-cols-3">{cards.map(([label,value,note,href])=><Link key={label} href={href}><StatCard label={label} value={String(value)} note={note} /></Link>)}</div></div>;
}
