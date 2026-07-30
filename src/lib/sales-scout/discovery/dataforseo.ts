import "server-only";
import { z } from "zod";
import { discoveryCandidateSchema } from "../schemas.ts";
import type { DiscoveryCandidate, DiscoveryQuery } from "./types.ts";

export const dataForSeoCategoryMap = { Restaurant: "restaurant", Caterer: "caterer", Hotel: "hotel", Supermarket: "supermarket" } as const;
export function mapCampaignCategories(categories: string[]) {
  const mapped = categories.filter((c): c is keyof typeof dataForSeoCategoryMap => c in dataForSeoCategoryMap).map(c => dataForSeoCategoryMap[c]);
  return { mapped, omitted: categories.filter(c => !mapped.includes((dataForSeoCategoryMap as Record<string, "restaurant" | "caterer" | "hotel" | "supermarket" | undefined>)[c] ?? "restaurant")) };
}

const itemSchema = z.object({ title:z.string().trim().min(1), url:z.string().url().optional(), category:z.string().optional(), city:z.string().optional(), region:z.string().optional(), country_code:z.string().optional(), phone:z.string().optional(), description:z.string().optional(), place_id:z.string().optional() }).strict();
const responseSchema = z.object({ status_code:z.number(), status_message:z.string(), tasks:z.array(z.object({ id:z.string().optional(), status_code:z.number(), status_message:z.string(), cost:z.number().optional(), result:z.array(itemSchema).optional() }).strict()) }).strict();

export function mapDataForSeoResponse(input: unknown, query: DiscoveryQuery, observedAt = new Date().toISOString()) {
  const parsed=responseSchema.parse(input), task=parsed.tasks[0]; if (!task || task.status_code >= 400) throw new Error("DataForSEO discovery request failed.");
  const candidates: DiscoveryCandidate[]=[];
  for (const item of task.result ?? []) {
    if (!item.url && !item.phone) continue;
    const channels: DiscoveryCandidate["channels"]=[];
    if (item.phone) channels.push({platform:"phone",handleOrValue:item.phone,isPrimary:true,sourceId:item.place_id ?? undefined,evidence:{}});
    if (item.url) channels.push({platform:"website",handleOrValue:item.url,profileUrl:item.url,isPrimary:channels.length===0,sourceId:item.place_id ?? undefined,evidence:{}});
    const candidate={provider:"dataforseo_business_listings",providerSourceId:item.place_id ?? item.url ?? item.phone!,sourceUrl:item.url ?? "https://dataforseo.com/",observedAt,campaignId:query.campaignId,businessName:item.title,businessCategory:item.category ?? "Food Vendor",city:item.city ?? "Lagos",state:item.region ?? undefined,country:item.country_code === "NG" ? "Nigeria" : (item.country_code ?? "Nigeria"),publicDescription:item.description ?? null,serviceAreaCities:[],mostRecentPublicActivityAt:null,recurringProduceDemandEvidence:null,demandBand:"unknown",isInactiveOrClosed:false,isConsumerOnly:false,channels};
    const checked=discoveryCandidateSchema.safeParse(candidate); if (checked.success) candidates.push(checked.data);
  }
  return {candidates,taskId:task.id ?? null,cost:task.cost ?? 0,rawResultCount:(task.result ?? []).length};
}

export async function discoverWithDataForSeo(query: DiscoveryQuery, categories:string[], coordinates:string, limit:number) {
  const login=process.env.DATAFORSEO_LOGIN, password=process.env.DATAFORSEO_PASSWORD; if (!login || !password) throw new Error("DataForSEO discovery is not configured.");
  const mapped=mapCampaignCategories(categories).mapped; if (!mapped.length) throw new Error("No supported discovery categories configured.");
  const auth=Buffer.from(`${login}:${password}`).toString("base64");
  const response=await fetch("https://api.dataforseo.com/v3/business_data/business_listings/search/live",{method:"POST",headers:{Authorization:`Basic ${auth}`,"Content-Type":"application/json"},body:JSON.stringify([{language_code:"en",location_coordinate:coordinates,categories:mapped,limit}]),signal:AbortSignal.timeout(20000)});
  if(!response.ok) throw new Error("DataForSEO discovery request failed.");
  return mapDataForSeoResponse(await response.json(),query);
}
