import { readFile } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { normalizeBusinessName } from "../src/lib/sales-scout/normalization.ts";
import {
  computeEvaluationMetrics,
  deduplicateCandidates,
  geoapifyCategory,
  isPlausibleOfficialWebsite,
  researchOfficialWebsite,
  researchWithGeoapify,
  researchWithTavily,
  writeEvaluationOutputs,
  type ResearchCandidate,
  type ResearchCategory,
  type ResearchQuery,
  type ResearchSource,
  type ResearchTerritory,
  RESEARCH_CATEGORIES,
  ResearchProviderError,
} from "../src/lib/sales-scout/research/index.ts";

type Matrix = { territories: ResearchTerritory[]; categories: ResearchCategory[] };
type Options = {
  matrix: string;
  city?: string;
  state?: string;
  category?: ResearchCategory;
  limitPerQuery: number;
  maxQueries: number;
  outputDir?: string;
  live: boolean;
  confirmLive: boolean;
};
const DEFAULT_MATRIX="scripts/fixtures/sales-scout-research/nationwide-matrix.json";

function valueAfter(args:string[],index:number,name:string){const value=args[index+1];if(!value||value.startsWith("--"))throw new Error(`RESEARCH_ARGUMENT_MISSING_${name.toUpperCase().replaceAll("-","_")}`);return value;}
function boundedInteger(value:string,name:string,min:number,max:number){const number=Number(value);if(!Number.isInteger(number)||number<min||number>max)throw new Error(`RESEARCH_ARGUMENT_INVALID_${name.toUpperCase().replaceAll("-","_")}`);return number;}

export function parseResearchArgs(args:string[]):Options{
  const live=args.includes("--live"),confirmLive=args.includes("--confirm-live");
  const options:Options={matrix:DEFAULT_MATRIX,limitPerQuery:5,maxQueries:live?12:50,live,confirmLive};
  for(let index=0;index<args.length;index+=1){
    const name=args[index];
    if(name==="--matrix")options.matrix=valueAfter(args,index,name);
    else if(name==="--city")options.city=valueAfter(args,index,name);
    else if(name==="--state")options.state=valueAfter(args,index,name);
    else if(name==="--category"){const value=valueAfter(args,index,name) as ResearchCategory;if(!RESEARCH_CATEGORIES.includes(value))throw new Error("RESEARCH_ARGUMENT_INVALID_CATEGORY");options.category=value;}
    else if(name==="--limit-per-query")options.limitPerQuery=boundedInteger(valueAfter(args,index,name),name,1,20);
    else if(name==="--max-queries")options.maxQueries=boundedInteger(valueAfter(args,index,name),name,1,50);
    else if(name==="--output-dir")options.outputDir=valueAfter(args,index,name);
    else if(!["--live","--confirm-live"].includes(name)&&!args[index-1]?.startsWith("--"))throw new Error("RESEARCH_ARGUMENT_UNKNOWN");
  }
  if(live!==confirmLive)throw new Error("RESEARCH_LIVE_REQUIRES_EXPLICIT_CONFIRMATION");
  if(live&&!process.env.GEOAPIFY_API_KEY?.trim()&&!process.env.TAVILY_API_KEY?.trim())throw new Error("RESEARCH_LIVE_PROVIDER_NOT_CONFIGURED");
  return options;
}

function slug(value:string){return value.toLowerCase().replace(/[^a-z0-9]+/g,"-").replace(/^-|-$/g,"");}
function fixtureCandidate(query:ResearchQuery,index:number):ResearchCandidate{
  const source:ResearchSource=index%2===0?"geoapify_places":"tavily_search";
  const name=`${query.territory.city} ${query.category} ${index+1}`;
  const website=`https://${slug(name)}.example/`;
  const phone=index%3===0?`0803000${String(1000+index).slice(-4)}`:null;
  const email=index%4===0?`sales@${slug(name)}.example`:null;
  const whatsApp=index%5===0?`234803000${String(1000+index).slice(-4)}`:null;
  const instagram=index%3===1?`https://www.instagram.com/${slug(name)}`:null;
  const observedAt="2026-08-02T09:00:00.000Z",sourceUrl=website;
  const evidence=[
    {source,sourceUrl,observedAt,field:"businessName",value:name,confidence:"high" as const,verificationStatus:"verified" as const},
    {source,sourceUrl,observedAt,field:"requestedCategory",value:query.category,confidence:"high" as const,verificationStatus:"verified" as const},
    {source:"official_website" as const,sourceUrl,observedAt,field:"website",value:website,confidence:"high" as const,verificationStatus:"verified" as const},
  ];
  if(phone)evidence.push({source:"official_website",sourceUrl,observedAt,field:"phone",value:phone,confidence:"high",verificationStatus:"verified"});
  if(email)evidence.push({source:"official_website",sourceUrl,observedAt,field:"email",value:email,confidence:"high",verificationStatus:"verified"});
  if(whatsApp)evidence.push({source:"official_website",sourceUrl,observedAt,field:"whatsapp",value:whatsApp,confidence:"high",verificationStatus:"verified"});
  if(instagram)evidence.push({source:"official_website",sourceUrl,observedAt,field:"instagram",value:instagram,confidence:"high",verificationStatus:"verified"});
  return{sourceIdentities:{[source]:`fixture-${index+1}`},businessName:name,normalizedBusinessName:normalizeBusinessName(name),requestedCategory:query.category,providerCategories:[query.category],country:query.territory.country,state:query.territory.state,city:query.territory.city,address:null,latitude:query.territory.latitude??null,longitude:query.territory.longitude??null,website,phoneNumbers:phone?[phone]:[],emailAddresses:email?[email]:[],whatsAppNumbers:whatsApp?[whatsApp]:[],instagram:instagram?[instagram]:[],facebook:[],tiktok:[],x:[],youtube:[],publicDescription:`Synthetic fixture for ${query.category} research quality evaluation.`,evidence,discoverySources:[source,"official_website"],researchIssues:[],firstObservedAt:observedAt,lastObservedAt:observedAt};
}

