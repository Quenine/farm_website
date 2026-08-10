import "server-only";

import { requireAdmin } from "@/src/lib/admin-auth";
import { createAdminSupabaseClient } from "@/src/lib/supabase/admin";
import { requireSalesScoutDiscoveryEnabled } from "../access";
import { captureSalesScoutCandidate, getSalesScoutCampaign, previewSalesScoutCandidate, type SalesScoutCampaignDto } from "../server";
import { normalizeLocationComparison } from "../normalization";
import { isStructuredGeoapifyCategory, unsupportedStructuredCategories } from "../territory";
import { isDirectContactRoute, runSeedFirstProductionResearch, productionResearchCostCeiling, type PublicContact } from "../research/production";
import { assessNigeriaOpportunity, canBecomeOutreachReady, reflectOwnerConfirmedContact, type OpportunityAssessment } from "../research/opportunity";
import { isCandidateContactFilter, paginateContactEvidenceRows } from "../research/quality";
import type { ResearchCategory } from "../research/types";
import { dismissalTransition } from "./helpers";
import type { DiscoveryCandidate, DiscoveryChannel } from "./types";

export class SalesScoutDiscoveryError extends Error {
  constructor(readonly reference: string, message = "The discovery operation could not be completed.") {
    super(message); this.name = "SalesScoutDiscoveryError";
  }
}

type DatabaseError = { code?: string };
function dbFail(reference: string, error?: DatabaseError): never {
  console.error("Sales Scout discovery database failure", { reference, code:error?.code ?? null });
  throw new SalesScoutDiscoveryError(reference);
}
async function auth() { const actor=await requireAdmin(); requireSalesScoutDiscoveryEnabled(); return actor; }
export function isGeoapifyConfigured(){return Boolean(process.env.GEOAPIFY_API_KEY?.trim());}
export function isTavilyEnrichmentEnabled(){return process.env.SALES_SCOUT_TAVILY_ENRICHMENT_ENABLED==="true";}
export function isTavilyConfigured(){
  return isTavilyEnrichmentEnabled()&&Boolean(process.env.TAVILY_API_KEY?.trim());
}
export function isPublicWebResearchEnabled(){return process.env.SALES_SCOUT_PUBLIC_WEB_RESEARCH_ENABLED==="true";}
export function isSerpApiConfigured(){return isPublicWebResearchEnabled()&&Boolean(process.env.SERPAPI_API_KEY?.trim());}
export function hasCompleteDiscoveryConfiguration(c:SalesScoutCampaignDto){return Boolean(c.state&&c.city&&c.discoveryRadiusKm&&c.discoveryDefaultLimit&&c.maxEnrichmentCandidates);}
export function providerConfigurationStatus(){return{
  geoapify:isGeoapifyConfigured(),
  tavily:isTavilyConfigured(),
  tavilyAuthorizationEnabled:isTavilyEnrichmentEnabled(),
  publicWebResearchEnabled:isPublicWebResearchEnabled(),
  serpapi:isSerpApiConfigured(),
  dataforseo:"disabled_legacy_adapter" as const,
};}
export { productionResearchCostCeiling };

