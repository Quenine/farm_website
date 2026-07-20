import { AdminHeader } from "@/src/components/admin";
import {
  Kpi,
  MarketingNav,
  money,
} from "@/src/components/marketing-command-ui";
import { loadMarketingTable, marketingRange } from "@/src/lib/marketing-command-centre";
import { ProspectEntryForm } from "@/src/components/marketing-entry-forms";
import Link from "next/link";
import { QuickStageForm } from "@/src/components/prospect-manager";
import { type ProspectStage } from "@/src/lib/marketing-prospects";
export const dynamic = "force-dynamic";
type Filters = { search?: string; stage?: string; follow_up?: string; sort?: string };
export default async function Page({ searchParams }: { searchParams: Promise<Filters> }) {
  const filters = await searchParams;
  const currentBoundary = marketingRange("today").end;
  const data = await loadMarketingTable(
    "marketing_prospects",
    "id,business_name,business_category,stage,estimated_value,expected_frequency,source,assigned_follow_up_at,last_contact_at,created_at",
  );
  const search = filters.search?.trim().toLowerCase();
  let rows = (data.rows as unknown as Array<Record<string, unknown>>).filter((row) =>
    (!search || String(row.business_name).toLowerCase().includes(search) || String(row.business_category || "").toLowerCase().includes(search)) &&
    (!filters.stage || row.stage === filters.stage) &&
    (!filters.follow_up || (filters.follow_up === "overdue" && row.assigned_follow_up_at && String(row.assigned_follow_up_at) < currentBoundary) || (filters.follow_up === "none" && !row.assigned_follow_up_at))
  );
  rows = rows.sort((a, b) => filters.sort === "value" ? Number(b.estimated_value || 0) - Number(a.estimated_value || 0) : filters.sort === "follow_up" ? new Date(String(a.assigned_follow_up_at || "9999")).getTime() - new Date(String(b.assigned_follow_up_at || "9999")).getTime() : new Date(String(b.created_at)).getTime() - new Date(String(a.created_at)).getTime());
  const open = rows.filter((x) => !["won", "lost"].includes(String(x.stage)));
  const won = rows.filter((x) => x.stage === "won");
  return (
    <>
      <AdminHeader
        title="Business sales pipeline"
        body="Admin-only pipeline using existing Business Supply inquiries where linked. Contact details and notes remain private."
      />
      <MarketingNav />
      <ProspectEntryForm />
      <form className="mb-5 grid gap-3 rounded-xl border bg-white p-4 sm:grid-cols-2 lg:grid-cols-5">
        <input name="search" defaultValue={filters.search} placeholder="Search business or category" className="h-11 rounded-lg border px-3" />
        <select name="stage" defaultValue={filters.stage || ""} className="h-11 rounded-lg border px-3"><option value="">All stages</option>{["identified","contacted","responded","requirements_received","proposal_sent","negotiating","trial_order","recurring_customer","won","lost"].map((stage)=><option key={stage} value={stage}>{stage.replaceAll("_"," ")}</option>)}</select>
        <select name="follow_up" defaultValue={filters.follow_up || ""} className="h-11 rounded-lg border px-3"><option value="">Any follow-up</option><option value="overdue">Overdue</option><option value="none">Not scheduled</option></select>
        <select name="sort" defaultValue={filters.sort || "newest"} className="h-11 rounded-lg border px-3"><option value="newest">Newest</option><option value="follow_up">Follow-up date</option><option value="value">Estimated value</option></select>
        <button className="h-11 rounded-full bg-green-800 px-5 font-bold text-white">Apply filters</button>
      </form>
      {data.error ? (
        <p className="rounded-lg bg-amber-50 p-4">
          Apply database/20260720_marketing_command_centre.sql to enable the
          pipeline.
        </p>
      ) : (
        <>
          <section className="mb-5 grid gap-3 sm:grid-cols-3">
            <Kpi label="Open prospects" value={open.length} />
            <Kpi
              label="Pipeline value"
              value={money(
                open.reduce((s, x) => s + Number(x.estimated_value || 0), 0),
              )}
            />
            <Kpi
              label="Won value"
              value={money(
                won.reduce((s, x) => s + Number(x.estimated_value || 0), 0),
              )}
            />
          </section>
          <div className="grid gap-4 lg:grid-cols-3">
            {[
              "identified",
              "contacted",
              "responded",
              "requirements_received",
              "proposal_sent",
              "negotiating",
              "trial_order",
              "recurring_customer",
              "won",
              "lost",
            ].map((stage) => (
              <section key={stage} className="rounded-xl border bg-white p-4">
                <h2 className="font-bold capitalize">
                  {stage.replaceAll("_", " ")}
                </h2>
                {rows
                  .filter((x) => x.stage === stage)
                  .map((x) => (
                    <article
                      key={String(x.id)}
                      className="mt-3 rounded-lg bg-stone-50 p-3"
                    >
                      <Link href={`/admin/marketing/prospects/${x.id}`} className="font-bold text-green-950 underline-offset-4 hover:underline">{String(x.business_name)}</Link>
                      <p className="text-xs text-stone-600">
                        {String(x.source || "Source unavailable")} ·{" "}
                        {money(Number(x.estimated_value || 0))}
                      </p>
                      {x.assigned_follow_up_at && new Date(String(x.assigned_follow_up_at)).getTime() < Date.now() && !["won","lost"].includes(String(x.stage)) ? <p className="mt-2 rounded bg-red-100 p-2 text-xs font-bold text-red-800">Overdue follow-up</p> : !x.last_contact_at && new Date(String(x.created_at)).getTime() < Date.now() - 7 * 86400000 ? <p className="mt-2 rounded bg-amber-100 p-2 text-xs font-bold text-amber-900">No contact activity recorded</p> : null}
                      <div className="mt-3"><QuickStageForm id={String(x.id)} current={x.stage as ProspectStage} /></div>
                    </article>
                  ))}
              </section>
            ))}
          </div>
        </>
      )}
    </>
  );
}
