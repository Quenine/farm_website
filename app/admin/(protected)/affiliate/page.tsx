import Link from "next/link";
import { notFound } from "next/navigation";
import { AdminHeader, StatCard } from "@/src/components/admin";
import { AdminSubnav } from "@/src/components/content-admin/admin-subnav";
import { contentPublicConfig } from "@/src/config/site";
import { loadAffiliateDashboard } from "@/src/lib/content-admin";

export const dynamic = "force-dynamic";

export default async function AffiliateAdminPage() {
  if (!contentPublicConfig.affiliateEnabled) notFound();
  const summary = await loadAffiliateDashboard();
  return <div><AdminHeader title="Affiliate Publisher" body="Manage external merchant partners and offers. No commissions, conversion revenue or payout balances are tracked here." /><AdminSubnav type="affiliate" /><div className="mb-6 flex flex-wrap gap-3"><Link href="/admin/affiliate/partners" className="rounded-full bg-green-800 px-5 py-3 text-sm font-bold text-white">Create Partner</Link><Link href="/admin/affiliate/offers" className="rounded-full border border-green-800 px-5 py-3 text-sm font-bold text-green-950">Create Offer</Link></div><div className="grid gap-4 md:grid-cols-5"><StatCard label="Total partners" value={String(summary.totalPartners)} note="All merchant partners." /><StatCard label="Active partners" value={String(summary.activePartners)} note="Visible for active offers." /><StatCard label="Total offers" value={String(summary.totalOffers)} note="All stored offers." /><StatCard label="Active offers" value={String(summary.activeOffers)} note="Redirectable offers." /><StatCard label="Affiliate clicks" value={String(summary.affiliateClicks)} note="Outbound recommendation clicks." /></div><div className="mt-6 grid gap-6 lg:grid-cols-2"><Panel title="Top clicked offers" rows={summary.topOffers} /><Panel title="Top referring articles" rows={summary.topPosts} /></div></div>;
}
function Panel({ title, rows }: { title:string; rows:Array<{label:string;count:number}> }) { return <section className="rounded-lg bg-white p-5 shadow-sm"><h2 className="text-xl font-bold text-green-950">{title}</h2><div className="mt-4 grid gap-2">{rows.length ? rows.map((row)=><div key={row.label} className="flex justify-between rounded-lg bg-green-50 p-3 text-sm"><span>{row.label}</span><strong>{row.count}</strong></div>) : <p className="text-sm text-stone-600">No clicks yet.</p>}</div></section>; }