export type DiscoveryRunSummary={runId:string;providerTaskId:string;rawResultCount:number;stagedCandidateCount:number;exactDuplicateCount:number;providerCredits:{geoapify:number;tavily:number;serpapi:number};mappingIssueCount:number;manualReviewReadyCount:number;outreachReadyCount:number};
export type DiscoveryRunRow={id:string;provider:string;research_method:string|null;status:string;requested_categories:string[];requested_result_limit:number;requested_enrichment_limit:number|null;provider_task_id:string|null;raw_result_count:number;staged_candidate_count:number;exact_duplicate_count:number;structured_seed_count:number;discarded_source_document_count:number;enrichment_attempted_count:number;enrichment_completed_count:number;official_websites_researched:number;manual_review_ready_count:number;outreach_ready_count:number;provider_credits:Record<string,number>;warning_references:string[];error_reference:string|null;started_at:string;completed_at:string|null};
export type DiscoveryCandidateRow={id:string;scout_campaign_id:string;provider:string;provider_source_id:string;geoapify_place_id:string|null;provider_source_url:string|null;business_name:string;provider_category:string|null;mapped_campaign_category:string|null;provider_category_ids:string[];additional_categories:string[];publicDescription:string|null;full_address:string|null;city:string|null;state:string|null;country_code:string|null;latitude:number|null;longitude:number|null;public_phone:string|null;public_website:string|null;observed_at:string;status:string;exact_matching_prospect_id:string|null;captured_prospect_id:string|null;soft_match_warning_count:number;mapping_issues:string[];dismissal_reason:string|null;first_seen_at:string;last_seen_at:string;seen_count:number;territory_match_evidence:Record<string,unknown>;distance_km:number|null;phone_routes:PublicContact[];email_routes:PublicContact[];whatsapp_routes:PublicContact[];social_profiles:PublicContact[];contact_evidence:PublicContact[];research_evidence:Array<Record<string,unknown>>;confidence_summary:Record<string,unknown>&{opportunity?:OpportunityAssessment};enrichment_status:string;research_issues:string[];manual_review_ready:boolean;outreach_ready:boolean;updated_at:string};
export type DiscoveryCandidateListRow=Pick<DiscoveryCandidateRow,"id"|"scout_campaign_id"|"provider"|"provider_source_id"|"business_name"|"mapped_campaign_category"|"city"|"state"|"country_code"|"status"|"exact_matching_prospect_id"|"soft_match_warning_count"|"mapping_issues"|"public_phone"|"public_website"|"last_seen_at"|"seen_count"|"full_address"|"contact_evidence"|"confidence_summary"|"research_issues"|"manual_review_ready"|"outreach_ready"|"enrichment_status">;
export type DiscoveryMembershipRow={discovery_run_id:string;candidate_id:string;is_exact_duplicate:boolean;exact_matching_prospect_id:string|null;soft_match_warning_count:number;created_at:string;marketing_sales_scout_discovery_runs:unknown};

function sourceUrl(candidate:{candidate:{evidence:Array<{source:string;sourceUrl:string}>}}){return candidate.candidate.evidence.find((item)=>item.source==="geoapify_places")?.sourceUrl??"https://www.geoapify.com/";}
function contactGroups(contacts:PublicContact[]){return{
  phoneRoutes:contacts.filter((contact)=>contact.route==="phone"),
  emailRoutes:contacts.filter((contact)=>contact.route==="email"),
  whatsappRoutes:contacts.filter((contact)=>contact.route==="whatsapp"),
  socialProfiles:contacts.filter((contact)=>["instagram","facebook","tiktok","x","youtube"].includes(contact.route)),
};}

