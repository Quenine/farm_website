import { lookup } from "node:dns/promises";
import { isIP } from "node:net";
import { normalizeEmail, normalizeNigerianPhone, normalizeSocialIdentity, type SocialPlatform } from "../normalization.ts";
import type { ResearchEvidence } from "./types.ts";
import { ResearchProviderError } from "./types.ts";

const USER_AGENT = "ShieldsFarmsSalesScoutResearch/1.0 (+https://shieldsfarms.ng/contact)";
const MAX_PAGES = 5;
const MAX_REDIRECTS = 2;
const MAX_BYTES = 2 * 1024 * 1024;
const TIMEOUT_MS = 10_000;
const PACE_MS = 250;
const BLOCKED_HOSTS = new Set(["facebook.com","www.facebook.com","instagram.com","www.instagram.com","tiktok.com","www.tiktok.com","x.com","twitter.com","youtube.com","www.youtube.com","google.com","www.google.com","tripadvisor.com"]);

export function isPrivateOrReservedIp(address: string) {
  const version = isIP(address);
  if (version === 4) {
    const [a,b,c] = address.split(".").map(Number);
    return a===0||a===10||a===127||a>=224||(a===100&&b>=64&&b<=127)||(a===169&&b===254)||(a===172&&b>=16&&b<=31)||(a===192&&b===0)||(a===192&&b===168)||(a===192&&b===0&&c===2)||(a===198&&(b===18||b===19))||(a===198&&b===51&&c===100)||(a===203&&b===0&&c===113);
  }
  if (version === 6) {
    const value=address.toLowerCase();
    return value==="::"||value==="::1"||value.startsWith("fc")||value.startsWith("fd")||/^fe[89ab]/.test(value)||value.startsWith("2001:db8:");
  }
  return true;
}

export function validatePublicWebsiteUrl(input: string, resolvedAddresses: string[] = []) {
  let url: URL;
  try { url=new URL(input); } catch { throw new ResearchProviderError("WEBSITE_URL_INVALID"); }
  if (!["http:","https:"].includes(url.protocol)||url.username||url.password) throw new ResearchProviderError("WEBSITE_URL_UNSAFE");
  const host=url.hostname.toLowerCase();
  if (!host||host==="localhost"||host.endsWith(".localhost")) throw new ResearchProviderError("WEBSITE_URL_UNSAFE");
  if ((isIP(host)&&isPrivateOrReservedIp(host))||resolvedAddresses.some(isPrivateOrReservedIp)) throw new ResearchProviderError("WEBSITE_DESTINATION_PRIVATE");
  return url;
}

export async function assertPublicDestination(input: string) {
  const url=validatePublicWebsiteUrl(input);
  let records: Array<{address:string}>;
  try { records=await lookup(url.hostname,{all:true,verbatim:true}); } catch { throw new ResearchProviderError("WEBSITE_DNS_FAILED"); }
  if (!records.length) throw new ResearchProviderError("WEBSITE_DNS_FAILED");
  validatePublicWebsiteUrl(url.href,records.map((item)=>item.address));
  return url;
}

export function isPlausibleOfficialWebsite(input: string) {
  try {
    const url=validatePublicWebsiteUrl(input);
    return !BLOCKED_HOSTS.has(url.hostname.toLowerCase())&&!/\/(login|signin|account|private)(?:\/|$)/i.test(url.pathname);
  } catch { return false; }
}

