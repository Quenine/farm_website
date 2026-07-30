"use client";

import { useActionState } from "react";
import { useRouter } from "next/navigation";
import { updateCampaignStatusAction, type SalesScoutActionState } from "@/app/admin/(protected)/marketing/sales-scout/actions";
import { campaignActionLabel, campaignStatusActions, type CampaignActionContext, type CampaignStatus } from "@/src/lib/sales-scout/review";

const initial: SalesScoutActionState={ok:false,message:""};
export function CampaignStatusControls({campaignId,currentStatus,context="queue",continueOnActivate=false}:{
  campaignId:string;
  currentStatus:CampaignStatus;
  context?:CampaignActionContext;
  continueOnActivate?:boolean;
}) {
  const router=useRouter();
  const [result,action,pending]=useActionState(async (_previous:SalesScoutActionState,formData:FormData)=>{
    const target=String(formData.get("status"));
    const next=await updateCampaignStatusAction(formData);
    if(next.ok){
      if(continueOnActivate&&target==="active") router.replace(`/admin/marketing/sales-scout/new?campaignId=${campaignId}`);
      router.refresh();
    }
    return next;
  },initial);
  const confirmCompletion=(event:React.FormEvent<HTMLFormElement>)=>{
    const submitter=(event.nativeEvent as SubmitEvent).submitter as HTMLButtonElement|null;
    if(submitter?.value==="completed"&&!confirm("Complete this campaign? It will no longer be available for candidate entry, but existing prospects and campaign history will remain.")) event.preventDefault();
  };
  return <div className="space-y-2">
    <p className="text-sm">Current status: <span className="inline-flex rounded-full bg-stone-100 px-3 py-1 font-bold capitalize">{currentStatus}</span></p>
    <form action={action} onSubmit={confirmCompletion} className="flex flex-wrap gap-2">
      <input type="hidden" name="campaignId" value={campaignId}/>
      {campaignStatusActions(currentStatus).map(status=><button disabled={pending} key={status} name="status" value={status} className="h-10 rounded-full border px-4 text-sm font-bold disabled:opacity-50">{campaignActionLabel(status,currentStatus,context)}</button>)}
    </form>
    {result.message?<p aria-live="polite" className={`text-sm font-bold ${result.ok?"text-green-800":"text-red-700"}`}>{result.message}</p>:null}
  </div>;
}