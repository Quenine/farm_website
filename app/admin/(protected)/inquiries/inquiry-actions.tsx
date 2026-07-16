"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { updateInquiryStatusAction } from "./actions";
export function InquiryActions({ id }: { id: string }) { const router=useRouter(); const [message,setMessage]=useState(""); const [pending,startTransition]=useTransition(); const update=(status:string)=>startTransition(async()=>{const result=await updateInquiryStatusAction(id,status);setMessage(result.message);if(result.success)router.refresh();}); return <div className="mt-3 flex flex-wrap gap-2">{[["in_progress","In progress"],["resolved","Resolved"],["spam","Spam"]].map(([status,label])=><button key={status} type="button" disabled={pending} onClick={()=>update(status)} className="rounded-full border border-green-800 px-3 py-1 text-xs font-bold text-green-950">{label}</button>)}{message?<span role="status" className="text-xs font-bold text-stone-600">{message}</span>:null}</div>; }