export async function runSalesScoutDiscovery(input:{campaignId:string}):Promise<DiscoveryRunSummary>{
  const actor=await auth(); const campaign=await getSalesScoutCampaign(input.campaignId);
  if(campaign.status!=="active"||!hasCompleteDiscoveryConfiguration(campaign))throw new SalesScoutDiscoveryError("DISCOVERY_CAMPAIGN_NOT_READY","Campaign discovery configuration is incomplete.");
  const unsupported=unsupportedStructuredCategories(campaign.targetCategories);
  if(unsupported.length)throw new SalesScoutDiscoveryError("DISCOVERY_CATEGORY_UNSUPPORTED",`Structured discovery is not available for: ${unsupported.join(", ")}.`);
  if(!isGeoapifyConfigured())throw new SalesScoutDiscoveryError("GEOAPIFY_NOT_CONFIGURED");
  const categories=campaign.targetCategories.filter(isStructuredGeoapifyCategory) as ResearchCategory[];
  const database=createAdminSupabaseClient();
  const started=await database.rpc("start_sales_scout_research_run",{p_campaign_id:campaign.campaignId,p_categories:categories,p_result_limit:campaign.discoveryDefaultLimit,p_enrichment_limit:campaign.maxEnrichmentCandidates,p_actor_id:actor.id});
  if(started.error)dbFail("RESEARCH_START",started.error); const runId=String((started.data as Record<string,unknown>).runId);
  try{
    const research=await runSeedFirstProductionResearch({territory:{country:"Nigeria",state:campaign.state!,city:campaign.city,latitude:campaign.discoveryLatitude??undefined,longitude:campaign.discoveryLongitude??undefined,radiusKm:campaign.discoveryRadiusKm!},categories,resultLimit:campaign.discoveryDefaultLimit!,maxEnrichmentCandidates:campaign.maxEnrichmentCandidates!,tavilyConfigured:false,publicWebConfigured:isSerpApiConfigured(),geoapifyPlaceDetailsConfigured:true});
    const researchCandidates=research.candidates.flatMap((item)=>{
      const providerSourceId=item.candidate.sourceIdentities.geoapify_places?.trim();
      return providerSourceId?[{item,providerSourceId}]:[];
    });
    if(!researchCandidates.length)throw new SalesScoutDiscoveryError("GEOAPIFY_INVALID_SEED_IDENTITY");
    const ids=researchCandidates.map(({providerSourceId})=>providerSourceId);
    const exact=ids.length?await database.from("marketing_prospects").select("id,discovery_source_id,do_not_contact_at,scout_status,stage").eq("discovery_source","geoapify_tavily_research").in("discovery_source_id",ids).limit(500):{data:[],error:null};
    if(exact.error)dbFail("RESEARCH_EXACT_LOOKUP",exact.error); const exactById=new Map((exact.data??[]).map((row)=>[String(row.discovery_source_id),row]));
    let mappingIssueCount=0;
    const candidates=researchCandidates.map(({item,providerSourceId})=>{
      const candidate=item.candidate; const contacts=contactGroups(item.contacts); mappingIssueCount+=candidate.researchIssues.length;
      const crm=exactById.get(providerSourceId);const doNotContact=Boolean(crm?.do_not_contact_at)||crm?.scout_status==="do_not_contact";const currentCustomer=crm?.scout_status==="converted"||crm?.stage==="recurring_customer";const opportunity=assessNigeriaOpportunity({candidate,contacts:item.contacts,territoryMatch:item.territoryMatch,duplicate:Boolean(crm),doNotContact,currentCustomer});
      return{providerSourceId,businessName:candidate.businessName,providerCategory:candidate.providerCategories[0]??null,mappedCampaignCategory:candidate.requestedCategory,providerCategoryIds:candidate.providerCategories,additionalCategories:candidate.providerCategories.slice(1),mappingIssues:candidate.researchIssues,providerSourceUrl:sourceUrl(item),description:candidate.publicDescription,fullAddress:candidate.address,city:candidate.city,state:candidate.state,countryCode:"NG",latitude:candidate.latitude,longitude:candidate.longitude,phone:contacts.phoneRoutes[0]?.displayValue??null,website:candidate.website,observedAt:candidate.lastObservedAt,normalizedBusinessName:candidate.normalizedBusinessName,normalizedCity:candidate.city?normalizeLocationComparison(candidate.city):null,exactMatchingProspectId:crm?String(crm.id):null,softMatchWarningCount:0,territoryMatchEvidence:item.territoryMatch,distanceKm:item.territoryMatch.distanceKm,contacts:item.contacts,...contacts,researchEvidence:candidate.evidence,confidenceSummary:{highest:item.highestContactConfidence,verified:item.contacts.filter((contact)=>contact.confidence==="verified").length,plausible:item.contacts.filter((contact)=>contact.confidence==="plausible").length,opportunity},enrichmentStatus:item.enrichmentStatus,researchIssues:candidate.researchIssues,manualReviewReady:item.manualReviewReady,outreachReady:canBecomeOutreachReady({baseReady:item.outreachReady,doNotContact,currentCustomer})};
    });
    const providerTaskId=`research-${runId}`;
    const payload={providerTaskId,rawResultCount:research.rawResultCount,structuredSeedCount:research.structuredSeedCount,discardedSourceDocumentCount:research.discardedSourceDocumentCount,enrichmentAttemptedCount:research.enrichmentAttemptedCount,enrichmentCompletedCount:research.enrichmentCompletedCount,officialWebsitesResearched:research.officialWebsitesResearched,providerCredits:research.providerCredits,warnings:research.warnings,resolvedTerritory:{latitude:research.resolvedTerritory.latitude??null,longitude:research.resolvedTerritory.longitude??null},candidates};
    const completed=await database.rpc("complete_sales_scout_research_run",{p_run_id:runId,p_payload:payload,p_actor_id:actor.id}); if(completed.error)dbFail("RESEARCH_COMPLETE",completed.error);
    const dto=completed.data as Record<string,unknown>; return{runId,providerTaskId,rawResultCount:research.rawResultCount,stagedCandidateCount:Number(dto.stagedCandidateCount),exactDuplicateCount:Number(dto.exactDuplicateCount),providerCredits:research.providerCredits,mappingIssueCount,manualReviewReadyCount:research.manualReviewReadyCount,outreachReadyCount:research.outreachReadyCount};
  }catch(error){const reference=error instanceof SalesScoutDiscoveryError?error.reference:error instanceof Error&&"reference" in error?String((error as {reference:unknown}).reference):"RESEARCH_RUN_FAILED"; const failed=await database.rpc("fail_sales_scout_research_run",{p_run_id:runId,p_error_reference:reference,p_error_safe_message:"Research could not be completed.",p_actor_id:actor.id});if(failed.error)console.error("Research failure marking failed",{reference,code:failed.error.code});throw new SalesScoutDiscoveryError(reference);}
}

