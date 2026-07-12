import { MarketingCampaignsClient } from "@/app/admin/(protected)/marketing/campaigns/marketing-campaigns-client";
import { getAdminCampaigns } from "@/src/lib/marketing-campaigns";

export const dynamic = "force-dynamic";

export default async function AdminMarketingCampaignsPage() {
  const campaigns = await getAdminCampaigns();
  return <MarketingCampaignsClient initialCampaigns={campaigns} />;
}
