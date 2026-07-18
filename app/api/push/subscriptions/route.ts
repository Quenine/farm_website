import "server-only";

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getAuthenticatedAdmin } from "@/src/lib/admin-auth";
import { siteConfig } from "@/src/config/site";
import { endpointHash } from "@/src/lib/operational-notifications";
import { createAdminSupabaseClient } from "@/src/lib/supabase/admin";

export const runtime = "nodejs";
const schema = z.object({ endpoint: z.string().url().max(2048), keys: z.object({ p256dh: z.string().min(20).max(512), auth: z.string().min(8).max(256) }), context: z.enum(["admin","customer"]), preferences: z.object({ transactional: z.boolean().default(true), marketing: z.boolean().default(false) }).optional() });
const attempts = new Map<string, { count: number; reset: number }>();
function sameOrigin(request: NextRequest) { try { return new URL(request.headers.get("origin") || request.url).host === request.nextUrl.host; } catch { return false; } }
function limited(request: NextRequest) { const key=request.headers.get("x-forwarded-for")?.split(",")[0] || "local"; const now=Date.now(); const item=attempts.get(key); if(!item||item.reset<now){attempts.set(key,{count:1,reset:now+60000});return false;} item.count++; return item.count>12; }

export async function POST(request: NextRequest) {
  if (!sameOrigin(request) || limited(request)) return NextResponse.json({ ok:false, message:"Subscription unavailable." }, { status:403 });
  const parsed=schema.safeParse(await request.json().catch(()=>null)); if(!parsed.success)return NextResponse.json({ok:false,message:"Invalid subscription."},{status:400});
  const admin=await getAuthenticatedAdmin(); if(parsed.data.context==="admin"&&!admin)return NextResponse.json({ok:false,message:"Unauthorized."},{status:401});
  const prefs={transactional:parsed.data.preferences?.transactional!==false,marketing:parsed.data.preferences?.marketing===true};
  const supabase=createAdminSupabaseClient(); const hash=endpointHash(parsed.data.endpoint);
  const {data,error}=await supabase.from("web_push_subscriptions").upsert({site:siteConfig.domain,admin_user_id:admin?.id??null,context:parsed.data.context,endpoint:parsed.data.endpoint,endpoint_hash:hash,p256dh:parsed.data.keys.p256dh,auth_key:parsed.data.keys.auth,enabled:true,preferences:prefs,revoked_at:null,updated_at:new Date().toISOString()},{onConflict:"site,endpoint_hash"}).select("id").single();
  return error?NextResponse.json({ok:false,message:"Subscription unavailable."},{status:503}):NextResponse.json({ok:true,subscriptionId:data.id});
}
export async function PATCH(request:NextRequest){return POST(request);}
export async function DELETE(request:NextRequest){if(!sameOrigin(request))return NextResponse.json({ok:false},{status:403});const body=await request.json().catch(()=>null) as {endpoint?:string}|null;if(!body?.endpoint)return NextResponse.json({ok:false},{status:400});await createAdminSupabaseClient().from("web_push_subscriptions").update({enabled:false,revoked_at:new Date().toISOString()}).eq("site",siteConfig.domain).eq("endpoint_hash",endpointHash(body.endpoint));return NextResponse.json({ok:true});}
