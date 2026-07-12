import { NextRequest, NextResponse } from "next/server";
import { getActiveCampaignBySlug, recordCampaignClick } from "@/src/lib/marketing-campaigns";
import { campaignTargetUrl } from "@/src/lib/marketing-campaigns-shared";
import { getSiteUrl } from "@/src/lib/site-url";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest, context: { params: Promise<{ slug: string }> }) {
  const { slug } = await context.params;
  const campaign = await getActiveCampaignBySlug(slug);
  if (!campaign) return NextResponse.redirect(new URL("/shop", getSiteUrl()));

  const destination = campaignTargetUrl(campaign);
  await recordCampaignClick({
    campaignId: campaign.id,
    landingPath: destination,
    referrer: request.headers.get("referer"),
    userAgent: request.headers.get("user-agent"),
  });
  return NextResponse.redirect(new URL(destination, getSiteUrl()));
}

