"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createAdminSupabaseClient } from "@/src/lib/supabase/admin";
import { requireAdmin } from "@/src/lib/admin-auth";
import { isInternalPath } from "@/src/lib/marketing-campaigns-shared";

const campaignSchema = z.object({
  id: z.string().uuid().optional(),
  name: z.string().trim().min(2).max(160),
  slug: z.string().trim().min(2).max(120).regex(/^[a-z0-9-]+$/),
  channel: z.string().trim().min(2).max(80),
  source: z.string().trim().min(2).max(80),
  medium: z.string().trim().min(2).max(80),
  campaignName: z.string().trim().min(2).max(120),
  content: z.string().trim().max(120).optional(),
  term: z.string().trim().max(120).optional(),
  targetPath: z.string().trim().min(1).max(300),
  startsAt: z.string().trim().optional(),
  endsAt: z.string().trim().optional(),
  isActive: z.boolean(),
});

export async function saveCampaignAction(input: z.input<typeof campaignSchema>) {
  await requireAdmin();
  const parsed = campaignSchema.safeParse(input);
  if (!parsed.success) return { success: false, message: "Check the campaign details." };
  if (!isInternalPath(parsed.data.targetPath)) return { success: false, message: "Target page must be an internal path like /shop." };

  const payload = {
    name: parsed.data.name,
    slug: parsed.data.slug,
    channel: parsed.data.channel,
    source: parsed.data.source,
    medium: parsed.data.medium,
    campaign_name: parsed.data.campaignName,
    content: parsed.data.content || null,
    term: parsed.data.term || null,
    target_path: parsed.data.targetPath,
    starts_at: parsed.data.startsAt || null,
    ends_at: parsed.data.endsAt || null,
    is_active: parsed.data.isActive,
    updated_at: new Date().toISOString(),
  };
  const supabase = createAdminSupabaseClient();
  const result = parsed.data.id
    ? await supabase.from("marketing_campaigns").update(payload).eq("id", parsed.data.id)
    : await supabase.from("marketing_campaigns").insert(payload);
  if (result.error) return { success: false, message: result.error.message };
  revalidatePath("/admin/marketing/campaigns");
  return { success: true, message: "Campaign saved." };
}

export async function toggleCampaignAction(id: string, isActive: boolean) {
  await requireAdmin();
  const supabase = createAdminSupabaseClient();
  const { error } = await supabase.from("marketing_campaigns").update({ is_active: isActive, updated_at: new Date().toISOString() }).eq("id", id);
  if (error) return { success: false, message: error.message };
  revalidatePath("/admin/marketing/campaigns");
  return { success: true };
}

