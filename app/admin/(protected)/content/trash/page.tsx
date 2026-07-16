import Link from "next/link";
import { notFound } from "next/navigation";
import { AdminHeader } from "@/src/components/admin";
import { AdminSubnav } from "@/src/components/content-admin/admin-subnav";
import { TrashManager } from "@/src/components/content-admin/trash-manager";
import { contentPublicConfig } from "@/src/config/site";
import { loadAdminEntity, loadTrashDependencies, type AdminEntity } from "@/src/lib/content-admin";

export const dynamic = "force-dynamic";
type TrashEntity = Exclude<AdminEntity, "subscribers">;
const sections: Array<[TrashEntity, string]> = [["posts", "Posts"], ["authors", "Authors"], ["categories", "Categories"], ["tags", "Tags"], ["sources", "Sources"], ["videos", "Videos"], ["partners", "Affiliate partners"], ["offers", "Affiliate offers"]];

export default async function TrashPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  if (!contentPublicConfig.hubEnabled) notFound();
  const params = await searchParams;
  const available = sections.filter(([entity]) => contentPublicConfig.affiliateEnabled || !["partners", "offers"].includes(entity));
  const requestedParam = typeof params.section === "string" ? params.section : "posts";
  const requested = requestedParam === "affiliate" ? "offers" : requestedParam;
  const entity = (available.some(([key]) => key === requested) ? requested : "posts") as TrashEntity;
  const q = typeof params.q === "string" ? params.q : undefined;
  const page = typeof params.page === "string" ? params.page : "1";
  const data = await loadAdminEntity(entity, { q, page, trash: "trash" });
  const records = await loadTrashDependencies(entity, data.records);
  const href = (target: TrashEntity, targetPage = 1) => { const query = new URLSearchParams({ section: target, page: String(targetPage) }); if (q) query.set("q", q); return `/admin/content/trash?${query}`; };
  return <div><AdminHeader title="Content & Affiliate Trash" body="Inspect, restore, or permanently delete soft-deleted publisher records. Archived content is not Trash." /><AdminSubnav /><nav className="mb-4 flex gap-2 overflow-x-auto">{available.map(([key, label]) => <Link key={key} href={href(key)} className={`shrink-0 rounded-full px-4 py-2 text-sm font-bold ${entity === key ? "bg-green-800 text-white" : "bg-white text-green-950"}`}>{label}</Link>)}</nav><form className="mb-5 flex gap-2"><input type="hidden" name="section" value={entity} /><input name="q" defaultValue={q} placeholder="Search Trash" className="h-11 flex-1 rounded-lg border border-stone-200 px-4 text-sm" /><button className="rounded-full bg-green-800 px-5 text-sm font-bold text-white">Search</button></form>{records.length ? <TrashManager entity={entity} records={records} /> : <div className="rounded-lg bg-white p-8 text-center shadow-sm"><h2 className="text-xl font-bold text-green-950">{data.count === 0 ? entity === "posts" ? "No trashed posts." : entity === "offers" ? "No trashed affiliate offers." : "Trash is empty." : "No matching trashed records."}</h2></div>}<nav className="mt-5 flex justify-between"><Link aria-disabled={data.page <= 1} href={data.page > 1 ? href(entity, data.page - 1) : "#"} className="font-bold text-green-800 aria-disabled:pointer-events-none aria-disabled:opacity-40">Previous</Link><span className="text-sm text-stone-600">Page {data.page} of {data.totalPages ?? 1}</span><Link aria-disabled={data.page >= (data.totalPages ?? 1)} href={data.page < (data.totalPages ?? 1) ? href(entity, data.page + 1) : "#"} className="font-bold text-green-800 aria-disabled:pointer-events-none aria-disabled:opacity-40">Next</Link></nav></div>;
}
