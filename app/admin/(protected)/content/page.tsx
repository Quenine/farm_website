import Link from "next/link";
import { notFound } from "next/navigation";
import { AdminHeader, StatCard } from "@/src/components/admin";
import { contentPublicConfig, siteConfig } from "@/src/config/site";
import { getContentAdminSummary } from "@/src/lib/content";
import { formatNaira } from "@/src/lib/format";

export const dynamic = "force-dynamic";

export default async function ContentAdminPage() {
  if (!contentPublicConfig.hubEnabled) notFound();
  const summary = await getContentAdminSummary();
  return <div><AdminHeader title="Content" body={`Manage ${siteConfig.name} agribusiness posts, sources, videos, tools, products, and content-assisted order reporting.`} />
    {!summary.configured ? <div className="mb-6 rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm font-semibold text-amber-900">Content tables are not configured yet. Run database/step-content-affiliate-publisher.sql in the Shields Farms Supabase project.</div> : null}
    <div className="grid gap-4 md:grid-cols-3"><StatCard label="Total posts" value={String(summary.posts)} note="Draft, review, published, and archived content." /><StatCard label="Published" value={String(summary.published)} note="Eligible public posts, subject to indexing flags." /><StatCard label="In review" value={String(summary.review)} note="Needs editorial approval before publish." /><StatCard label="Videos" value={String(summary.videos)} note="Video companion content." /><StatCard label="Affiliate-enabled" value={String(summary.affiliatePosts)} note="Posts requiring disclosure." /><StatCard label="Affiliate clicks" value={String(summary.affiliateClicks)} note="Consent-permitted outbound clicks only." /><StatCard label="Product clicks" value={String(summary.productClicks)} note="Content-to-shop clicks." /><StatCard label="Content-assisted paid orders" value={String(summary.contentAssistedPaidOrders)} note="Attribution, not direct causation." /><StatCard label="Content-assisted paid revenue" value={formatNaira(summary.contentAssistedPaidRevenue)} note="Paid orders carrying content attribution." /></div>
    <div className="mt-6 grid gap-3 rounded-lg bg-white p-5 shadow-sm md:grid-cols-4">{[["Posts","/admin/content/posts"],["Categories","/admin/content/categories"],["Tags","/admin/content/tags"],["Authors","/admin/content/authors"],["Sources","/admin/content/sources"],["Subscribers","/admin/content/subscribers"]].map(([label, href]) => <Link key={href} href={href} className="rounded-lg border border-green-900/10 p-4 text-sm font-bold text-green-950 hover:bg-green-50">{label}</Link>)}</div>
  </div>;
}
