"use server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireAdmin } from "@/src/lib/admin-auth";
import { requireSalesScoutDiscoveryEnabled } from "@/src/lib/sales-scout/access";
import { runSalesScoutDiscovery,dismissSalesScoutDiscoveryCandidate,captureStagedSalesScoutCandidate } from "@/src/lib/sales-scout/discovery/server";
const uuid=z.uuid();async function guard(){await requireAdmin();requireSalesScoutDiscoveryEnabled();}function refresh(id?:string){revalidatePath("/admin/marketing/sales-scout");revalidatePath("/admin/marketing/sales-scout/discover");if(id)revalidatePath(`/admin/marketing/sales-scout/discover/${id}`);}
export async function runDiscoveryAction(formData:FormData){try{await guard();const campaignId=uuid.parse(formData.get("campaignId"));await runSalesScoutDiscovery({campaignId});refresh();return;}catch{return;}}
export async function dismissDiscoveryCandidateAction(formData:FormData){try{await guard();const value=z.object({candidateId:uuid,reason:z.string().trim().min(3).max(500)}).parse(Object.fromEntries(formData));await dismissSalesScoutDiscoveryCandidate(value);refresh(value.candidateId);return;}catch{return;}}
export async function captureDiscoveryCandidateAction(formData:FormData){try{await guard();const candidateId=uuid.parse(formData.get("candidateId"));const resolution=JSON.parse(z.string().max(2000).parse(formData.get("resolution")));await captureStagedSalesScoutCandidate({candidateId,resolution});refresh(candidateId);return;}catch{return;}}