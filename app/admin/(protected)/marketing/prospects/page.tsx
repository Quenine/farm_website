import { AdminHeader } from "@/src/components/admin";
import {
  Kpi,
  MarketingNav,
  money,
} from "@/src/components/marketing-command-ui";
import { loadMarketingTable } from "@/src/lib/marketing-command-centre";
import { ProspectEntryForm } from "@/src/components/marketing-entry-forms";
export const dynamic = "force-dynamic";
export default async function Page() {
  const data = await loadMarketingTable(
    "marketing_prospects",
    "id,business_name,business_category,stage,estimated_value,expected_frequency,source,assigned_follow_up_at,last_contact_at,created_at",
  );
  const rows = data.rows as unknown as Array<Record<string, unknown>>;
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
                      <p className="font-bold">{String(x.business_name)}</p>
                      <p className="text-xs text-stone-600">
                        {String(x.source || "Source unavailable")} ·{" "}
                        {money(Number(x.estimated_value || 0))}
                      </p>
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
