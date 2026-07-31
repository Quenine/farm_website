import Link from "next/link";
import { notFound } from "next/navigation";
import { DiscoveryRunForm } from "@/src/components/sales-scout/discovery-run-form";
import { requireAdmin } from "@/src/lib/admin-auth";
import {
  isSalesScoutDiscoveryEnabled,
  isSalesScoutEnabled,
} from "@/src/lib/sales-scout/access";
import {
  hasCompleteDiscoveryConfiguration,
  listSalesScoutDiscoveryCandidates,
  listSalesScoutDiscoveryRuns,
} from "@/src/lib/sales-scout/discovery/server";
import { listAllSalesScoutCampaigns } from "@/src/lib/sales-scout/server";

export const dynamic = "force-dynamic";
const RUN_PAGE_SIZE = 20;
const CANDIDATE_PAGE_SIZE = 25;

function positivePage(value?: string) {
  const page = Number.parseInt(value ?? "1", 10);
  return Number.isFinite(page) && page > 0 ? page : 1;
}

function pageHref(query: Record<string, string | undefined>, key: string, value: number) {
  const params = new URLSearchParams();
  for (const [name, item] of Object.entries(query)) if (item) params.set(name, item);
  params.set(key, String(value));
  return `?${params.toString()}`;
}

export default async function DiscoveryWorkspacePage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  await requireAdmin();
  if (!isSalesScoutEnabled() || !isSalesScoutDiscoveryEnabled()) notFound();

  const query = await searchParams;
  const campaigns = await listAllSalesScoutCampaigns();
  const campaign =
    campaigns.find((item) => item.campaignId === query.campaignId) ??
    campaigns.find((item) => item.status === "active") ??
    campaigns[0];

  if (!campaign) return <main className="p-6">No Sales Scout campaign exists.</main>;

  const runPage = positivePage(query.runPage);
  const candidatePage = positivePage(query.candidatePage);
  const [runs, candidates] = await Promise.all([
    listSalesScoutDiscoveryRuns({ campaignId: campaign.campaignId, page: runPage, pageSize: RUN_PAGE_SIZE }),
    listSalesScoutDiscoveryCandidates({
      campaignId: campaign.campaignId,
      status: query.status,
      search: query.search,
      mappingIssueOnly: query.mappingIssues === "1",
      page: candidatePage,
      pageSize: CANDIDATE_PAGE_SIZE,
    }),
  ]);

  return (
    <main className="space-y-6 p-6">
      <header>
        <Link href="/admin/marketing/sales-scout" className="text-green-800">← Sales Scout</Link>
        <h1 className="text-3xl font-bold">Discover businesses</h1>
        <p>No outreach is sent. DataForSEO charges may apply; maximum three starts per UTC day.</p>
      </header>

      <form method="get" className="flex flex-wrap items-end gap-3 rounded-xl border bg-white p-4">
        <label>
          <span className="block font-semibold">Campaign</span>
          <select name="campaignId" defaultValue={campaign.campaignId} className="rounded border p-2">
            {campaigns.map((item) => <option key={item.campaignId} value={item.campaignId}>{item.name}</option>)}
          </select>
        </label>
        <label>
          <span className="block font-semibold">Status</span>
          <select name="status" defaultValue={query.status ?? ""} className="rounded border p-2">
            <option value="">All</option>
            {["new", "reviewing", "duplicate", "captured", "dismissed"].map((status) => (
              <option key={status} value={status}>{status}</option>
            ))}
          </select>
        </label>
        <label>
          <span className="block font-semibold">Search</span>
          <input name="search" defaultValue={query.search} maxLength={100} className="rounded border p-2" />
        </label>
        <label className="flex gap-2 pb-2">
          <input type="checkbox" name="mappingIssues" value="1" defaultChecked={query.mappingIssues === "1"} />
          Mapping issues only
        </label>
        <button className="rounded-full bg-green-800 px-4 py-2 text-white">Apply filters</button>
        <Link href={`?campaignId=${campaign.campaignId}`} className="px-3 py-2 underline">Clear filters</Link>
      </form>

      <section className="rounded-xl border bg-white p-5">
        <h2 className="text-xl font-bold">{campaign.name}</h2>
        <p>{campaign.targetCategories.join(", ")}</p>
        <p>{campaign.discoveryLatitude}, {campaign.discoveryLongitude} · {campaign.discoveryRadiusKm} km · limit {campaign.discoveryDefaultLimit}</p>
        <DiscoveryRunForm
          campaignId={campaign.campaignId}
          disabled={campaign.status !== "active" || !hasCompleteDiscoveryConfiguration(campaign)}
        />
      </section>

      <section>
        <h2 className="text-xl font-bold">Recent runs</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead><tr><th>Started</th><th>Status/categories</th><th>Counts</th><th>Cost</th><th>Failure/completed</th></tr></thead>
            <tbody>
              {runs.rows.map((run) => (
                <tr key={run.id} className="border-b">
                  <td className="p-2">{new Date(run.started_at).toLocaleString("en-NG")}</td>
                  <td>{run.status}<br />{run.requested_categories.join(", ")}</td>
                  <td>{run.raw_result_count} raw / {run.staged_candidate_count} staged / {run.exact_duplicate_count} exact</td>
                  <td>{run.provider_cost_usd == null ? "—" : `$${run.provider_cost_usd}`}</td>
                  <td>{run.error_reference ?? "—"}<br />{run.completed_at ? new Date(run.completed_at).toLocaleString("en-NG") : "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <nav className="mt-3 flex gap-4">
          {runPage > 1 ? <Link href={pageHref(query, "runPage", runPage - 1)}>Previous runs</Link> : null}
          {runPage * RUN_PAGE_SIZE < runs.count ? <Link href={pageHref(query, "runPage", runPage + 1)}>Next runs</Link> : null}
        </nav>
      </section>

      <section>
        <h2 className="text-xl font-bold">Staged candidates ({candidates.count})</h2>
        <div className="grid gap-3">
          {candidates.rows.map((candidate) => (
            <Link key={candidate.id} href={`/admin/marketing/sales-scout/discover/${candidate.id}`} className="rounded-xl border bg-white p-4">
              <b>{candidate.business_name}</b>
              <p>{candidate.mapped_campaign_category ?? "Needs category review"} · {[candidate.city, candidate.state, candidate.country_code].filter(Boolean).join(", ") || "No location"}</p>
              <p>{candidate.status} · {candidate.exact_matching_prospect_id ? "exact match" : "not exact"} · {candidate.soft_match_warning_count} warnings · {candidate.mapping_issues.length} issues</p>
              <p>{candidate.public_phone ? "phone" : "no phone"} · {candidate.public_website ? "website" : "no website"} · seen {candidate.seen_count} · {new Date(candidate.last_seen_at).toLocaleString("en-NG")}</p>
            </Link>
          ))}
        </div>
        <nav className="mt-3 flex gap-4">
          {candidatePage > 1 ? <Link href={pageHref(query, "candidatePage", candidatePage - 1)}>Previous candidates</Link> : null}
          {candidatePage * CANDIDATE_PAGE_SIZE < candidates.count ? <Link href={pageHref(query, "candidatePage", candidatePage + 1)}>Next candidates</Link> : null}
        </nav>
      </section>
    </main>
  );
}
