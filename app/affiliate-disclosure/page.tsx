import { notFound } from "next/navigation";
import { PageShell, SectionHeader } from "@/src/components/ui";
import { contentPublicConfig, siteConfig } from "@/src/config/site";
import { contentMetadata } from "@/src/lib/content-config";

export function generateMetadata() { return contentMetadata({ title: "Affiliate Disclosure", description: `How ${siteConfig.name} uses affiliate links and recommendations.`, path: "/affiliate-disclosure" }); }

export default function AffiliateDisclosurePage() {
  if (!contentPublicConfig.affiliateEnabled) notFound();
  return <PageShell><section className="mx-auto max-w-4xl px-4 py-12 sm:px-6 lg:px-8"><SectionHeader eyebrow="Disclosure" title="Affiliate Disclosure" body={`Some recommendations on this site may use affiliate links. ${siteConfig.name} may earn a commission when you purchase through those links, at no additional cost to you.`} /><div className="mt-8 space-y-5 rounded-lg bg-white p-6 leading-8 text-stone-700 shadow-sm"><p>External merchants control their own product pages, checkout, prices, availability, delivery, refunds, and affiliate-network tracking.</p><p>{siteConfig.name} does not operate an affiliate-member programme, calculate commissions for users, or pay public referrers.</p><p>Affiliate relationships do not guarantee positive coverage. Recommendations should be based on direct testing, editorial research, merchant information, or clearly identified source material.</p><p>Contact us at <a className="font-bold text-green-800 underline" href={`mailto:${siteConfig.email}`}>{siteConfig.email}</a> for corrections or disclosure questions.</p></div></section></PageShell>;
}
