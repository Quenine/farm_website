import Link from "next/link";
import { notFound } from "next/navigation";
import { AdminHeader } from "@/src/components/admin";
import { Kpi, MarketingNav } from "@/src/components/marketing-command-ui";
import { requireAdmin } from "@/src/lib/admin-auth";
import { isSalesScoutEnabled } from "@/src/lib/sales-scout/access";
import { listAllSalesScoutCampaigns, loadSalesScoutQueue, loadSalesScoutSummary } from "@/src/lib/sales-scout/server";
import { updateCampaignStatusAction } from "./actions";

export const dynamic = "force-dynamic";
type Params = Record<string, string | undefined>;
const input = "h-11 rounded-lg border px-3";

function queryHref(filters: Params, page: number) {
  const params = new URLSearchParams();
  Object.entries(filters).forEach(([key, value]) => { if (value && key !== "page") params.set(key, value); });
  params.set("page", String(page));
  return `?${params}`;
}

export default async function Page({ searchParams }: { searchParams: Promise<Params> }) {
  await requireAdmin();
  if (!isSalesScoutEnabled()) notFound();
  const raw = await searchParams;
  const campaigns = await listAllSalesScoutCampaigns();
  const selected = campaigns.find((item) => item.campaignId === raw.campaignId) ?? campaigns[0];
  const scope = { ...raw, campaignId: selected?.campaignId };
  const [queue, summary] = await Promise.all([
    loadSalesScoutQueue(scope),
    loadSalesScoutSummary(selected?.campaignId),
  ]);
  return <>
    <AdminHeader title="Sales Scout" body="Owner-only prospect research and review workspace. No social message is sent automatically." />
    <MarketingNav />
    <div className="mb-5 flex flex-wrap gap-3"><Link href="/admin/marketing/sales-scout/new" className="inline-flex h-11 items-center rounded-full bg-green-800 px-5 font-bold text-white">Add candidate</Link></div>
    {selected ? <section className="mb-5 rounded-xl border bg-white p-5">
      <div className="grid gap-4 lg:grid-cols-[1fr_auto]"><div><h2 className="text-xl font-bold">{selected.name}</h2><p className="text-sm text-stone-600">{selected.city}, {selected.country} · {selected.targetCategories.join(", ")}</p><p className="mt-1 text-sm">Status: <strong>{selected.status}</strong> · Daily review target: {selected.dailyReviewTarget}</p></div>
      <form action={async (formData) => { "use server"; await updateCampaignStatusAction(formData); }} className="flex flex-wrap gap-2"><input type="hidden" name="campaignId" value={selected.campaignId}/>{["active","paused","completed"].map((status)=><button key={status} name="status" value={status} className="h-10 rounded-full border px-4 text-sm font-bold capitalize">{status}</button>)}</form></div>
    </section> : <p className="mb-5 rounded-xl border bg-white p-5">No Sales Scout campaign is configured.</p>}
    <section className="mb-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-6">
      <Kpi label="Total" value={summary.total}/><Kpi label="New" value={summary.new}/><Kpi label="Researching" value={summary.researching}/><Kpi label="Qualified" value={summary.qualified}/><Kpi label="Do-not-contact" value={summary.doNotContact}/><Kpi label="Average score" value={summary.averageScore ?? "—"} note="Qualification rule, not purchase probability"/>
    </section>
    <form className="mb-5 grid gap-3 rounded-xl border bg-white p-4 sm:grid-cols-2 xl:grid-cols-4">
      <select name="campaignId" defaultValue={selected?.campaignId} className={input}>{campaigns.map((campaign)=><option key={campaign.campaignId} value={campaign.campaignId}>{campaign.name}</option>)}</select>
      <input name="search" defaultValue={raw.search} placeholder="Search business or category" className={input}/>
      <select name="scoutStatus" defaultValue={raw.scoutStatus ?? ""} className={input}><option value="">All review statuses</option>{["new","researching","qualified","disqualified","closed","do_not_contact"].map((status)=><option key={status}>{status}</option>)}</select>
      <input name="city" defaultValue={raw.city} placeholder="City" className={input}/><input name="category" defaultValue={raw.category} placeholder="Category" className={input}/><input name="source" defaultValue={raw.source} placeholder="Discovery source" className={input}/><input name="minimumScore" type="number" min="0" max="100" defaultValue={raw.minimumScore} placeholder="Minimum score" className={input}/>
      <select name="sort" defaultValue={raw.sort ?? "newest"} className={input}><option value="newest">Newest</option><option value="highest_score">Highest score</option><option value="oldest_unreviewed">Oldest unreviewed</option></select>
      <div className="flex gap-2"><button className="h-11 rounded-full bg-green-800 px-5 font-bold text-white">Apply</button><Link href={selected ? `?campaignId=${selected.campaignId}` : "?"} className="inline-flex h-11 items-center rounded-full border px-5 font-bold">Clear</Link></div>
    </form>
    {queue.rows.length ? <div className="overflow-hidden rounded-xl border bg-white"><div className="overflow-x-auto"><table className="w-full min-w-[900px] text-left text-sm"><thead className="bg-green-950 text-white"><tr>{["Business","Category / location","Score","Review status","Commercial stage","Primary channel","Source","Discovered"].map((label)=><th key={label} className="px-4 py-3">{label}</th>)}</tr></thead><tbody className="divide-y">{queue.rows.map((row)=><tr key={row.id} className={row.doNotContact?"bg-red-50":row.scoutStatus==="qualified"?"bg-green-50":""}><td className="px-4 py-3"><Link href={`/admin/marketing/sales-scout/${row.id}`} className="font-bold text-green-900 hover:underline">{row.businessName}</Link></td><td className="px-4 py-3">{row.businessCategory ?? "—"}<br/><span className="text-xs text-stone-500">{[row.city,row.state,row.country].filter(Boolean).join(", ")}</span></td><td className="px-4 py-3 font-bold">{row.score ?? "Unscored"}</td><td className="px-4 py-3">{row.doNotContact?"do not contact":row.scoutStatus}</td><td className="px-4 py-3">{row.commercialStage}</td><td className="px-4 py-3">{row.channels[0]?`${row.channels[0].platform}: ${row.channels[0].value}`:"—"}</td><td className="px-4 py-3">{row.discoverySource ?? "—"}</td><td className="px-4 py-3">{new Date(row.discoveredAt ?? row.createdAt).toLocaleDateString("en-NG")}</td></tr>)}</tbody></table></div>
      <nav className="flex items-center justify-between border-t p-4"><Link aria-disabled={queue.page<=1} href={queryHref(raw,queue.page-1)} className="font-bold text-green-800 aria-disabled:pointer-events-none aria-disabled:opacity-40">Previous</Link><span>Page {queue.page} of {queue.totalPages}</span><Link aria-disabled={queue.page>=queue.totalPages} href={queryHref(raw,queue.page+1)} className="font-bold text-green-800 aria-disabled:pointer-events-none aria-disabled:opacity-40">Next</Link></nav>
    </div> : <section className="rounded-xl border bg-white p-8 text-center"><h2 className="text-xl font-bold">No prospects match these filters</h2><p className="mt-2 text-stone-600">Adjust the filters or add a public business candidate.</p></section>}
  </>;
}
