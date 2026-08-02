import { z } from "zod";
import { normalizeEmail, normalizeNigerianPhone } from "./normalization.ts";

export const OUTREACH_CHANNEL_ORDER = [
  "whatsapp", "email", "instagram", "phone", "facebook", "tiktok", "x", "youtube", "other", "website",
] as const;
export const OUTREACH_OUTCOMES = [
  "interested", "warm", "neutral", "not_interested", "opt_out", "irrelevant",
  "wants_pricing", "wants_product_list", "wants_call", "referred", "no_response", "cancelled",
] as const;

export type OutreachChannel = { id:string; platform:string; handleOrValue:string; profileUrl:string|null; active:boolean };
export function recommendOutreachChannels(channels:readonly OutreachChannel[]){return channels.filter((channel)=>channel.active&&channel.platform!=="website").sort((left,right)=>{
  const a=OUTREACH_CHANNEL_ORDER.indexOf(left.platform as typeof OUTREACH_CHANNEL_ORDER[number]);
  const b=OUTREACH_CHANNEL_ORDER.indexOf(right.platform as typeof OUTREACH_CHANNEL_ORDER[number]);
  return (a<0?99:a)-(b<0?99:b);
});}

function supplyDescription(category:string, productScope:string|null){return productScope?.trim()||`fresh farm produce relevant to ${category.toLowerCase()} operations`;}
export function generateDeterministicOutreachDraft(input:{sequenceNumber:1|2|3;businessName:string;businessCategory:string;city:string;state:string|null;productScope:string|null;deliverySummary:string|null}){
  const business=input.businessName.trim(); const products=supplyDescription(input.businessCategory,input.productScope);
  if(input.sequenceNumber===1)return `Hello ${business} team. I'm reaching out from Shields Farms. We supply ${products} to food and hospitality businesses. I would like to know who handles produce purchasing for your business so we can share our current availability, pricing and delivery options. Delivery arrangements depend on the required quantity, destination and logistics confirmation.`;
  if(input.sequenceNumber===2)return `Hello ${business} team. I’m following up on my earlier message from Shields Farms about ${products}. Please let me know who handles produce purchasing so we can share current availability and pricing. Delivery depends on quantity, destination and logistics confirmation.`;
  return `Hello ${business} team. This is a final follow-up from Shields Farms regarding ${products}. If this is relevant, please share the best contact for produce purchasing and we can send current availability and pricing. Thank you.`;
}

export function nextOutreachSequence(outreaches:readonly {sequence_number:number;status:string}[]){
  const sent=new Set(outreaches.filter((item)=>["sent","replied","no_response"].includes(item.status)).map((item)=>item.sequence_number));
  if(!sent.has(1))return 1 as const;if(!sent.has(2))return 2 as const;if(!sent.has(3))return 3 as const;return null;
}
export function nextFollowUpAt(sequenceNumber:number,sentAt:Date){if(sequenceNumber===1)return new Date(sentAt.getTime()+3*86_400_000);if(sequenceNumber===2)return new Date(sentAt.getTime()+4*86_400_000);return null;}

export function buildManualHandoff(input:{platform:string;value:string;profileUrl:string|null;message:string;subject?:string}){
  const message=input.message.trim();
  if(input.platform==="whatsapp"){const phone=normalizeNigerianPhone(input.value);return phone?`https://wa.me/${phone.replace("+","")}?text=${encodeURIComponent(message)}`:null;}
  if(input.platform==="email"){const email=normalizeEmail(input.value);return email?`mailto:${encodeURIComponent(email)}?subject=${encodeURIComponent(input.subject??"Fresh produce supply from Shields Farms")}&body=${encodeURIComponent(message)}`:null;}
  if(input.platform==="phone"){const phone=normalizeNigerianPhone(input.value);return phone?`tel:${phone}`:null;}
  if(["instagram","facebook","tiktok","x","youtube","other"].includes(input.platform))return input.profileUrl;
  return null;
}

export const outreachDraftSchema=z.object({prospectId:z.uuid(),channelId:z.uuid(),sequenceNumber:z.coerce.number().int().min(1).max(3),draftText:z.string().trim().min(1).max(4000)}).strict();
export const outreachApprovalSchema=z.object({outreachId:z.uuid(),approvedText:z.string().trim().min(1).max(4000)}).strict();
export const outreachSentSchema=z.object({outreachId:z.uuid(),sentText:z.string().trim().min(1).max(4000),senderAccountLabel:z.string().trim().min(1).max(200),confirmed:z.literal("yes")}).strict();
export const outreachOutcomeSchema=z.object({outreachId:z.uuid(),outcome:z.enum(OUTREACH_OUTCOMES),summary:z.string().trim().min(1).max(2000),commercialSignal:z.string().trim().max(500).default("")}).strict();
