"use client";

import { useActionState } from "react";
import { updateCampaignStatusAction } from "@/app/admin/(protected)/marketing/sales-scout/actions";

const initial={ok:false,message:""};
export function CampaignStatusControls({campaignId}:{campaignId:string}) {
  const [result,action,pending]=useActionState(async (_previous:typeof initial,formData:FormData)=>updateCampaignStatusAction(formData),initial);
  return <div><form action={action} className="flex flex-wrap gap-2"><input type="hidden" name="campaignId" value={campaignId}/>{["active","paused","completed"].map(status=><button disabled={pending} key={status} name="status" value={status} className="h-10 rounded-full border px-4 text-sm font-bold capitalize disabled:opacity-50">{status}</button>)}</form>{result.message?<p aria-live="polite" className={`mt-2 text-sm font-bold ${result.ok?"text-green-800":"text-red-700"}`}>{result.message}</p>:null}</div>;
}