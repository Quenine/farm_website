import { normalizeBusinessName, normalizeLocationComparison, normalizeEmail, normalizeNigerianPhone } from "../normalization.ts";
import { normalizeNigerianState } from "../territory.ts";
import type {
  ProviderResult, ResearchCandidate, ResearchCategory, ResearchEvidence,
  ResearchQuery, ResearchTerritory,
} from "./types.ts";
import {
  providerStatusReference,
  ResearchProviderError,
} from "./types.ts";

const CATEGORY_MAP: Partial<Record<ResearchCategory,string>> = {
  Restaurant:"catering.restaurant",Hotel:"accommodation.hotel",Supermarket:"commercial.supermarket",
};
const MAX_LIMIT=20;
const MAX_PAGES=5;
const unique=<T>(values:T[])=>[...new Set(values)];

export function geoapifyCategory(category:ResearchCategory){return CATEGORY_MAP[category]??null;}
export function buildGeoapifyTerritoryUrl(territory:ResearchTerritory,key="configured"){
  const url=new URL("https://api.geoapify.com/v1/geocode/search");
  url.searchParams.set("text",`${territory.city}, ${territory.state}, Nigeria`);
  url.searchParams.set("type","city");
  url.searchParams.set("filter","countrycode:ng");
  url.searchParams.set("limit","5");
  url.searchParams.set("apiKey",key);
  return url;
}
export function buildGeoapifyPlacesUrl(query:ResearchQuery,longitude:number,latitude:number,page:number,key="configured"){
  const category=geoapifyCategory(query.category);
  if(!category)throw new ResearchProviderError("GEOAPIFY_CATEGORY_UNSUPPORTED");
  const limit=Math.min(MAX_LIMIT,Math.max(1,query.limit));
  const radius=Math.min(50_000,Math.max(1_000,(query.territory.radiusKm??20)*1_000));
  const url=new URL("https://api.geoapify.com/v2/places");
  url.searchParams.set("categories",category);
  url.searchParams.set("filter",`circle:${longitude},${latitude},${radius}`);
  url.searchParams.set("bias",`proximity:${longitude},${latitude}`);
  url.searchParams.set("limit",String(limit));
  url.searchParams.set("offset",String((page-1)*limit));
  url.searchParams.set("apiKey",key);
  return url;
}
export function buildGeoapifyPlaceDetailsUrl(placeId:string,key="configured"){
  const url=new URL("https://api.geoapify.com/v2/place-details");
  url.searchParams.set("id",placeId);
  url.searchParams.set("features","details");
  url.searchParams.set("apiKey",key);
  return url;
}
type GeoProperties={
  place_id?:unknown;name?:unknown;categories?:unknown;formatted?:unknown;
  city?:unknown;locality?:unknown;state?:unknown;country?:unknown;country_code?:unknown;
  lon?:unknown;lat?:unknown;website?:unknown;contact?:{phone?:unknown;email?:unknown};
};
type GeoFeature={properties?:GeoProperties};

type GeoDetailsProperties=GeoProperties&{
  feature_type?:unknown;website_other?:unknown;description?:unknown;
  contact?:{phone?:unknown;phone_other?:unknown;email?:unknown;email_other?:unknown};
};