export async function listSalesScoutDiscoveryRuns({campaignId,page=1,pageSize=20}:{campaignId:string;page?:number;pageSize?:number}){await auth();pageSize=Math.min(50,Math.max(1,pageSize));const from=(Math.max(1,page)-1)*pageSize;const q=await createAdminSupabaseClient().from("marketing_sales_scout_discovery_runs").select("id,provider,research_method,status,requested_categories,requested_result_limit,requested_enrichment_limit,provider_task_id,raw_result_count,staged_candidate_count,exact_duplicate_count,structured_seed_count,discarded_source_document_count,enrichment_attempted_count,enrichment_completed_count,official_websites_researched,manual_review_ready_count,outreach_ready_count,provider_credits,warning_references,error_reference,started_at,completed_at",{count:"exact"}).eq("scout_campaign_id",campaignId).order("started_at",{ascending:false}).range(from,from+pageSize-1);if(q.error)dbFail("RESEARCH_RUN_LIST",q.error);return{rows:(q.data??[]) as DiscoveryRunRow[],count:q.count??0};}

export async function listSalesScoutDiscoveryCandidates({
  campaignId,status,search,filter,page=1,pageSize=25,
}:{
  campaignId:string;status?:string;search?:string;filter?:string;mappingIssueOnly?:boolean;
  page?:number;pageSize?:number;
}){
  await auth();
  pageSize=Math.min(50,Math.max(1,pageSize));
  const from=(Math.max(1,page)-1)*pageSize;
  const contactFilter=isCandidateContactFilter(filter);
  let q=createAdminSupabaseClient().from("marketing_sales_scout_discovery_candidates")
    .select("id,scout_campaign_id,provider,provider_source_id,business_name,mapped_campaign_category,city,state,country_code,status,exact_matching_prospect_id,soft_match_warning_count,mapping_issues,public_phone,public_website,full_address,contact_evidence,confidence_summary,research_issues,manual_review_ready,outreach_ready,enrichment_status,last_seen_at,seen_count",{count:"exact"})
    .eq("scout_campaign_id",campaignId).order("last_seen_at",{ascending:false});
  if(status)q=q.eq("status",status);
  if(search)q=q.ilike("business_name","%"+search.replaceAll("%","")+"%");
  if(filter==="manual_review_ready")q=q.eq("manual_review_ready",true);
  if(filter==="outreach_ready")q=q.eq("outreach_ready",true);
  if(filter==="needs_research")q=q.eq("manual_review_ready",false);
  if(filter==="captured"||filter==="dismissed")q=q.eq("status",filter);
  if(filter==="highest_opportunity"){
    const out=await q.range(0,1000);if(out.error)dbFail("RESEARCH_CANDIDATE_LIST",out.error);
    if((out.count??0)>1000)throw new SalesScoutDiscoveryError("DISCOVERY_FILTER_RESULT_LIMIT","Narrow the owner-only filters before sorting opportunity scores.");
    const rows=((out.data??[]) as DiscoveryCandidateListRow[]).sort((left,right)=>
      Number(right.confidence_summary?.opportunity?.score??0)-Number(left.confidence_summary?.opportunity?.score??0));
    const start=(Math.max(1,page)-1)*pageSize;return{rows:rows.slice(start,start+pageSize),count:rows.length};
  }
  if(contactFilter){
    const out=await q.range(0,1000);
    if(out.error)dbFail("RESEARCH_CANDIDATE_LIST",out.error);
    if((out.count??0)>1000)throw new SalesScoutDiscoveryError(
      "DISCOVERY_FILTER_RESULT_LIMIT",
      "Narrow the owner-only filters before paging contact evidence.",
    );
    return paginateContactEvidenceRows(
      (out.data??[]) as DiscoveryCandidateListRow[],filter,page,pageSize,
    );
  }
  const out=await q.range(from,from+pageSize-1);
  if(out.error)dbFail("RESEARCH_CANDIDATE_LIST",out.error);
  return{rows:(out.data??[]) as DiscoveryCandidateListRow[],count:out.count??0};
}
const detailSelect="id,scout_campaign_id,provider,provider_source_id,geoapify_place_id,provider_source_url,business_name,provider_category,mapped_campaign_category,provider_category_ids,additional_categories,publicDescription:public_description,full_address,city,state,country_code,latitude,longitude,public_phone,public_website,observed_at,status,exact_matching_prospect_id,captured_prospect_id,soft_match_warning_count,mapping_issues,dismissal_reason,first_seen_at,last_seen_at,seen_count,territory_match_evidence,distance_km,phone_routes,email_routes,whatsapp_routes,social_profiles,contact_evidence,research_evidence,confidence_summary,enrichment_status,research_issues,manual_review_ready,outreach_ready,updated_at";
export async function getSalesScoutDiscoveryCandidate(id:string){await auth();const db=createAdminSupabaseClient();const row=await db.from("marketing_sales_scout_discovery_candidates").select(detailSelect).eq("id",id).maybeSingle();if(row.error)dbFail("RESEARCH_CANDIDATE_DETAIL",row.error);if(!row.data)throw new SalesScoutDiscoveryError("DISCOVERY_CANDIDATE_NOT_FOUND");const candidate=row.data as unknown as DiscoveryCandidateRow;const history=await db.from("marketing_sales_scout_discovery_run_candidates").select("discovery_run_id,candidate_id,is_exact_duplicate,exact_matching_prospect_id,soft_match_warning_count,created_at,marketing_sales_scout_discovery_runs(status,started_at,completed_at,provider_task_id)").eq("candidate_id",id).order("created_at",{ascending:false}).limit(100);if(history.error)dbFail("RESEARCH_HISTORY",history.error);const prospectIds=[candidate.exact_matching_prospect_id,candidate.captured_prospect_id].filter((value):value is string=>Boolean(value));const prospects=prospectIds.length?await db.from("marketing_prospects").select("id,business_name,city").in("id",prospectIds).limit(2):{data:[],error:null};if(prospects.error)dbFail("RESEARCH_LINKED_PROSPECTS",prospects.error);const summaries=(prospects.data??[]).map((prospect)=>({id:String(prospect.id),businessName:String(prospect.business_name),city:prospect.city?String(prospect.city):null}));return{candidate,history:(history.data??[]) as DiscoveryMembershipRow[],exactProspect:summaries.find((prospect)=>prospect.id===candidate.exact_matching_prospect_id)??null,capturedProspect:summaries.find((prospect)=>prospect.id===candidate.captured_prospect_id)??null,readiness:await stagedCaptureReadiness(candidate as unknown as Record<string,unknown>)};}

