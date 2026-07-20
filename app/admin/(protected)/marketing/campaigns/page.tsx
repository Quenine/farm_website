import { MarketingCampaignsClient } from "@/app/admin/(protected)/marketing/campaigns/marketing-campaigns-client";
import { getAdminCampaigns } from "@/src/lib/marketing-campaigns";
import { MarketingNav } from "@/src/components/marketing-command-ui";
import { CampaignSpendForm } from "@/src/components/marketing-entry-forms";

export const dynamic = "force-dynamic";

export default async function AdminMarketingCampaignsPage() {
  const campaigns = await getAdminCampaigns();
  return <><MarketingNav/><CampaignSpendForm campaigns={campaigns.map(({id,name})=>({id,name}))}/><MarketingCampaignsClient initialCampaigns={campaigns} /></>;
}
