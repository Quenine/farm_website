"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { captureManualCandidateAction, previewManualCandidateAction } from "@/app/admin/(protected)/marketing/sales-scout/actions";
import type { SalesScoutCampaignDto } from "@/src/lib/sales-scout/server";
import { formatLocalDateTimeInput } from "@/src/lib/sales-scout/review";

type Channel = { platform: string; value: string; url: string; primary: boolean; sourceId: string; evidence: string };
const blank = (primary=false): Channel => ({ platform:"instagram",value:"",url:"",primary,sourceId:"",evidence:"" });
const input="h-11 w-full rounded-lg border px-3";

export function ManualCandidateForm({ campaigns }: { campaigns: SalesScoutCampaignDto[] }) {
  const router=useRouter(); const [pending,start]=useTransition();
  const [campaignId,setCampaignId]=useState(campaigns[0]?.campaignId ?? "");
  const campaign=campaigns.find((item)=>item.campaignId===campaignId) ?? campaigns[0];
  const [channels,setChannels]=useState<Channel[]>([blank(true)]);
  const [city,setCity]=useState(campaign?.city??""); const [state,setState]=useState(campaign?.state??""); const [country,setCountry]=useState(campaign?.country??"");
  const [preview,setPreview]=useState<Record<string,unknown>|null>(null);
  const [candidate,setCandidate]=useState<Record<string,unknown>|null>(null);
  const [message,setMessage]=useState("");
  const invalidate=()=>{setPreview(null);setCandidate(null);};
  const updateChannel=(index:number,patch:Partial<Channel>)=>{invalidate();setChannels((current)=>current.map((row,i)=>{
    const next={...row,...patch}; if(patch.primary&&i===index) return next; return patch.primary?{...next,primary:false}:next;
  }).map((row,i)=>patch.primary?{...row,primary:i===index}:row));};
  const build=(form:FormData)=>({
    campaignId, businessName:String(form.get("businessName")||""),businessCategory:String(form.get("businessCategory")||""),
    city:String(form.get("city")||""),state:String(form.get("state")||"")||undefined,country:String(form.get("country")||""),
    sourceUrl:String(form.get("sourceUrl")||""),observedAt:new Date(String(form.get("observedAt"))).toISOString(),
    publicDescription:String(form.get("publicDescription")||"")||undefined,
    serviceAreaCities:String(form.get("serviceAreaCities")||"").split(",").map(x=>x.trim()).filter(Boolean),
    mostRecentPublicActivityAt:form.get("mostRecentPublicActivityAt")?new Date(String(form.get("mostRecentPublicActivityAt"))).toISOString():undefined,
    recurringProduceDemandEvidence:String(form.get("recurringProduceDemandEvidence")||"")||undefined,
    demandBand:String(form.get("demandBand")||"unknown"),isInactiveOrClosed:form.get("isInactiveOrClosed")==="on",
    isConsumerOnly:form.get("isConsumerOnly")==="on",providerSourceId:String(form.get("providerSourceId")||"")||undefined,
    channels:channels.map(row=>({platform:row.platform,handleOrValue:row.value,profileUrl:row.url||undefined,
      isPrimary:row.primary,sourceId:row.sourceId||undefined,evidence:{note:row.evidence}})),
  });
  const onPreview=(event:React.FormEvent<HTMLFormElement>)=>{event.preventDefault();const next=build(new FormData(event.currentTarget));setCandidate(next);start(async()=>{const data=new FormData();data.set("candidate",JSON.stringify(next));const result=await previewManualCandidateAction(data);setMessage(result.message);setPreview(result.ok?(result.data as Record<string,unknown>):null);});};
  const choices=(preview?.allowedResolutionChoices as Array<{choice:string;prospectId?:string;prospect?:{businessName:string;city:string|null;scoutStatus:string|null}}>|undefined)??[];
  const capture=(choice:{choice:string;prospectId?:string})=>{if(!candidate)return;start(async()=>{const data=new FormData();data.set("candidate",JSON.stringify(candidate));data.set("resolution",JSON.stringify(choice));const result=await captureManualCandidateAction(data);setMessage(result.message);if(result.ok){const id=String((result.data as Record<string,unknown>).prospectId||"");if(/^[0-9a-f-]{36}$/i.test(id))router.push(`/admin/marketing/sales-scout/${id}`);}});};
  return <div className="grid gap-6 xl:grid-cols-[1.2fr_.8fr]"><form onSubmit={onPreview} onChange={invalidate} className="grid gap-5 rounded-xl border bg-white p-5">
    <fieldset className="grid gap-3 sm:grid-cols-2"><legend className="mb-3 text-xl font-bold">Campaign and business</legend>
      <label className="font-bold">Active campaign<select value={campaignId} onChange={e=>{const selected=campaigns.find(c=>c.campaignId===e.target.value);setCampaignId(e.target.value);setCity(selected?.city??"");setState(selected?.state??"");setCountry(selected?.country??"");invalidate();}} className={`${input} mt-1`}>{campaigns.map(c=><option key={c.campaignId} value={c.campaignId}>{c.name}</option>)}</select></label>
      <label className="font-bold">Business name<input name="businessName" required className={`${input} mt-1`}/></label>
      <label className="font-bold">Category<select name="businessCategory" required className={`${input} mt-1`}>{campaign?.targetCategories.map(x=><option key={x}>{x}</option>)}</select></label>
      <label className="font-bold">City<input name="city" required value={city} onChange={e=>setCity(e.target.value)} className={`${input} mt-1`}/></label>
      <label className="font-bold">State<input name="state" value={state} onChange={e=>setState(e.target.value)} className={`${input} mt-1`}/></label>
      <label className="font-bold">Country<input name="country" required value={country} onChange={e=>setCountry(e.target.value)} className={`${input} mt-1`}/></label>
      <label className="font-bold sm:col-span-2">Public source URL<input name="sourceUrl" type="url" required className={`${input} mt-1`}/></label>
      <label className="font-bold">Observed at<input name="observedAt" type="datetime-local" required defaultValue={formatLocalDateTimeInput(new Date())} className={`${input} mt-1`}/></label>
      <label className="font-bold">Provider source ID<input name="providerSourceId" className={`${input} mt-1`}/></label>
    </fieldset>
    <fieldset className="grid gap-3 sm:grid-cols-2"><legend className="mb-3 text-xl font-bold">Public evidence</legend>
      <label className="font-bold sm:col-span-2">Public description<textarea name="publicDescription" className="mt-1 min-h-24 w-full rounded-lg border p-3"/></label>
      <label className="font-bold">Service-area cities<input name="serviceAreaCities" placeholder="Lagos, Ikeja" className={`${input} mt-1`}/></label>
      <label className="font-bold">Most recent public activity<input name="mostRecentPublicActivityAt" type="datetime-local" className={`${input} mt-1`}/></label>
      <label className="font-bold sm:col-span-2">Recurring produce-demand evidence<textarea name="recurringProduceDemandEvidence" className="mt-1 min-h-24 w-full rounded-lg border p-3"/></label>
      <label className="font-bold">Demand band<select name="demandBand" className={`${input} mt-1`}>{["unknown","low","medium","high"].map(x=><option key={x}>{x}</option>)}</select></label>
      <div className="space-y-2 pt-6"><label className="flex gap-2"><input name="isInactiveOrClosed" type="checkbox"/>Appears inactive or closed</label><label className="flex gap-2"><input name="isConsumerOnly" type="checkbox"/>Consumer-only account</label></div>
    </fieldset>
    <fieldset className="space-y-3"><legend className="text-xl font-bold">Public contact channels</legend>{channels.map((row,index)=><div key={index} className="grid gap-2 rounded-lg bg-stone-50 p-3 sm:grid-cols-2">
      <select aria-label={`Channel ${index+1} platform`} value={row.platform} onChange={e=>updateChannel(index,{platform:e.target.value})} className={input}>{["instagram","facebook","tiktok","x","youtube","website","email","phone","whatsapp","other"].map(x=><option key={x}>{x}</option>)}</select>
      <input aria-label={`Channel ${index+1} handle or value`} required value={row.value} onChange={e=>updateChannel(index,{value:e.target.value})} placeholder="Handle or public value" className={input}/>
      <input aria-label={`Channel ${index+1} public profile URL`} type="url" value={row.url} onChange={e=>updateChannel(index,{url:e.target.value})} placeholder="Public profile URL" className={input}/>
      <input aria-label={`Channel ${index+1} source ID`} value={row.sourceId} onChange={e=>updateChannel(index,{sourceId:e.target.value})} placeholder="Optional source ID" className={input}/>
      <input aria-label={`Channel ${index+1} evidence`} value={row.evidence} onChange={e=>updateChannel(index,{evidence:e.target.value})} placeholder="Brief public evidence" className={input}/>
      <div className="flex items-center justify-between"><label className="flex gap-2"><input type="radio" name="primaryChannel" checked={row.primary} onChange={()=>updateChannel(index,{primary:true})}/>Primary</label>{channels.length>1?<button type="button" onClick={()=>{invalidate();setChannels(c=>c.filter((_,i)=>i!==index));}} className="font-bold text-red-700">Remove</button>:null}</div>
    </div>)}{channels.length<5?<button type="button" onClick={()=>{invalidate();setChannels(c=>[...c,blank()]);}} className="rounded-full border px-4 py-2 font-bold">Add channel</button>:null}</fieldset>
    <button disabled={pending} className="h-11 rounded-full bg-green-800 px-5 font-bold text-white">{pending?"Checking...":"Preview candidate"}</button>
    {message?<p aria-live="polite">{message}</p>:null}
  </form>
  <aside className="rounded-xl border bg-white p-5"><h2 className="text-xl font-bold">Preview before capture</h2>{preview?<div className="mt-4 space-y-4"><div><h3 className="font-bold">Normalized candidate, channels, scoring and matches</h3><pre className="mt-2 max-h-96 overflow-auto whitespace-pre-wrap rounded-lg bg-stone-50 p-3 text-xs">{JSON.stringify(preview,null,2)}</pre></div>{preview.exactMatch?<p className="text-sm text-amber-800">An exact identity already belongs to this business. Attach to reuse its existing history; creating a duplicate is unavailable.</p>:null}<div className="space-y-2">{choices.map((choice,index)=><button key={index} type="button" disabled={pending} onClick={()=>capture(choice)} className="block w-full rounded-full bg-green-800 px-4 py-2 font-bold text-white">{choice.choice==="create_new"?"Create new prospect":`Attach to ${choice.prospect?.businessName??"existing prospect"}${choice.prospect?.city?` - ${choice.prospect.city}`:""}${choice.prospect?.scoutStatus?` - ${choice.prospect.scoutStatus}`:""}`}</button>)}</div><p className="text-xs text-stone-500">Attachment is always an explicit owner choice. No prospect is silently merged.</p></div>:<p className="mt-3 text-stone-600">Complete the normal fields and preview. Capture is unavailable until preview succeeds.</p>}</aside></div>;
}