function features(payload:unknown):GeoFeature[]{
  return payload&&typeof payload==="object"&&Array.isArray((payload as {features?:unknown}).features)
    ?(payload as {features:GeoFeature[]}).features:[];
}
export function mergeGeoapifyPlaceDetails(
  candidate:ResearchCandidate,payload:unknown,observedAt:string,
):ResearchCandidate{
  const details=features(payload).map((feature)=>feature.properties as GeoDetailsProperties|undefined)
    .find((item)=>item&&text(item.feature_type)==="details");
  if(!details)return{...candidate,researchIssues:unique([...candidate.researchIssues,"GEOAPIFY_PLACE_DETAILS_EMPTY"])};
  const sourceUrl=`https://www.geoapify.com/place-details/?id=${encodeURIComponent(candidate.sourceIdentities.geoapify_places??"")}`;
  const strings=(value:unknown)=>Array.isArray(value)?value.filter((item):item is string=>typeof item==="string"):
    typeof value==="string"?[value]:[];
  const phones=unique([...strings(details.contact?.phone),...strings(details.contact?.phone_other)])
    .map(normalizeNigerianPhone).filter((value):value is string=>Boolean(value));
  const emails=unique([...strings(details.contact?.email),...strings(details.contact?.email_other)])
    .map(normalizeEmail).filter((value):value is string=>Boolean(value));
  const websites=unique([...strings(details.website),...strings(details.website_other)]);
  const facts:ResearchEvidence[]=[];
  for(const value of phones)facts.push({source:"geoapify_place_details",sourceUrl,observedAt,field:"phone",value,confidence:"medium",verificationStatus:"plausible"});
  for(const value of emails)facts.push({source:"geoapify_place_details",sourceUrl,observedAt,field:"email",value,confidence:"medium",verificationStatus:"plausible"});
  if(websites[0])facts.push({source:"geoapify_place_details",sourceUrl,observedAt,field:"website",value:websites[0],confidence:"medium",verificationStatus:"plausible"});
  const description=text(details.description);
  if(description)facts.push({source:"geoapify_place_details",sourceUrl,observedAt,field:"publicDescription",value:description,confidence:"medium",verificationStatus:"plausible"});
  return{...candidate,website:candidate.website??websites[0]??null,
    phoneNumbers:unique([...candidate.phoneNumbers,...phones]),emailAddresses:unique([...candidate.emailAddresses,...emails]),
    publicDescription:candidate.publicDescription??description,evidence:[...candidate.evidence,...facts],
    discoverySources:unique([...candidate.discoverySources,"geoapify_place_details"]),lastObservedAt:observedAt};
}
function text(value:unknown){return typeof value==="string"&&value.trim()?value.trim():null;}
function evidence(sourceUrl:string,observedAt:string,field:string,value:string,verificationStatus:"verified"|"plausible"="verified"):ResearchEvidence{
  return{source:"geoapify_places",sourceUrl,observedAt,field,value,
    confidence:verificationStatus==="verified"?"high":"medium",verificationStatus};
}
export function resolveGeoapifyTerritory(payload:unknown,territory:ResearchTerritory){
  const wantedCity=normalizeLocationComparison(territory.city);
  const wantedState=normalizeNigerianState(territory.state);
  for(const feature of features(payload)){
    const item=feature.properties;if(!item)continue;
    const countryCode=text(item.country_code)?.toLowerCase();
    const city=text(item.city)??text(item.locality);
    const state=text(item.state);
    if(countryCode!=="ng"||!city||!state)continue;
    if(normalizeLocationComparison(city)!==wantedCity||normalizeNigerianState(state)!==wantedState)continue;
    if(typeof item.lon==="number"&&typeof item.lat==="number")return{longitude:item.lon,latitude:item.lat};
  }
  throw new ResearchProviderError("GEOAPIFY_TERRITORY_NOT_RESOLVED");
}
export function mapGeoapifyPlacesResponse(payload:unknown,query:ResearchQuery,observedAt:string):ResearchCandidate[]{
  const mappedCategory=geoapifyCategory(query.category);
  return features(payload).flatMap((feature)=>{
    const item=feature.properties,name=text(item?.name);if(!item||!name)return[];
    const placeId=text(item.place_id);
    const sourceUrl=placeId?`https://www.geoapify.com/place-details/?id=${encodeURIComponent(placeId)}`:"https://www.geoapify.com/";
    const providerCategories=Array.isArray(item.categories)?item.categories.filter((value):value is string=>typeof value==="string"):[];
    const categorySupported=Boolean(mappedCategory&&providerCategories.some((value)=>value===mappedCategory||value.startsWith(`${mappedCategory}.`)));
    const country=text(item.country),state=text(item.state),city=text(item.city)??text(item.locality);
    const address=text(item.formatted),website=text(item.website),phone=text(item.contact?.phone),email=text(item.contact?.email);
    const latitude=typeof item.lat==="number"?item.lat:null,longitude=typeof item.lon==="number"?item.lon:null;
    const facts:ResearchEvidence[]=[evidence(sourceUrl,observedAt,"businessName",name)];
    if(categorySupported)facts.push(evidence(sourceUrl,observedAt,"requestedCategory",query.category));
    else facts.push(evidence(sourceUrl,observedAt,"requestedCategory",query.category,"plausible"));
    for(const[field,value]of [["country",country],["state",state],["city",city],["address",address],
      ["website",website],["phone",phone],["email",email]] as const)
      if(value)facts.push(evidence(sourceUrl,observedAt,field,value,field==="website"||field==="phone"||field==="email"?"plausible":"verified"));
    if(latitude!=null)facts.push(evidence(sourceUrl,observedAt,"latitude",String(latitude)));
    if(longitude!=null)facts.push(evidence(sourceUrl,observedAt,"longitude",String(longitude)));
    for(const category of providerCategories)facts.push(evidence(sourceUrl,observedAt,"providerCategory",category));
    return[{sourceIdentities:placeId?{geoapify_places:placeId}:{},businessName:name,
      normalizedBusinessName:normalizeBusinessName(name),requestedCategory:query.category,
      requestedTerritory:{...query.territory},providerCategories,country,state,city,address,latitude,longitude,
      website,phoneNumbers:phone?[phone]:[],emailAddresses:email?[email]:[],whatsAppNumbers:[],
      instagram:[],facebook:[],tiktok:[],x:[],youtube:[],publicDescription:null,evidence:facts,
      discoverySources:["geoapify_places"],researchIssues:categorySupported?[]:
        ["Returned Geoapify categories do not verify the requested category."],
      firstObservedAt:observedAt,lastObservedAt:observedAt}];
  });
}
async function geoFetch(url:URL,signal:AbortSignal){
  let response:Response;
  try{response=await fetch(url,{signal,headers:{Accept:"application/json"}});}
  catch(error){if(error instanceof DOMException&&error.name==="AbortError")throw new ResearchProviderError("GEOAPIFY_TIMEOUT");throw new ResearchProviderError("GEOAPIFY_NETWORK_FAILURE");}
  if(!response.ok)throw new ResearchProviderError(providerStatusReference("GEOAPIFY",response.status));
  try{return await response.json() as unknown;}catch{throw new ResearchProviderError("GEOAPIFY_INVALID_JSON");}
}
export async function researchGeoapifyPlaceDetails(
  candidate:ResearchCandidate,deadline:{deadlineAtMs:number;now:()=>number},
):Promise<ResearchCandidate>{
  if(typeof window!=="undefined")throw new ResearchProviderError("GEOAPIFY_SERVER_ONLY");
  const key=process.env.GEOAPIFY_API_KEY?.trim();if(!key)throw new ResearchProviderError("GEOAPIFY_NOT_CONFIGURED");
  const placeId=candidate.sourceIdentities.geoapify_places?.trim();
  if(!placeId)throw new ResearchProviderError("GEOAPIFY_PLACE_DETAILS_ID_MISSING");
  const controller=new AbortController();
  const timeout=setTimeout(()=>controller.abort(),Math.min(12_000,Math.max(1,deadline.deadlineAtMs-deadline.now())));
  try{return mergeGeoapifyPlaceDetails(candidate,await geoFetch(buildGeoapifyPlaceDetailsUrl(placeId,key),controller.signal),new Date(deadline.now()).toISOString());}
  finally{clearTimeout(timeout);}
}
export async function researchWithGeoapify(
  query:ResearchQuery & {deadlineAtMs?:number;now?:()=>number},
):Promise<ProviderResult>{
  if(typeof window!=="undefined")throw new ResearchProviderError("GEOAPIFY_SERVER_ONLY");
  const key=process.env.GEOAPIFY_API_KEY?.trim();if(!key)throw new ResearchProviderError("GEOAPIFY_NOT_CONFIGURED");
  if(!geoapifyCategory(query.category))return{provider:"geoapify_places",candidates:[],rawResultCount:0,estimatedCredits:0,failureReference:"GEOAPIFY_CATEGORY_UNSUPPORTED"};
  const now=query.now??Date.now;
  const remaining=query.deadlineAtMs==null?15_000:Math.max(1,query.deadlineAtMs-now());
  const controller=new AbortController(),timeout=setTimeout(()=>controller.abort(),Math.min(15_000,remaining));
  try{
    let longitude=query.territory.longitude,latitude=query.territory.latitude,credits=0;
    if(longitude==null||latitude==null){const location=resolveGeoapifyTerritory(await geoFetch(buildGeoapifyTerritoryUrl(query.territory,key),controller.signal),query.territory);longitude=location.longitude;latitude=location.latitude;credits+=1;}
    const candidates:ResearchCandidate[]=[],pageSize=Math.min(MAX_LIMIT,Math.max(1,query.limit));let rawResultCount=0;
    const pages=Math.min(MAX_PAGES,Math.ceil(query.limit/pageSize));
    for(let page=1;page<=pages;page+=1){const payload=await geoFetch(buildGeoapifyPlacesUrl(query,longitude,latitude,page,key),controller.signal);const rawPageCount=features(payload).length;rawResultCount+=rawPageCount;const mapped=mapGeoapifyPlacesResponse(payload,query,new Date().toISOString());credits+=1;candidates.push(...mapped);if(rawPageCount<pageSize||candidates.length>=query.limit)break;}
    return{provider:"geoapify_places",candidates:candidates.slice(0,query.limit),rawResultCount,estimatedCredits:credits,resolvedTerritory:{latitude,longitude}};
  }finally{clearTimeout(timeout);}
}
