"use server";
import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/src/lib/admin-auth";
import { siteConfig } from "@/src/config/site";
import { createAdminSupabaseClient } from "@/src/lib/supabase/admin";
export async function updateNotificationReadsAction(ids:string[],mode:"read"|"archive"){const user=await requireAdmin();const clean=ids.filter((id)=>/^[0-9a-f-]{36}$/i.test(id)).slice(0,100);if(!clean.length)return {ok:false};const now=new Date().toISOString();const rows=clean.map((notification_id)=>({notification_id,admin_user_id:user.id,...(mode==="read"?{read_at:now}:{read_at:now,archived_at:now})}));await createAdminSupabaseClient().from("app_notification_reads").upsert(rows,{onConflict:"notification_id,admin_user_id"});revalidatePath("/admin/notifications");return {ok:true};}
export async function markAllNotificationsReadAction(){const user=await requireAdmin();const supabase=createAdminSupabaseClient();const {data}=await supabase.from("app_notifications").select("id").eq("site",siteConfig.domain).limit(500);if(data?.length)await supabase.from("app_notification_reads").upsert(data.map(({id})=>({notification_id:id,admin_user_id:user.id,read_at:new Date().toISOString()})),{onConflict:"notification_id,admin_user_id"});revalidatePath("/admin/notifications");return {ok:true};}
