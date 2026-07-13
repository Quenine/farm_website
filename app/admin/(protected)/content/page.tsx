import Link from "next/link";
import { notFound } from "next/navigation";
import { AdminHeader, StatCard } from "@/src/components/admin";
import { AdminSubnav } from "@/src/components/content-admin/admin-subnav";
import { contentPublicConfig, siteConfig } from "@/src/config/site";
import { loadContentDashboard } from "@/src/lib/content-admin";
import { formatNaira } from "@/src/lib/format";

export const dynamic = "force-dynamic";

export default async function ContentAdminPage() {
  if (!contentPublicConfig.hubEnabled) notFound();
  const summary = await loadContentDashboard();
  const cards = [
    ["Total posts", summary.posts, "All content records.", "/admin/content/posts"],
    ["Drafts", summary.drafts, "Work in progress.", "/admin/content/posts?status=draft"],
    ["In review", summary.review, "Needs editorial approval.", "/admin/content/posts?status=review"],
    ["Published", summary.published, "Public eligible content.", "/admin/content/posts?status=published"],
    ["Videos", summary.videos, "Video companion content.", "/admin/content/videos"],
    ["Comparisons", summary.comparisons, "Comparison content.", "/admin/content/posts?format=comparison"],
    ["Affiliate-enabled", summary.affiliatePosts, "Posts requiring disclosure.", "/admin/content/posts?affiliate=yes"],
    ["Product clicks", summary.productClicks, "Content-to-commerce clicks.", "/admin/content/commerce"],
    ["Active subscribers", summary.activeSubscribers, "Update-list subscribers.", "/admin/content/subscribers"],
    ["Content-assisted paid orders", summary.contentAssistedPaidOrders, "Attribution, not direct causation.", "/admin/content/commerce"],
    ["Content-assisted paid revenue", formatNaira(summary.contentAssistedPaidRevenue), "Paid orders carrying content attribution.", "/admin/content/commerce"],
  ] as const;
  return <div><AdminHeader title="Content" body={`Manage ${siteConfig.name} agribusiness articles, sources, videos, tools, product links and content-assisted attribution.`} /><AdminSubnav /><div className="mb-6 flex flex-wrap gap-3"><Link href="/admin/content/posts/new" className="rounded-full bg-green-800 px-5 py-3 text-sm font-bold text-white">Create Article</Link><Link href="/admin/content/commerce" className="rounded-full border border-green-800 px-5 py-3 text-sm font-bold text-green-950">Content Commerce</Link></div><div className="grid gap-4 md:grid-cols-3">{cards.map(([label,value,note,href])=><Link key={label} href={href}><StatCard label={label} value={String(value)} note={note} /></Link>)}</div></div>;
}