async function loadMatrix(file:string):Promise<Matrix>{const parsed=JSON.parse(await readFile(file,"utf8")) as Matrix;if(!Array.isArray(parsed.territories)||!Array.isArray(parsed.categories))throw new Error("RESEARCH_MATRIX_INVALID");return parsed;}
function buildQueries(matrix:Matrix,options:Options){const territories=matrix.territories.filter((item)=>(!options.city||item.city===options.city)&&(!options.state||item.state===options.state));const categories=matrix.categories.filter((item)=>!options.category||item===options.category);return territories.flatMap((territory)=>categories.map((category)=>({territory,category,limit:options.limitPerQuery}))).slice(0,options.maxQueries);}
async function withOneRetry<T>(operation:()=>Promise<T>){try{return await operation();}catch(error){if(error instanceof ResearchProviderError&&/(TIMEOUT|REQUEST_FAILED)$/.test(error.reference))return operation();throw error;}}

async function liveCandidates(query:ResearchQuery){
  const results=[];const failures:string[]=[];let credits=0,raw=0,successes=0;
  if(process.env.GEOAPIFY_API_KEY?.trim()&&geoapifyCategory(query.category)){try{const result=await withOneRetry(()=>researchWithGeoapify(query));results.push(...result.candidates);credits+=result.estimatedCredits;raw+=result.rawResultCount;successes+=1;}catch(error){failures.push(error instanceof ResearchProviderError?error.reference:"GEOAPIFY_FAILED");}}
  if(process.env.TAVILY_API_KEY?.trim()){try{const result=await withOneRetry(()=>researchWithTavily(query));results.push(...result.candidates);credits+=result.estimatedCredits;raw+=result.rawResultCount;successes+=1;}catch(error){failures.push(error instanceof ResearchProviderError?error.reference:"TAVILY_FAILED");}}
  for(const candidate of results){if(!candidate.website||!isPlausibleOfficialWebsite(candidate.website))continue;try{const pages=await researchOfficialWebsite(candidate.website);for(const page of pages){const facts=page.facts;candidate.phoneNumbers.push(...facts.phoneNumbers);candidate.emailAddresses.push(...facts.emailAddresses);candidate.whatsAppNumbers.push(...facts.whatsAppNumbers);candidate.instagram.push(...facts.instagram);candidate.facebook.push(...facts.facebook);candidate.tiktok.push(...facts.tiktok);candidate.x.push(...facts.x);candidate.youtube.push(...facts.youtube);candidate.evidence.push(...facts.evidence);if(!candidate.discoverySources.includes("official_website"))candidate.discoverySources.push("official_website");}}catch(error){candidate.researchIssues.push(error instanceof ResearchProviderError?error.reference:"WEBSITE_RESEARCH_FAILED");}}
  return{candidates:results,failures,credits,raw,successes};
}

export async function runResearchEvaluation(args:string[]){
  const options=parseResearchArgs(args),matrix=await loadMatrix(options.matrix),queries=buildQueries(matrix,options);
  if(!queries.length)throw new Error("RESEARCH_QUERY_MATRIX_EMPTY");
  console.log(`Intended query count: ${queries.length}`);
  const rawCandidates:ResearchCandidate[]=[];const failures:string[]=[];let credits=0,rawResults=0,providerSuccesses=0;
  if(options.live){for(const query of queries){const result=await liveCandidates(query);rawCandidates.push(...result.candidates);failures.push(...result.failures);credits+=result.credits;rawResults+=result.raw;providerSuccesses+=result.successes;}}
  else{queries.forEach((query,index)=>rawCandidates.push(fixtureCandidate(query,index)));rawCandidates.push({...rawCandidates[0],sourceIdentities:{tavily_search:"fixture-duplicate"},discoverySources:["tavily_search"],researchIssues:["Duplicate fixture from a second source."]});rawResults=rawCandidates.length;providerSuccesses=queries.length;}
  const deduplicated=deduplicateCandidates(rawCandidates);
  const metrics=computeEvaluationMetrics(deduplicated.candidates,{queriesAttempted:queries.length,providerSuccesses,providerFailures:failures.length,totalRawResults:rawResults,duplicatesMerged:deduplicated.duplicatesMerged,estimatedProviderCredits:credits,failureReferences:failures});
  const runId=`run-${new Date().toISOString().replace(/[:.]/g,"-")}`,outputDir=options.outputDir??path.join("tmp","sales-scout-research",runId);
  await writeEvaluationOutputs(outputDir,deduplicated.candidates,metrics);
  console.log(`Evaluation output: ${outputDir}`);
  return{outputDir,candidates:deduplicated.candidates,metrics};
}
if(process.argv[1]&&import.meta.url===pathToFileURL(path.resolve(process.argv[1])).href){runResearchEvaluation(process.argv.slice(2)).catch((error)=>{console.error(error instanceof Error?error.message:"RESEARCH_EVALUATION_FAILED");process.exitCode=1;});}
