import { notFound } from "next/navigation";
import { AdminHeader, StatCard } from "@/src/components/admin";
import { AdminSubnav } from "@/src/components/content-admin/admin-subnav";
import { contentPublicConfig } from "@/src/config/site";
import { loadAdminEntity } from "@/src/lib/content-admin";

export const dynamic = "force-dynamic";

export default async function SubscribersAdminPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  if (!contentPublicConfig.subscriptionsEnabled) notFound();
  const filters = await searchParams;
  const data = await loadAdminEntity("subscribers", filters);
  const active = data.records.filter((row)=>row.status === "active").length;
  const unsubscribed = data.records.filter((row)=>row.status === "unsubscribed").length;
  const suppressed = data.records.filter((row)=>row.status === "suppressed").length;
  return <div><AdminHeader title="Subscribers" body="Admin-only subscriber list. No automatic email sending is implemented in this batch." /><AdminSubnav /><div className="grid gap-4 md:grid-cols-3"><StatCard label="Active" value={String(active)} note="Can receive future updates after email tooling is added." /><StatCard label="Unsubscribed" value={String(unsubscribed)} note="Opted out." /><StatCard label="Suppressed" value={String(suppressed)} note="Do not message." /></div><section className="mt-6 rounded-lg bg-white p-5 shadow-sm"><div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between"><h2 className="text-xl font-bold text-green-950">Subscriber records</h2><a href="/admin/content/subscribers/export" className="rounded-full bg-green-800 px-4 py-2 text-sm font-bold text-white">Export CSV</a></div><div className="mt-4 overflow-x-auto"><table className="w-full min-w-[880px] text-left text-sm"><thead className="bg-green-950 text-white"><tr><th className="px-4 py-3">Email</th><th>Status</th><th>Topic</th><th>Source path</th><th>Subscribed</th><th>Unsubscribed</th></tr></thead><tbody className="divide-y divide-stone-100">{data.records.map((row)=><tr key={String(row.id)}><td className="px-4 py-3 font-bold text-green-950">{String(row.email)}</td><td>{String(row.status)}</td><td>{String(row.subscription_topic ?? "-")}</td><td>{String(row.source_path ?? "-")}</td><td>{date(row.consented_at)}</td><td>{date(row.unsubscribed_at)}</td></tr>)}</tbody></table></div>{data.records.length === 0 ? <p className="mt-4 text-sm text-stone-600">No subscribers yet.</p> : null}</section></div>;
}
function date(value: unknown) { return typeof value === "string" && value ? new Date(value).toLocaleDateString("en-NG") : "-"; }
