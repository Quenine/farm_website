"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/src/lib/admin-auth";
import { requireSalesScoutEnabled } from "@/src/lib/sales-scout/access";
import { createManualDiscoveryResult } from "@/src/lib/sales-scout/discovery/manual";
import {
  duplicateResolutionSchema,
  qualificationFactsSchema,
} from "@/src/lib/sales-scout/schemas";
import {
  captureSalesScoutCandidate,
  previewSalesScoutCandidate,
  updateSalesScoutQualificationFacts,
  transitionSalesScoutReviewStatus,
  setSalesScoutDoNotContact,
  updateSalesScoutCampaignStatus,
  saveSalesScoutCampaign,
} from "@/src/lib/sales-scout/server";
import { campaignStatusSchema, doNotContactSchema, reviewTransitionSchema } from "@/src/lib/sales-scout/review";
import { approveOutreachDraft, confirmOutreachSent, recordOutreachOutcome, saveOutreachDraft } from "@/src/lib/sales-scout/outreach-server";

export type SalesScoutActionState = {
  ok: boolean;
  message: string;
  data?: object;
};

const jsonText = z.string().max(100_000).transform((value, context) => {
  try {
    return JSON.parse(value) as unknown;
  } catch {
    context.addIssue({ code: "custom", message: "Invalid JSON payload." });
    return z.NEVER;
  }
});

async function guardAction() {
  const actor = await requireAdmin();
  requireSalesScoutEnabled();
  return actor;
}

function failure(error: unknown): SalesScoutActionState {
  console.error("Sales Scout action failed", {
    name: error instanceof Error ? error.name : "UnknownError",
  });
  return { ok: false, message: "The Sales Scout operation could not be completed." };
}

export async function previewManualCandidateAction(
  formData: FormData,
): Promise<SalesScoutActionState> {
  try {
    await guardAction();
    const raw = jsonText.parse(formData.get("candidate"));
    const manual = createManualDiscoveryResult([raw]);
    if (manual.ok === false) {
      return { ok: false, message: "Candidate validation failed.", data: manual.errors };
    }
    if (!manual.candidates[0]) return { ok: false, message: "Candidate validation failed." };
    return { ok: true, message: "Candidate preview ready.", data: await previewSalesScoutCandidate(manual.candidates[0]) };
  } catch (error) {
    return failure(error);
  }
}

export async function captureManualCandidateAction(
  formData: FormData,
): Promise<SalesScoutActionState> {
  try {
    await guardAction();
    const raw = jsonText.parse(formData.get("candidate"));
    const resolution = duplicateResolutionSchema.parse(
      jsonText.parse(formData.get("resolution")),
    );
    const manual = createManualDiscoveryResult([raw]);
    if (manual.ok === false) {
      return { ok: false, message: "Candidate validation failed.", data: manual.errors };
    }
    if (!manual.candidates[0]) return { ok: false, message: "Candidate validation failed." };
    return {
      ok: true,
      message: "Candidate captured.",
      data: await captureSalesScoutCandidate({ candidate: manual.candidates[0], resolution }),
    };
  } catch (error) {
    return failure(error);
  }
}

export async function updateQualificationFactsAction(
  formData: FormData,
): Promise<SalesScoutActionState> {
  try {
    await guardAction();
    const facts = qualificationFactsSchema.parse(
      jsonText.parse(formData.get("facts")),
    );
    return {
      ok: true,
      message: "Qualification facts updated.",
      data: await updateSalesScoutQualificationFacts(facts),
    };
  } catch (error) {
    return failure(error);
  }
}

export async function transitionReviewStatusAction(formData: FormData): Promise<SalesScoutActionState> {
  try {
    await guardAction();
    const payload = reviewTransitionSchema.parse({ prospectId: formData.get("prospectId"), targetStatus: formData.get("targetStatus"), reason: formData.get("reason") || undefined });
    const data = await transitionSalesScoutReviewStatus(payload);
    revalidatePath(`/admin/marketing/sales-scout/${payload.prospectId}`);
    revalidatePath("/admin/marketing/sales-scout");
    return { ok: true, message: data.changed ? "Review status updated." : "Review status was already current.", data };
  } catch (error) { return failure(error); }
}

export async function doNotContactAction(formData: FormData): Promise<SalesScoutActionState> {
  try {
    await guardAction();
    const payload = doNotContactSchema.parse({ prospectId: formData.get("prospectId"), reason: formData.get("reason"), source: formData.get("source") });
    const data = await setSalesScoutDoNotContact(payload);
    revalidatePath(`/admin/marketing/sales-scout/${payload.prospectId}`);
    revalidatePath("/admin/marketing/sales-scout");
    return { ok: true, message: "Prospect marked do not contact.", data };
  } catch (error) { return failure(error); }
}

export async function updateCampaignStatusAction(formData: FormData): Promise<SalesScoutActionState> {
  try {
    await guardAction();
    const payload = campaignStatusSchema.parse({ campaignId: formData.get("campaignId"), status: formData.get("status") });
    const data = await updateSalesScoutCampaignStatus(payload);
    revalidatePath("/admin/marketing/sales-scout");
    revalidatePath("/admin/marketing/sales-scout/new");
    return { ok: true, message: "Campaign status updated.", data };
  } catch (error) { return failure(error); }
}

export async function saveCampaignAction(formData: FormData): Promise<SalesScoutActionState> {
  try {
    await guardAction();
    const payload = JSON.parse(z.string().max(20_000).parse(formData.get("payload"))) as unknown;
    const data = await saveSalesScoutCampaign(payload);
    revalidatePath("/admin/marketing/sales-scout");
    revalidatePath("/admin/marketing/sales-scout/discover");
    return { ok:true,message:"Campaign saved. Discovery was not started.",data };
  } catch(error){return failure(error);}
}

export async function saveOutreachDraftAction(formData:FormData):Promise<SalesScoutActionState>{try{await guardAction();const data=await saveOutreachDraft(Object.fromEntries(formData));revalidatePath(`/admin/marketing/sales-scout/${formData.get("prospectId")}`);return{ok:true,message:"Editable draft saved.",data:data as object};}catch(error){return failure(error);}}
export async function approveOutreachAction(formData:FormData):Promise<SalesScoutActionState>{try{await guardAction();const data=await approveOutreachDraft(Object.fromEntries(formData));revalidatePath("/admin/marketing/sales-scout");return{ok:true,message:"Draft approved for manual handoff.",data:data as object};}catch(error){return failure(error);}}
export async function markOutreachSentAction(formData:FormData):Promise<SalesScoutActionState>{try{await guardAction();const data=await confirmOutreachSent(Object.fromEntries(formData));revalidatePath("/admin/marketing/sales-scout");return{ok:true,message:"Manual send recorded and follow-up scheduled.",data:data as object};}catch(error){return failure(error);}}
export async function recordOutreachOutcomeAction(formData:FormData):Promise<SalesScoutActionState>{try{await guardAction();const data=await recordOutreachOutcome(Object.fromEntries(formData));revalidatePath("/admin/marketing/sales-scout");return{ok:true,message:"Outreach outcome recorded.",data:data as object};}catch(error){return failure(error);}}