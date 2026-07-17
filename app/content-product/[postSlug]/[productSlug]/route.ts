import { NextRequest, NextResponse } from "next/server";
import { contentPublicConfig } from "@/src/config/site";
import { getPublishedPostBySlug } from "@/src/lib/content";
import { getPublicProductBySlug } from "@/src/lib/products";
import { createContentAdminSupabaseClient } from "@/src/lib/supabase/content-admin-server";
import { hasAdminSupabaseConfig } from "@/src/lib/supabase/config";
import { CONSENT_COOKIE_NAME, parseConsentCookie } from "@/src/lib/consent-cookie";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest, { params }: { params: Promise<{ postSlug: string; productSlug: string }> }) {
  if (!contentPublicConfig.hubEnabled) return new NextResponse("Content referrals are disabled.", { status: 404 });
  const { postSlug, productSlug } = await params;
  const [post, product] = await Promise.all([getPublishedPostBySlug(postSlug), getPublicProductBySlug(productSlug)]);
  if (!post || !product) return new NextResponse("Referral unavailable.", { status: 404 });
  const destination = `/shop/${product.slug}`;
  const consent = parseConsentCookie(request.cookies.get(CONSENT_COOKIE_NAME)?.value);
  if (consent.analytics && hasAdminSupabaseConfig()) {
    try {
      const supabase = createContentAdminSupabaseClient();
      await supabase.from("content_product_clicks").insert({ post_id: post.id, product_id: product.id, destination_path: destination, consent_recorded: true });
    } catch {
      // Internal product redirects should never fail because reporting failed.
    }
  }
  const response = NextResponse.redirect(new URL(destination, request.url), { status: 302 });
  response.cookies.set("farm_content_referral", JSON.stringify({ postId: post.id, postSlug: post.slug, productId: product.id, productSlug: product.slug, seenAt: new Date().toISOString() }), { httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", maxAge: 60 * 60 * 24 * 30, path: "/" });
  return response;
}
