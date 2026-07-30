import Link from "next/link";
import { notFound } from "next/navigation";
import { AdminHeader } from "@/src/components/admin";
import { MarketingNav } from "@/src/components/marketing-command-ui";
import { ManualCandidateForm } from "@/src/components/sales-scout/manual-candidate-form";
import { requireAdmin } from "@/src/lib/admin-auth";
import { isSalesScoutEnabled } from "@/src/lib/sales-scout/access";
import { listSalesScoutCampaigns } from "@/src/lib/sales-scout/server";

export const dynamic = "force-dynamic";
export default async function Page() {
  await requireAdmin();
  if (!isSalesScoutEnabled()) notFound();
  const campaigns = await listSalesScoutCampaigns();
  return <>
    <AdminHeader title="Add Sales Scout candidate" body="Capture public business evidence, preview normalization and duplicates, then choose the result explicitly." />
    <MarketingNav />
    <Link href="/admin/marketing/sales-scout" className="mb-4 inline-flex h-11 items-center font-bold text-green-800">Back to Sales Scout</Link>
    {campaigns.length ? <ManualCandidateForm campaigns={campaigns}/> : <p className="rounded-xl border bg-white p-5">No active campaign is available. Activate one from the Sales Scout queue first.</p>}
  </>;
}
