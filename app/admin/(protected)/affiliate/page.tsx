import Link from "next/link";
import { notFound } from "next/navigation";
import { AdminHeader, StatCard } from "@/src/components/admin";
import { AdminSubnav } from "@/src/components/content-admin/admin-subnav";
import { contentPublicConfig } from "@/src/config/site";
import { loadAffiliateDashboard } from "@/src/lib/content-admin";

export const dynamic = "force-dynamic";

const explainerCards = [
  { title: "Partner", body: "An affiliate partner is the merchant, marketplace, network or company whose programme Shields Farms has joined." },
  { title: "Offer", body: "An affiliate offer is a particular product or service together with the unique tracking URL supplied by that partner." },
  { title: "Redirect", body: "Public recommendation buttons use a Shields Farms /recommend/[slug] link. The route records an eligible click and redirects the reader to the merchant's stored affiliate URL." },
  { title: "Commission", body: "The external merchant or affiliate network records qualifying purchases and pays commissions. Shields Farms records outbound clicks only." },
];

export default async function AffiliateAdminPage() {
  if (!contentPublicConfig.affiliateEnabled) notFound();
  const summary = await loadAffiliateDashboard();
  return (
    <div>
      <AdminHeader title="Affiliate Publisher" body="Manage external merchant partners and offers. No commissions, conversion revenue or payout balances are tracked here." />
      <AdminSubnav type="affiliate" />
      <section className="mb-6 grid gap-3 md:grid-cols-2">
        {explainerCards.map((item) => (
          <div key={item.title} className="rounded-lg border border-green-900/10 bg-white p-4 shadow-sm">
            <h2 className="text-sm font-bold uppercase tracking-[0.14em] text-green-800">{item.title}</h2>
            <p className="mt-2 text-sm leading-6 text-stone-700">{item.body}</p>
          </div>
        ))}
      </section>
      <div className="mb-6 flex flex-wrap gap-3">
        <Link href="/admin/affiliate/partners" className="rounded-full bg-green-800 px-5 py-3 text-sm font-bold text-white">Create Partner</Link>
        <Link href="/admin/affiliate/offers" className="rounded-full border border-green-800 px-5 py-3 text-sm font-bold text-green-950">Create Offer</Link>
        <Link href="/admin/content/trash?section=offers" className="rounded-full border border-stone-500 px-5 py-3 text-sm font-bold text-stone-800">Trash ({summary.trashedPartners + summary.trashedOffers})</Link>
      </div>
      <div className="grid gap-4 md:grid-cols-5">
        <StatCard label="Total partners" value={String(summary.totalPartners)} note="Non-trashed merchant partners." />
        <StatCard label="Active partners" value={String(summary.activePartners)} note="Visible for active offers." />
        <StatCard label="Total offers" value={String(summary.totalOffers)} note="Non-trashed stored offers." />
        <StatCard label="Active offers" value={String(summary.activeOffers)} note="Redirectable offers." />
        <StatCard label="Affiliate clicks" value={String(summary.affiliateClicks)} note="Outbound recommendation clicks." />
      </div>
      <div className="mt-6 grid gap-6 lg:grid-cols-2"><Panel title="Top clicked offers" rows={summary.topOffers} /><Panel title="Top referring articles" rows={summary.topPosts} /></div>
    </div>
  );
}

function Panel({ title, rows }: { title: string; rows: Array<{ label: string; count: number }> }) {
  return <section className="rounded-lg bg-white p-5 shadow-sm"><h2 className="text-xl font-bold text-green-950">{title}</h2><div className="mt-4 grid gap-2">{rows.length ? rows.map((row) => <div key={row.label} className="flex justify-between rounded-lg bg-green-50 p-3 text-sm"><span>{row.label}</span><strong>{row.count}</strong></div>) : <p className="text-sm text-stone-600">No clicks yet.</p>}</div></section>;
}
