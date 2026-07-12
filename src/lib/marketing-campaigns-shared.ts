export type MarketingCampaign = {
  id: string;
  name: string;
  slug: string;
  channel: string;
  source: string;
  medium: string;
  campaignName: string;
  content: string | null;
  term: string | null;
  targetPath: string;
  isActive: boolean;
  startsAt: string | null;
  endsAt: string | null;
  createdAt: string;
  updatedAt: string;
  clickCount?: number;
  attributedOrderCount?: number;
  attributedPaidOrderCount?: number;
  attributedPaidRevenue?: number;
};

export function isInternalPath(path: string) {
  return path.startsWith("/") && !path.startsWith("//") && !path.includes("\\");
}

export function campaignTargetUrl(campaign: Pick<MarketingCampaign, "targetPath" | "source" | "medium" | "campaignName" | "content" | "term" | "slug">) {
  const [pathname, query = ""] = campaign.targetPath.split("?");
  const params = new URLSearchParams(query);
  params.set("utm_source", campaign.source);
  params.set("utm_medium", campaign.medium);
  params.set("utm_campaign", campaign.campaignName);
  params.set("utm_id", campaign.slug);
  if (campaign.content) params.set("utm_content", campaign.content);
  if (campaign.term) params.set("utm_term", campaign.term);
  const qs = params.toString();
  return qs ? `${pathname}?${qs}` : pathname;
}
