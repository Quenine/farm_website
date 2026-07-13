import { NextResponse } from "next/server";
import { contentPublicConfig } from "@/src/config/site";
import { requireAdmin } from "@/src/lib/admin-auth";
import { createContentAdminSupabaseClient } from "@/src/lib/supabase/content-admin-server";

export const dynamic = "force-dynamic";

export async function GET() {
  await requireAdmin();
  if (!contentPublicConfig.subscriptionsEnabled) return new NextResponse("Subscribers disabled.", { status: 404 });
  const supabase = createContentAdminSupabaseClient();
  const { data, error } = await supabase.from("content_subscribers").select("email,status,subscription_topic,source_path,consented_at,unsubscribed_at").order("created_at", { ascending: false }).limit(5000);
  if (error) return new NextResponse("Unable to export subscribers.", { status: 500 });
  const rows = [["email","status","subscription_topic","source_path","consented_at","unsubscribed_at"], ...((data ?? []) as Array<Record<string, unknown>>).map((row)=>[row.email,row.status,row.subscription_topic,row.source_path,row.consented_at,row.unsubscribed_at])];
  const csv = rows.map((row)=>row.map((cell)=>`"${String(cell ?? "").replaceAll('"','""')}"`).join(",")).join("\n");
  return new NextResponse(csv, { headers: { "content-type": "text/csv; charset=utf-8", "content-disposition": "attachment; filename=content-subscribers.csv" } });
}
