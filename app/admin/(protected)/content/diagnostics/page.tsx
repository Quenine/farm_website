import { notFound } from "next/navigation";
import { AdminHeader } from "@/src/components/admin";
import { AdminSubnav } from "@/src/components/content-admin/admin-subnav";
import { contentPublicConfig } from "@/src/config/site";
import { loadContentDiagnostics } from "@/src/lib/content-admin-diagnostics";

export const dynamic = "force-dynamic";

export default async function ContentDiagnosticsPage() {
  if (!contentPublicConfig.hubEnabled) notFound();
  const diagnostics = await loadContentDiagnostics();
  const configRows = [
    ["Content Hub enabled", diagnostics.configuration.contentHubEnabled],
    ["Affiliate Content enabled", diagnostics.configuration.affiliateContentEnabled],
    ["Content Tools enabled", diagnostics.configuration.contentToolsEnabled],
    ["Content Subscriptions enabled", diagnostics.configuration.contentSubscriptionsEnabled],
    ["Content Indexing enabled", diagnostics.configuration.contentIndexingEnabled],
    ["Admin data client available", diagnostics.configuration.adminDataClientAvailable],
  ] as const;
  return <div><AdminHeader title="Content Diagnostics" body="Safe checks for Shields content publisher configuration and database access. No secrets, subscriber emails, customer details, or internal notes are shown." /><AdminSubnav /><section className="rounded-lg bg-white p-5 shadow-sm"><h2 className="text-xl font-bold text-green-950">Configuration</h2><p className="mt-2 text-sm text-stone-600">Canonical site URL: {diagnostics.configuration.canonicalSiteUrl}</p><div className="mt-4 grid gap-2 md:grid-cols-2">{configRows.map(([label, value]) => <div key={label} className="flex justify-between rounded-lg bg-green-50 p-3 text-sm"><span className="font-semibold text-green-950">{label}</span><span className={value ? "font-bold text-green-800" : "font-bold text-amber-700"}>{value ? "Yes" : "No"}</span></div>)}</div></section><section className="mt-6 rounded-lg bg-white p-5 shadow-sm"><h2 className="text-xl font-bold text-green-950">Database connectivity</h2><div className="mt-4 overflow-x-auto"><table className="w-full min-w-[760px] text-left text-sm"><thead className="bg-green-950 text-white"><tr><th className="px-4 py-3">Check</th><th>Status</th><th>Rows</th><th>Diagnostic code</th><th>Message</th></tr></thead><tbody className="divide-y divide-stone-100">{diagnostics.checks.map((check) => <tr key={check.code}><td className="px-4 py-3 font-bold text-green-950">{check.name}</td><td>{check.status === "ready" ? "Ready" : check.status === "empty" ? "Empty but ready" : "Failed"}</td><td>{check.rowCount ?? "-"}</td><td>{check.code}</td><td>{check.message}</td></tr>)}</tbody></table></div>{diagnostics.checks.length === 0 ? <p className="mt-4 text-sm text-amber-700">Admin data client is not configured.</p> : null}</section></div>;
}
