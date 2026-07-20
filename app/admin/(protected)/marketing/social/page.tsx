import { AdminHeader } from "@/src/components/admin";
import { MarketingNav } from "@/src/components/marketing-command-ui";
import { loadMarketingTable } from "@/src/lib/marketing-command-centre";
import { SocialEntryForm } from "@/src/components/marketing-entry-forms";
export const dynamic = "force-dynamic";
export default async function Page() {
  const data = await loadMarketingTable(
    "marketing_social_activities",
    "id,platform,content_type,publication_url,scheduled_at,published_at,status,reach,impressions,likes,comments,shares,saves,direct_message_leads,attributed_orders,created_at",
  );
  return (
    <>
      <AdminHeader
        title="Social activity log"
        body="Scheduling and performance metrics are manually entered and are not independently verified."
      />
      <MarketingNav />
      <SocialEntryForm />
      {data.error ? (
        <p className="rounded-lg bg-amber-50 p-4">
          Apply the Batch 4 migration to enable social activity logging.
        </p>
      ) : (
        <div className="overflow-x-auto rounded-xl border bg-white">
          <table className="min-w-[900px] w-full text-left text-sm">
            <thead>
              <tr>
                {[
                  "Platform",
                  "Content",
                  "Status",
                  "Scheduled",
                  "Published",
                  "Reach*",
                  "Views*",
                  "Likes*",
                  "Shares*",
                  "DM leads*",
                  "Attributed orders*",
                ].map((x) => (
                  <th key={x} className="p-3">
                    {x}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {(data.rows as unknown as Array<Record<string, unknown>>).map((x) => (
                <tr key={String(x.id)} className="border-t">
                  {[
                    "platform",
                    "content_type",
                    "status",
                    "scheduled_at",
                    "published_at",
                    "reach",
                    "impressions",
                    "likes",
                    "shares",
                    "direct_message_leads",
                    "attributed_orders",
                  ].map((key) => (
                    <td key={key} className="p-3">
                      {String(x[key] ?? "—")}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
          <p className="p-3 text-xs text-stone-500">
            * Manually reported platform metrics.
          </p>
        </div>
      )}
    </>
  );
}