export async function confirmSalesScoutCandidateContact(input:{candidateId:string;route:string;normalizedIdentity:string}){
  const actor=await auth();const db=createAdminSupabaseClient();
  if(!isDirectContactRoute(input.route))throw new SalesScoutDiscoveryError("DISCOVERY_CONTACT_NOT_CONFIRMABLE");
  const loaded=await db.from("marketing_sales_scout_discovery_candidates").select(detailSelect).eq("id",input.candidateId).maybeSingle();
  if(loaded.error)dbFail("RESEARCH_CONTACT_CONFIRM_LOAD",loaded.error);if(!loaded.data)throw new SalesScoutDiscoveryError("DISCOVERY_CANDIDATE_NOT_FOUND");
  const row=loaded.data as unknown as DiscoveryCandidateRow;if(!["new","reviewing","duplicate"].includes(row.status))throw new SalesScoutDiscoveryError("DISCOVERY_CONTACT_CONFIRM_STATE");
  const index=row.contact_evidence.findIndex((contact)=>contact.route===input.route&&contact.normalizedIdentity===input.normalizedIdentity);
  if(index<0)throw new SalesScoutDiscoveryError("DISCOVERY_CONTACT_NOT_FOUND");const existing=row.contact_evidence[index];
  if(existing.confidence==="verified")return{idempotent:true,outreachReady:row.outreach_ready};
  const confirmedAt=new Date().toISOString();const promoted={...existing,confidence:"verified" as const,ownerConfirmedAt:confirmedAt,ownerConfirmedBy:actor.id};
  const contacts=row.contact_evidence.map((contact,itemIndex)=>itemIndex===index?promoted:contact);
  const updateGroup=(group:PublicContact[])=>group.map((contact)=>contact.route===input.route&&contact.normalizedIdentity===input.normalizedIdentity?promoted:contact);
  let suppressed=false;if(row.exact_matching_prospect_id){const prospect=await db.from("marketing_prospects").select("do_not_contact_at,scout_status,stage").eq("id",row.exact_matching_prospect_id).maybeSingle();if(prospect.error)dbFail("RESEARCH_CONTACT_CONFIRM_DNC",prospect.error);suppressed=Boolean(prospect.data?.do_not_contact_at)||["do_not_contact","converted","closed","disqualified"].includes(String(prospect.data?.scout_status??""))||["recurring_customer","won","lost"].includes(String(prospect.data?.stage??""));}
  const territoryVerified=row.territory_match_evidence?.matched===true;const outreachReady=territoryVerified&&Boolean(row.mapped_campaign_category)&&!suppressed;
  const evidence=[...row.research_evidence,{source:"manual_public_source",sourceUrl:existing.sourceUrl,observedAt:confirmedAt,field:"contactConfirmation",value:`${existing.route}:${existing.normalizedIdentity}`,confidence:"high",verificationStatus:"verified",reason:"Owner explicitly confirmed the plausible public route."}];
  const verified=contacts.filter((contact)=>contact.confidence==="verified").length;const plausible=contacts.length-verified;
  const opportunity=row.confidence_summary.opportunity?reflectOwnerConfirmedContact(row.confidence_summary.opportunity,existing.route):undefined;
  const confidenceSummary={...row.confidence_summary,highest:"verified",verified,plausible,...(opportunity?{opportunity}:{}),ownerConfirmation:{route:existing.route,normalizedIdentity:existing.normalizedIdentity,confirmedAt}};
  const updated=await db.from("marketing_sales_scout_discovery_candidates").update({contact_evidence:contacts,phone_routes:updateGroup(row.phone_routes),email_routes:updateGroup(row.email_routes),whatsapp_routes:updateGroup(row.whatsapp_routes),social_profiles:updateGroup(row.social_profiles),research_evidence:evidence,confidence_summary:confidenceSummary,outreach_ready:outreachReady,status:row.status==="new"?"reviewing":row.status,reviewed_by:actor.id,reviewed_at:confirmedAt,updated_at:confirmedAt}).eq("id",row.id).eq("updated_at",row.updated_at).select("id,outreach_ready").maybeSingle();
  if(updated.error)dbFail("RESEARCH_CONTACT_CONFIRM_UPDATE",updated.error);if(!updated.data)throw new SalesScoutDiscoveryError("DISCOVERY_CONTACT_CONFIRM_STATE_CHANGED");return{idempotent:false,outreachReady:Boolean(updated.data.outreach_ready)};
}

