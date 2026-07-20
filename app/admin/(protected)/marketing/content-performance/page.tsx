import { AdminHeader } from "@/src/components/admin";
import { Kpi, MarketingNav } from "@/src/components/marketing-command-ui";
import { requireAdmin } from "@/src/lib/admin-auth";
import { createAdminSupabaseClient } from "@/src/lib/supabase/admin";
import { AffiliateConversionForm } from "@/src/components/marketing-entry-forms";
export const dynamic = "force-dynamic";
export default async function Page() {
  await requireAdmin();
  const db = createAdminSupabaseClient();
  const [
    posts,
    productClicks,
    affiliateClicks,
    subscribers,
    offers,
    partners,
    relations,
  ] = await Promise.all([
    db
      .from("content_posts")
      .select("id,title,slug,status,contains_affiliate_content")
      .eq("status", "published"),
    db
      .from("content_product_clicks")
      .select("post_id,product_id,products(name),content_posts(title)")
      .limit(2000),
    db
      .from("affiliate_clicks")
      .select("post_id,offer_id,affiliate_offers(title),content_posts(title)")
      .limit(2000),
    db
      .from("content_subscribers")
      .select("id", { count: "exact", head: true })
      .eq("status", "active"),
    db
      .from("affiliate_offers")
      .select("id,title,is_active,partner_id,price_last_checked_at"),
    db.from("affiliate_partners").select("id,name,is_active"),
    db.from("content_post_products").select("post_id,product_id"),
  ]);
  const postRows = posts.data ?? [],
    productRows = productClicks.data ?? [],
    affiliateRows = affiliateClicks.data ?? [],
    related = new Set((relations.data ?? []).map((x) => x.post_id));
  const noCta = postRows.filter(
    (p) => !related.has(p.id) && !p.contains_affiliate_content,
  );
  const offerCounts = new Map<string, number>();
  affiliateRows.forEach((x) =>
    offerCounts.set(x.offer_id, (offerCounts.get(x.offer_id) || 0) + 1),
  );
  return (
    <>
      <AdminHeader
        title="Content and affiliate performance"
        body="Clicks are first-party activity. Affiliate sales and commissions are unavailable unless supplied by merchants and entered separately."
      />
      <MarketingNav />
      <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Kpi label="Published posts" value={postRows.length} />
        <Kpi
          label="Post views"
          value="Unavailable"
          note="Requires GA4 Data API"
        />
        <Kpi label="Content product clicks" value={productRows.length} />
        <Kpi label="Affiliate clicks" value={affiliateRows.length} />
        <Kpi label="Active subscribers" value={subscribers.count ?? 0} />
        <Kpi
          label="Content-assisted orders"
          value="Unavailable"
          note="Shown only where order content_attribution supports it"
        />
        <Kpi label="Posts with no commercial CTA" value={noCta.length} />
        <Kpi
          label="Offers requiring attention"
          value={
            (offers.data ?? []).filter(
              (x) => !x.is_active || !x.price_last_checked_at,
            ).length
          }
        />
      </section>
      <section className="mt-6 rounded-xl border bg-white p-5">
        <h2 className="font-bold">Most-clicked offers</h2>
        <ul className="mt-3 grid gap-2">
          {[...(offers.data ?? [])]
            .sort(
              (a, b) =>
                (offerCounts.get(b.id) || 0) - (offerCounts.get(a.id) || 0),
            )
            .slice(0, 10)
            .map((offer) => (
              <li key={offer.id} className="flex justify-between border-b py-2">
                <span>{offer.title}</span>
                <strong>{offerCounts.get(offer.id) || 0} clicks</strong>
              </li>
            ))}
        </ul>
        <p className="mt-4 text-sm text-stone-500">
          No affiliate conversion, commission, or merchant revenue is inferred
          from these clicks.
        </p>
      </section>
      <AffiliateConversionForm partners={(partners.data??[]).map(({id,name})=>({id,name}))} offers={(offers.data??[]).map(({id,title})=>({id,title}))}/>
    </>
  );
}
