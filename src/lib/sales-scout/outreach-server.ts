import "server-only";
import { requireAdmin } from "@/src/lib/admin-auth";
import { createAdminSupabaseClient } from "@/src/lib/supabase/admin";
import { requireSalesScoutEnabled } from "./access";
import { outreachApprovalSchema,outreachDraftSchema,outreachOutcomeSchema,outreachSentSchema } from "./outreach";

async function auth(){const actor=await requireAdmin();requireSalesScoutEnabled();return actor;}
function fail(reference:string,error?:{code?:string}):never{console.error("Sales Scout outreach database failure",{reference,code:error?.code??null});throw new Error(reference);}
export async function saveOutreachDraft(raw:unknown){const actor=await auth();const value=outreachDraftSchema.parse(raw);const out=await createAdminSupabaseClient().rpc("save_sales_scout_outreach_draft",{p_prospect_id:value.prospectId,p_channel_id:value.channelId,p_sequence_number:value.sequenceNumber,p_draft_text:value.draftText,p_actor_id:actor.id});if(out.error)fail("SCOUT_OUTREACH_DRAFT",out.error);return out.data;}
export async function approveOutreachDraft(raw:unknown){const actor=await auth();const value=outreachApprovalSchema.parse(raw);const out=await createAdminSupabaseClient().rpc("approve_sales_scout_outreach_draft",{p_outreach_id:value.outreachId,p_approved_text:value.approvedText,p_actor_id:actor.id});if(out.error)fail("SCOUT_OUTREACH_APPROVE",out.error);return out.data;}
export async function confirmOutreachSent(raw:unknown){const actor=await auth();const value=outreachSentSchema.parse(raw);const out=await createAdminSupabaseClient().rpc("confirm_sales_scout_outreach_sent",{p_outreach_id:value.outreachId,p_sent_text:value.sentText,p_sender_account_label:value.senderAccountLabel,p_sent_at:null,p_actor_id:actor.id,p_platform_reference:null});if(out.error)fail("SCOUT_OUTREACH_SENT",out.error);return out.data;}
export async function recordOutreachOutcome(raw:unknown){const actor=await auth();const value=outreachOutcomeSchema.parse(raw);const out=await createAdminSupabaseClient().rpc("record_sales_scout_outreach_outcome",{p_outreach_id:value.outreachId,p_outcome:value.outcome,p_summary:value.summary,p_commercial_signal:value.commercialSignal,p_replied_at:new Date().toISOString(),p_actor_id:actor.id});if(out.error)fail("SCOUT_OUTREACH_OUTCOME",out.error);return out.data;}