function channelsFromContacts(contacts:PublicContact[]):DiscoveryChannel[]{return contacts.filter((contact)=>isDirectContactRoute(contact.route)).map((contact,index)=>({platform:contact.route,handleOrValue:contact.displayValue,profileUrl:contact.profileUrl??undefined,isPrimary:index===0,sourceId:contact.normalizedIdentity,evidence:{sourceType:contact.sourceType,sourceUrl:contact.sourceUrl,observedAt:contact.observedAt,confidence:contact.confidence,reviewRequired:contact.confidence==="plausible"}}));}
export async function stagedCaptureReadiness(row:Record<string,unknown>){const campaign=await getSalesScoutCampaign(String(row.scout_campaign_id));const contacts=Array.isArray(row.contact_evidence)?row.contact_evidence as PublicContact[]:[];const evidence=row.territory_match_evidence&&typeof row.territory_match_evidence==="object"?row.territory_match_evidence as Record<string,unknown>:{};const blockers:string[]=[];if(!["new","reviewing","duplicate"].includes(String(row.status)))blockers.push("Candidate status cannot be captured.");if(!row.manual_review_ready)blockers.push("Candidate is not manual-review-ready.");if(evidence.matched!==true)blockers.push("Campaign territory has not been verified.");if(!row.mapped_campaign_category)blockers.push("Campaign category is missing.");const channels=channelsFromContacts(contacts);if(!channels.length)blockers.push("No usable public contact is available.");const operationalCity=row.city?String(row.city):campaign.city;if(blockers.length)return{candidate:null,blockers};const candidate:DiscoveryCandidate={provider:String(row.provider),providerSourceId:String(row.provider_source_id),sourceUrl:String(row.provider_source_url),observedAt:String(row.observed_at),campaignId:String(row.scout_campaign_id),businessName:String(row.business_name),businessCategory:String(row.mapped_campaign_category),city:operationalCity,state:row.state?String(row.state):campaign.state??undefined,country:"Nigeria",publicDescription:row.publicDescription?String(row.publicDescription):undefined,serviceAreaCities:[campaign.city],demandBand:"unknown",isInactiveOrClosed:false,isConsumerOnly:false,channels};return{candidate,blockers:[],locationEvidence:evidence,usesOperationalCampaignCity:!row.city};}
export async function previewStagedSalesScoutCandidate(id:string){const detail=await getSalesScoutDiscoveryCandidate(id);if(!detail.readiness.candidate)throw new SalesScoutDiscoveryError("DISCOVERY_CAPTURE_BLOCKED");return previewSalesScoutCandidate(detail.readiness.candidate);}
export async function captureStagedSalesScoutCandidate({candidateId,resolution}:{candidateId:string;resolution:unknown}){const actor=await auth();const detail=await getSalesScoutDiscoveryCandidate(candidateId);if(!detail.readiness.candidate)throw new SalesScoutDiscoveryError("DISCOVERY_CAPTURE_BLOCKED");const result=await captureSalesScoutCandidate({candidate:detail.readiness.candidate,resolution});const db=createAdminSupabaseClient();if(detail.readiness.usesOperationalCampaignCity){const evidence=await db.rpc("apply_sales_scout_capture_evidence",{p_prospect_id:result.prospectId,p_location_evidence:detail.readiness.locationEvidence,p_actor_id:actor.id});if(evidence.error)dbFail("RESEARCH_CAPTURE_EVIDENCE",evidence.error);}const update=await db.from("marketing_sales_scout_discovery_candidates").update({status:"captured",captured_prospect_id:result.prospectId,reviewed_by:actor.id,reviewed_at:new Date().toISOString(),updated_at:new Date().toISOString()}).eq("id",candidateId).in("status",["new","reviewing","duplicate"]).select("id,status,captured_prospect_id").maybeSingle();if(update.error)dbFail("RESEARCH_CAPTURE_MARK",update.error);if(!update.data)throw new SalesScoutDiscoveryError("DISCOVERY_CAPTURE_STATE_CHANGED");return result;}
export async function dismissSalesScoutDiscoveryCandidate({candidateId,reason}:{candidateId:string;reason:string}){const actor=await auth();reason=reason.trim();const db=createAdminSupabaseClient();const current=await db.from("marketing_sales_scout_discovery_candidates").select("status,dismissal_reason").eq("id",candidateId).single();if(current.error)dbFail("RESEARCH_DISMISS_LOAD",current.error);const transition=dismissalTransition(current.data.status,current.data.dismissal_reason,reason);if(!transition.allowed)throw new SalesScoutDiscoveryError(transition.reference??"DISCOVERY_DISMISS_STATE");if(transition.idempotent)return{idempotent:true};const out=await db.from("marketing_sales_scout_discovery_candidates").update({status:"dismissed",dismissal_reason:reason,reviewed_by:actor.id,reviewed_at:new Date().toISOString(),updated_at:new Date().toISOString()}).eq("id",candidateId).in("status",["new","reviewing","duplicate"]).select("id,status").maybeSingle();if(out.error)dbFail("RESEARCH_DISMISS",out.error);if(!out.data)throw new SalesScoutDiscoveryError("DISCOVERY_DISMISS_STATE_CHANGED");return{idempotent:false};}
