import { NextRequest, NextResponse } from "next/server";
import { contentPublicConfig } from "@/src/config/site";
import { getActiveAffiliateOffer, getPublishedPostBySlug, validHttpUrl } from "@/src/lib/content";
import { createContentAdminSupabaseClient } from "@/src/lib/supabase/content-admin-server";
import { hasAdminSupabaseConfig } from "@/src/lib/supabase/config";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  if (!contentPublicConfig.affiliateEnabled) return new NextResponse("Affiliate recommendations are disabled.", { status: 404 });
  const { slug } = await params;
  const offer = await getActiveAffiliateOffer(slug);
  if (!offer) return new NextResponse("Recommendation unavailable.", { status: 404 });
  const destination = validHttpUrl(offer.destination_url);
  if (!destination) return new NextResponse("Recommendation destination is invalid.", { status: 400 });

  const postSlug = request.nextUrl.searchParams.get("post")?.trim() ?? "";
  const post = postSlug ? await getPublishedPostBySlug(postSlug) : null;
  const consent = request.nextUrl.searchParams.get("consent") === "1";
  if (consent && hasAdminSupabaseConfig()) {
    try {
      const supabase = createContentAdminSupabaseClient();
      await supabase.from("affiliate_clicks").insert({ offer_id: offer.id, post_id: post?.id ?? null, referrer_path: post ? `/blog/${post.slug}` : request.headers.get("referer"), consent_recorded: true, campaign_context: null });
    } catch {
      // Redirects must continue even if optional click logging fails.
    }
  }
  return NextResponse.redirect(destination, { status: 302 });
}