export function robotsAllows(robotsText: string, pathname: string, userAgent=USER_AGENT) {
  const groups:Array<{agents:string[];disallow:string[]}>=[];let current:{agents:string[];disallow:string[]}|null=null;
  for(const raw of robotsText.split(/\r?\n/)){
    const line=raw.replace(/#.*$/,"").trim();if(!line)continue;
    const separator=line.indexOf(":");if(separator<0)continue;
    const name=line.slice(0,separator).trim().toLowerCase(),value=line.slice(separator+1).trim();
    if(name==="user-agent"){if(!current||current.disallow.length){current={agents:[],disallow:[]};groups.push(current);}current.agents.push(value.toLowerCase());}
    else if(name==="disallow"&&current&&value)current.disallow.push(value);
  }
  const agent=userAgent.toLowerCase();
  return !groups.filter((group)=>group.agents.some((value)=>value==="*"||agent.includes(value))).some((group)=>group.disallow.some((path)=>path==="/"||pathname.startsWith(path)));
}

export type ExtractedWebsiteFacts={canonicalUrl:string|null;phoneNumbers:string[];emailAddresses:string[];whatsAppNumbers:string[];instagram:string[];facebook:string[];tiktok:string[];x:string[];youtube:string[];publicDescription:string|null;addresses:string[];evidence:ResearchEvidence[]};
const unique=(values:string[])=>[...new Set(values.filter(Boolean))];
function attributes(html:string,name:string){const regex=new RegExp(`\\b${name}\\s*=\\s*["']([^"']+)["']`,"gi");return [...html.matchAll(regex)].map((match)=>match[1].trim());}
function makeEvidence(sourceUrl:string,observedAt:string,field:string,value:string):ResearchEvidence{return{source:"official_website",sourceUrl,observedAt,field,value,confidence:"high",verificationStatus:"verified"};}

export function extractWebsiteFacts(html:string,sourceUrl:string,observedAt:string):ExtractedWebsiteFacts{
  const hrefs=attributes(html,"href");
  const phoneNumbers=hrefs.filter((href)=>href.toLowerCase().startsWith("tel:")).map((href)=>decodeURIComponent(href.slice(4)).split(/[;,]/)[0].trim()).filter((value)=>normalizeNigerianPhone(value));
  const emailAddresses=hrefs.filter((href)=>href.toLowerCase().startsWith("mailto:")).map((href)=>decodeURIComponent(href.slice(7)).split("?")[0].trim()).filter((value)=>normalizeEmail(value));
  const whatsAppNumbers=hrefs.flatMap((href)=>{try{const url=new URL(href,sourceUrl);if(!["wa.me","api.whatsapp.com"].includes(url.hostname.toLowerCase()))return[];const value=url.hostname==="wa.me"?url.pathname.slice(1):url.searchParams.get("phone")??"";return normalizeNigerianPhone(value)?[value]:[];}catch{return[];}});
  const social={instagram:[] as string[],facebook:[] as string[],tiktok:[] as string[],x:[] as string[],youtube:[] as string[]};
  for(const href of hrefs){try{const url=new URL(href,sourceUrl),host=url.hostname.toLowerCase().replace(/^www\./,"");const platform: SocialPlatform|null=host==="instagram.com"?"instagram":host==="facebook.com"||host==="fb.com"?"facebook":host==="tiktok.com"?"tiktok":host==="x.com"||host==="twitter.com"?"x":host==="youtube.com"||host==="youtu.be"?"youtube":null;if(!platform)continue;const normalized=normalizeSocialIdentity(url.href,platform);if(normalized)social[platform].push(url.href);}catch{continue;}}
  const canonicalTag=[...html.matchAll(/<link\b[^>]*rel=["'][^"']*canonical[^"']*["'][^>]*>/gi)][0]?.[0];
  const canonicalValue=canonicalTag?attributes(canonicalTag,"href")[0]:null;
  const canonicalUrl=canonicalValue?new URL(canonicalValue,sourceUrl).href:null;
  const metaTag=[...html.matchAll(/<meta\b[^>]*(?:name|property)=["'](?:description|og:description)["'][^>]*>/gi)][0]?.[0];
  let publicDescription=metaTag?attributes(metaTag,"content")[0]??null:null;
  const addresses:string[]=[];
  for(const match of html.matchAll(/<script\b[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)){try{const parsed=JSON.parse(match[1]) as unknown;for(const item of Array.isArray(parsed)?parsed:[parsed]){if(!item||typeof item!=="object")continue;const record=item as Record<string,unknown>,types=Array.isArray(record["@type"])?record["@type"]:[record["@type"]];if(!types.some((type)=>typeof type==="string"&&/Organization|LocalBusiness|Restaurant|Hotel|Store|School|Hospital/i.test(type)))continue;if(typeof record.description==="string")publicDescription=record.description.trim();if(typeof record.address==="string")addresses.push(record.address.trim());else if(record.address&&typeof record.address==="object"){const address=record.address as Record<string,unknown>,joined=["streetAddress","addressLocality","addressRegion","addressCountry"].map((key)=>address[key]).filter((value):value is string=>typeof value==="string").join(", ");if(joined)addresses.push(joined);}}}catch{continue;}}
  const facts={canonicalUrl,phoneNumbers:unique(phoneNumbers),emailAddresses:unique(emailAddresses),whatsAppNumbers:unique(whatsAppNumbers),instagram:unique(social.instagram),facebook:unique(social.facebook),tiktok:unique(social.tiktok),x:unique(social.x),youtube:unique(social.youtube),publicDescription,addresses:unique(addresses)};
  const evidence:ResearchEvidence[]=[];for(const[field,values]of Object.entries({phone:facts.phoneNumbers,email:facts.emailAddresses,whatsapp:facts.whatsAppNumbers,instagram:facts.instagram,facebook:facts.facebook,tiktok:facts.tiktok,x:facts.x,youtube:facts.youtube,address:facts.addresses}))for(const value of values)evidence.push(makeEvidence(sourceUrl,observedAt,field,value));
  if(canonicalUrl)evidence.push(makeEvidence(sourceUrl,observedAt,"website",canonicalUrl));if(publicDescription)evidence.push(makeEvidence(sourceUrl,observedAt,"publicDescription",publicDescription));
  return{...facts,evidence};
}

async function safeFetch(input:string,allowPlainText=false,redirects=0):Promise<{url:URL,body:string}>{
  const url=await assertPublicDestination(input),controller=new AbortController(),timeout=setTimeout(()=>controller.abort(),TIMEOUT_MS);
  try{
    const response=await fetch(url,{redirect:"manual",signal:controller.signal,headers:{"User-Agent":USER_AGENT,Accept:allowPlainText?"text/plain":"text/html,application/xhtml+xml"}});
    if(response.status>=300&&response.status<400){if(redirects>=MAX_REDIRECTS)throw new ResearchProviderError("WEBSITE_REDIRECT_LIMIT");const location=response.headers.get("location");if(!location)throw new ResearchProviderError("WEBSITE_REDIRECT_INVALID");const target=new URL(location,url);await assertPublicDestination(target.href);return safeFetch(target.href,allowPlainText,redirects+1);}
    if(!response.ok)throw new ResearchProviderError("WEBSITE_REQUEST_FAILED");
    const type=response.headers.get("content-type")?.toLowerCase()??"";
    if(allowPlainText?!type.includes("text/plain"):!type.includes("text/html")&&!type.includes("application/xhtml+xml"))throw new ResearchProviderError("WEBSITE_CONTENT_TYPE_UNSUPPORTED");
    const declared=Number(response.headers.get("content-length")??"0");if(declared>MAX_BYTES)throw new ResearchProviderError("WEBSITE_RESPONSE_TOO_LARGE");
    const bytes=new Uint8Array(await response.arrayBuffer());if(bytes.byteLength>MAX_BYTES)throw new ResearchProviderError("WEBSITE_RESPONSE_TOO_LARGE");
    return{url,body:new TextDecoder().decode(bytes)};
  }catch(error){if(error instanceof ResearchProviderError)throw error;throw new ResearchProviderError(error instanceof DOMException&&error.name==="AbortError"?"WEBSITE_TIMEOUT":"WEBSITE_REQUEST_FAILED");}
  finally{clearTimeout(timeout);}
}
function candidateLinks(html:string,base:URL){const priorities=["contact","about","location","service","menu"];return attributes(html,"href").flatMap((href)=>{try{const url=new URL(href,base);return url.origin===base.origin&&!/\/(login|signin|account|private)(?:\/|$)/i.test(url.pathname)?[url]:[];}catch{return[];}}).sort((left,right)=>{const a=priorities.findIndex((word)=>left.pathname.toLowerCase().includes(word)),b=priorities.findIndex((word)=>right.pathname.toLowerCase().includes(word));return(a<0?99:a)-(b<0?99:b);});}

export async function researchOfficialWebsite(input:string){
  if(typeof window!=="undefined")throw new ResearchProviderError("WEBSITE_RESEARCH_SERVER_ONLY");
  if(!isPlausibleOfficialWebsite(input))throw new ResearchProviderError("WEBSITE_NOT_PLAUSIBLY_OFFICIAL");
  const root=await assertPublicDestination(input);let robotsText="";
  try{robotsText=(await safeFetch(new URL("/robots.txt",root).href,true)).body;}catch(error){if(!(error instanceof ResearchProviderError))throw error;}
  const queue=[root],visited=new Set<string>(),pages:Array<{url:string;facts:ExtractedWebsiteFacts}>=[];
  while(queue.length&&pages.length<MAX_PAGES){const next=queue.shift();if(!next||visited.has(next.href)||!robotsAllows(robotsText,next.pathname))continue;visited.add(next.href);const page=await safeFetch(next.href);const observedAt=new Date().toISOString();pages.push({url:page.url.href,facts:extractWebsiteFacts(page.body,page.url.href,observedAt)});for(const link of candidateLinks(page.body,root))if(!visited.has(link.href))queue.push(link);if(queue.length)await new Promise((resolve)=>setTimeout(resolve,PACE_MS));}
  return pages;
}
export const WEBSITE_RESEARCH_LIMITS={maxPages:MAX_PAGES,maxRedirects:MAX_REDIRECTS,maxBytes:MAX_BYTES,timeoutMs:TIMEOUT_MS,paceMs:PACE_MS} as const;
