import {
  canonicalizeWebsiteHostname,
  normalizeBusinessName,
  normalizeLocationComparison,
  normalizeNigerianPhone,
} from "../normalization.ts";
import type { ResearchCandidate, ResearchEvidence, ResearchSource } from "./types.ts";

function sharedIdentity(left: ResearchCandidate, right: ResearchCandidate) {
  return Object.entries(left.sourceIdentities).some(([source, identity]) =>
    Boolean(identity && right.sourceIdentities[source as ResearchSource] === identity));
}
export function candidatesMatch(left: ResearchCandidate, right: ResearchCandidate) {
  if (sharedIdentity(left, right)) return true;
  const leftHost = left.website ? canonicalizeWebsiteHostname(left.website) : null;
  const rightHost = right.website ? canonicalizeWebsiteHostname(right.website) : null;
  if (leftHost && leftHost === rightHost) return true;
  const phones = new Set(left.phoneNumbers.map(normalizeNigerianPhone).filter(Boolean));
  if (right.phoneNumbers.some((phone) => phones.has(normalizeNigerianPhone(phone)))) return true;
  return normalizeBusinessName(left.businessName) === normalizeBusinessName(right.businessName) &&
    Boolean(left.city && right.city) &&
    normalizeLocationComparison(left.city ?? "") === normalizeLocationComparison(right.city ?? "");
}
const unique = <T>(values: T[]) => [...new Set(values)];
function mergeEvidence(left: ResearchEvidence[], right: ResearchEvidence[]) {
  const result = new Map<string, ResearchEvidence>();
  for (const item of [...left, ...right]) {
    result.set([item.source,item.sourceUrl,item.field,item.value,item.observedAt].join("|"), item);
  }
  return [...result.values()];
}
function conflicts(left: ResearchCandidate, right: ResearchCandidate) {
  const issues: string[] = [];
  for (const [field,a,b] of [
    ["website",left.website,right.website],["address",left.address,right.address],
    ["state",left.state,right.state],["city",left.city,right.city],
  ] as const) if (a && b && a !== b) issues.push(`Conflicting ${field} evidence retained: ${a} | ${b}`);
  return issues;
}
function mergeRecords(left: ResearchCandidate, right: ResearchCandidate): ResearchCandidate {
  return {
    ...left,
    sourceIdentities:{...left.sourceIdentities,...right.sourceIdentities},
    providerCategories:unique([...left.providerCategories,...right.providerCategories]),
    phoneNumbers:unique([...left.phoneNumbers,...right.phoneNumbers]),
    emailAddresses:unique([...left.emailAddresses,...right.emailAddresses]),
    whatsAppNumbers:unique([...left.whatsAppNumbers,...right.whatsAppNumbers]),
    instagram:unique([...left.instagram,...right.instagram]),
    facebook:unique([...left.facebook,...right.facebook]),
    tiktok:unique([...left.tiktok,...right.tiktok]),
    x:unique([...left.x,...right.x]),
    youtube:unique([...left.youtube,...right.youtube]),
    evidence:mergeEvidence(left.evidence,right.evidence),
    discoverySources:unique([...left.discoverySources,...right.discoverySources]),
    researchIssues:unique([...left.researchIssues,...right.researchIssues,...conflicts(left,right)]),
    website:left.website??right.website,address:left.address??right.address,
    state:left.state??right.state,city:left.city??right.city,country:left.country??right.country,
    latitude:left.latitude??right.latitude,longitude:left.longitude??right.longitude,
    publicDescription:left.publicDescription??right.publicDescription,
    firstObservedAt:left.firstObservedAt<right.firstObservedAt?left.firstObservedAt:right.firstObservedAt,
    lastObservedAt:left.lastObservedAt>right.lastObservedAt?left.lastObservedAt:right.lastObservedAt,
  };
}
export function mergeCandidates(left: ResearchCandidate, right: ResearchCandidate) {
  if (!candidatesMatch(left,right)) throw new Error("RESEARCH_CANDIDATES_DO_NOT_MATCH");
  return mergeRecords(left,right);
}
function sortKey(candidate: ResearchCandidate) {
  return [candidate.normalizedBusinessName,candidate.city??"",candidate.website??"",
    JSON.stringify(candidate.sourceIdentities)].join("|");
}
export function deduplicateCandidates(candidates: ResearchCandidate[]) {
  const parent=candidates.map((_,index)=>index);
  const find=(value:number):number=>parent[value]===value?value:(parent[value]=find(parent[value]));
  const unite=(a:number,b:number)=>{const rootA=find(a),rootB=find(b);if(rootA!==rootB)parent[rootB]=rootA;};
  for(let a=0;a<candidates.length;a+=1)for(let b=a+1;b<candidates.length;b+=1)
    if(candidatesMatch(candidates[a],candidates[b]))unite(a,b);
  const groups=new Map<number,ResearchCandidate[]>();
  candidates.forEach((candidate,index)=>{const root=find(index);groups.set(root,[...(groups.get(root)??[]),candidate]);});
  const merged=[...groups.values()].map((group)=>
    group.sort((a,b)=>sortKey(a).localeCompare(sortKey(b))).reduce(mergeRecords));
  return {candidates:merged.sort((a,b)=>sortKey(a).localeCompare(sortKey(b))),
    duplicatesMerged:candidates.length-merged.length};
}
