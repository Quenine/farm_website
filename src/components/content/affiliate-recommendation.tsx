"use client";

import Link from "next/link";
import { ExternalLink } from "lucide-react";
import { trackGaEvent } from "@/src/lib/analytics";
import type { AffiliateOffer } from "@/src/lib/content";

function formatBasis(value: string) {
  return value.replaceAll("_", " ");
}

export function AffiliateRecommendation({ offer, postSlug }: { offer: AffiliateOffer; postSlug: string }) {
  const cta = offer.button_label || "Check current price";
  const recommendHref = `/recommend/${offer.slug}?post=${encodeURIComponent(postSlug)}`;

  return (
    <article className="rounded-lg border border-amber-200 bg-white p-4 shadow-sm">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <p className="text-xs font-bold uppercase tracking-[0.14em] text-amber-700">Affiliate recommendation</p>
          <h3 className="mt-1 text-lg font-bold text-green-950">{offer.title}</h3>
          <p className="mt-1 text-sm text-stone-600">{offer.partner?.name ?? "External merchant"}</p>
          {offer.best_for ? <p className="mt-2 text-sm font-semibold text-green-900">Best for: {offer.best_for}</p> : null}
        </div>
        <Link
          href={recommendHref}
          target="_blank"
          rel="sponsored nofollow noopener noreferrer"
          className="inline-flex h-10 shrink-0 items-center justify-center gap-2 rounded-full bg-green-800 px-4 text-sm font-bold text-white hover:bg-green-900"
        >
          {cta}
          <ExternalLink size={15} aria-hidden />
          <span className="sr-only">External merchant link</span>
        </Link>
      </div>

      <details
        className="mt-3 rounded-md border border-stone-200 bg-stone-50 px-3 py-2 text-sm text-stone-700"
        onToggle={(event) => {
          if (event.currentTarget.open) {
            trackGaEvent("affiliate_details_expand", { offer_slug: offer.slug, post_slug: postSlug });
          }
        }}
      >
        <summary className="cursor-pointer font-bold text-green-900">View details</summary>
        <div className="mt-3 grid gap-3 leading-6">
          {offer.short_description ? <p>{offer.short_description}</p> : null}
          <dl className="grid gap-2 sm:grid-cols-3">
            <div>
              <dt className="font-bold text-stone-950">Basis</dt>
              <dd className="capitalize">{formatBasis(offer.recommendation_basis)}</dd>
            </div>
            <div>
              <dt className="font-bold text-stone-950">Regions</dt>
              <dd>{offer.available_regions?.join(", ") || "Check merchant availability"}</dd>
            </div>
            <div>
              <dt className="font-bold text-stone-950">Price freshness</dt>
              <dd>{offer.price_last_checked_at ? `Checked ${new Date(offer.price_last_checked_at).toLocaleDateString("en-NG")}` : "Confirm on merchant site"}</dd>
            </div>
          </dl>
          {offer.editorial_verdict ? <p><strong className="text-stone-950">Editorial verdict:</strong> {offer.editorial_verdict}</p> : null}
          {offer.pros?.length || offer.cons?.length ? (
            <div className="grid gap-3 sm:grid-cols-2">
              {offer.pros?.length ? <div><p className="font-bold text-green-950">Pros</p><ul className="ml-5 list-disc">{offer.pros.map((item) => <li key={item}>{item}</li>)}</ul></div> : null}
              {offer.cons?.length ? <div><p className="font-bold text-green-950">Cons</p><ul className="ml-5 list-disc">{offer.cons.map((item) => <li key={item}>{item}</li>)}</ul></div> : null}
            </div>
          ) : null}
          <p className="text-xs leading-5 text-stone-500">Affiliate link. Merchant controls price, availability, checkout, and commission tracking.</p>
        </div>
      </details>
    </article>
  );
}
