import "server-only";

import { createAdminSupabaseClient } from "@/src/lib/supabase/admin";
import { requireAdmin } from "@/src/lib/admin-auth";

type CampaignRow = {
  id: string;
  name: string;
  slug: string;
  channel: string;
  source: string;
  medium: string;
  campaign_name: string;
  content: string | null;
  term: string | null;
  target_path: string;
  is_active: boolean;
  starts_at: string | null;
  ends_at: string | null;
  created_at: string;
  updated_at: string;
};

import { isInternalPath, type MarketingCampaign } from "@/src/lib/marketing-campaigns-shared";

function mapCampaign(row: CampaignRow): MarketingCampaign {
  return {
    id: row.id,
    name: row.name,
    slug: row.slug,
    channel: row.channel,
    source: row.source,
    medium: row.medium,
    campaignName: row.campaign_name,
    content: row.content,
    term: row.term,
    targetPath: row.target_path,
    isActive: row.is_active,
    startsAt: row.starts_at,
    endsAt: row.ends_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export async function getActiveCampaignBySlug(slug: string) {
  const supabase = createAdminSupabaseClient();
  const now = new Date().toISOString();
  const { data, error } = await supabase
    .from("marketing_campaigns")
    .select("*")
    .eq("slug", slug)
    .eq("is_active", true)
    .or(`starts_at.is.null,starts_at.lte.${now}`)
    .or(`ends_at.is.null,ends_at.gte.${now}`)
    .maybeSingle();
  if (error || !data) return null;
  const campaign = mapCampaign(data as CampaignRow);
  return isInternalPath(campaign.targetPath) ? campaign : null;
}

export async function recordCampaignClick(input: { campaignId: string; landingPath?: string | null; referrer?: string | null; userAgent?: string | null }) {
  const userAgentFamily = input.userAgent?.includes("WhatsApp")
    ? "WhatsApp"
    : input.userAgent?.includes("Instagram")
      ? "Instagram"
      : input.userAgent?.includes("FB")
        ? "Facebook"
        : input.userAgent
          ? "Browser"
          : null;
  try {
    await createAdminSupabaseClient().from("marketing_campaign_clicks").insert({
      campaign_id: input.campaignId,
      landing_path: input.landingPath?.slice(0, 300) ?? null,
      referrer: input.referrer?.slice(0, 300) ?? null,
      user_agent_family: userAgentFamily,
    });
  } catch {
    // Click logging must never block redirects.
  }
}

export async function getAdminCampaigns() {
  await requireAdmin();
  const supabase = createAdminSupabaseClient();
  const { data, error } = await supabase.from("marketing_campaigns").select("*").order("created_at", { ascending: false }).limit(100);
  if (error) throw new Error(`Unable to load campaigns: ${error.message}`);
  const campaigns = ((data ?? []) as CampaignRow[]).map(mapCampaign);
  if (campaigns.length === 0) return campaigns;
  const ids = campaigns.map((campaign) => campaign.id);
  const slugs = campaigns.map((campaign) => campaign.slug);

  const [{ data: clicks }, { data: orders }] = await Promise.all([
    supabase.from("marketing_campaign_clicks").select("campaign_id").in("campaign_id", ids),
    supabase.from("orders").select("payment_status,total_amount,first_touch_attribution,last_touch_attribution").or(slugs.map((slug) => `first_touch_attribution->>utm_id.eq.${slug},last_touch_attribution->>utm_id.eq.${slug}`).join(",")),
  ]);

  return campaigns.map((campaign) => {
    const attributed = (orders ?? []).filter((order) => {
      const first = order.first_touch_attribution as { utm_id?: string } | null;
      const last = order.last_touch_attribution as { utm_id?: string } | null;
      return first?.utm_id === campaign.slug || last?.utm_id === campaign.slug;
    });
    const paid = attributed.filter((order) => order.payment_status === "paid");
    return {
      ...campaign,
      clickCount: (clicks ?? []).filter((click) => click.campaign_id === campaign.id).length,
      attributedOrderCount: attributed.length,
      attributedPaidOrderCount: paid.length,
      attributedPaidRevenue: paid.reduce((sum, order) => sum + Number(order.total_amount ?? 0), 0),
    };
  });
}



