import Link from "next/link";
import { notFound } from "next/navigation";
import { AdminHeader } from "@/src/components/admin";
import { MarketingNav } from "@/src/components/marketing-command-ui";
import { CampaignStatusControls } from "@/src/components/sales-scout/campaign-status-controls";
import { ManualCandidateForm } from "@/src/components/sales-scout/manual-candidate-form";
import { requireAdmin } from "@/src/lib/admin-auth";
import { isSalesScoutEnabled } from "@/src/lib/sales-scout/access";
import { deriveCandidateSetupState } from "@/src/lib/sales-scout/review";
import { listAllSalesScoutCampaigns, listSalesScoutCampaigns } from "@/src/lib/sales-scout/server";

export const dynamic = "force-dynamic";
export default async function Page({searchParams}:{searchParams:Promise<{campaignId?:string}>}) {
  await requireAdmin();
  if (!isSalesScoutEnabled()) notFound();
  const [{campaignId:requestedCampaignId},allCampaigns,activeCampaigns]=await Promise.all([
    searchParams,listAllSalesScoutCampaigns(),listSalesScoutCampaigns(),
  ]);
  const state=deriveCandidateSetupState(allCampaigns,requestedCampaignId);
  return <>
    <AdminHeader title="Add Sales Scout candidate" body="Capture public business evidence, preview normalization and duplicates, then choose the result explicitly." />
    <MarketingNav />
    <Link href="/admin/marketing/sales-scout" className="mb-4 inline-flex h-11 items-center font-bold text-green-800">Back to Sales Scout</Link>
    {state.kind==="missing"?<section className="rounded-xl border bg-white p-5"><h2 className="text-xl font-bold">Sales Scout campaign configuration is missing</h2><p className="mt-2 text-stone-600">Configure a city and category campaign before adding candidates.</p></section>:state.kind==="ready"?<ManualCandidateForm campaigns={activeCampaigns} initialCampaignId={state.initialCampaignId}/>:<section className="rounded-xl border bg-white p-5">
      <h2 className="text-xl font-bold">Activate a campaign to start prospecting</h2>
      <p className="mt-2 text-stone-600">Candidates belong to an active city/category campaign. Activation does not send messages or perform discovery automatically.</p>
      {state.requestedCampaign?<p className="mt-3 rounded-lg bg-amber-50 p-3 font-bold">{state.requestedCampaign.name} is currently {state.requestedCampaign.status}. Activate it explicitly to continue with that campaign.</p>:null}
      <div className="mt-5 grid gap-4 lg:grid-cols-2">{allCampaigns.map(campaign=><article key={campaign.campaignId} className="rounded-xl border p-4"><h3 className="text-lg font-bold">{campaign.name}</h3><p className="text-sm text-stone-600">{campaign.city}, {campaign.country}</p><p className="mt-2 text-sm"><strong>Categories:</strong> {campaign.targetCategories.join(", ")}</p><p className="text-sm"><strong>Daily review target:</strong> {campaign.dailyReviewTarget}</p><div className="mt-3">{campaign.status==="active"?<><p className="mb-2 inline-flex rounded-full bg-green-100 px-3 py-1 text-sm font-bold text-green-900">Current status: active</p><br/><Link href={`/admin/marketing/sales-scout/new?campaignId=${campaign.campaignId}`} className="inline-flex h-10 items-center rounded-full bg-green-800 px-4 text-sm font-bold text-white">Use this active campaign</Link></>:<CampaignStatusControls campaignId={campaign.campaignId} currentStatus={campaign.status} context="candidate_setup" continueOnActivate/>}</div></article>)}</div>
    </section>}
  </>;
}