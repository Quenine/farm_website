import { notFound } from "next/navigation";
import { PageShell, SectionHeader } from "@/src/components/ui";
import { contentPublicConfig, siteConfig } from "@/src/config/site";
import { contentMetadata } from "@/src/lib/content-config";

export function generateMetadata() { return contentMetadata({ title: "Editorial Policy", description: `${siteConfig.name} editorial standards for agribusiness content and recommendations.`, path: "/editorial-policy" }); }

export default function EditorialPolicyPage() {
  if (!contentPublicConfig.hubEnabled) notFound();
  const items = ["Content should be researched with clear source references, field experience, original observation, or credible third-party information.", "Recommendations must identify whether they are based on direct testing, editorial research, or merchant information.", "Affiliate relationships do not guarantee positive coverage and sponsored content must be labelled.", "Prices, availability, agricultural outcomes, and financial results may change and are never guaranteed.", "Corrections and updates should be reviewed, dated, and reflected visibly where material.", "The platform must not publish fake reviews, fabricated ratings, hidden keyword blocks, or generated articles at scale."];
  return <PageShell><section className="mx-auto max-w-4xl px-4 py-12 sm:px-6 lg:px-8"><SectionHeader eyebrow="Trust" title="Editorial Policy" body={`${siteConfig.name} publishes practical agribusiness content for ${contentPublicConfig.primaryMarket} with transparent sourcing, disclosures, and correction paths.`} /><div className="mt-8 rounded-lg bg-white p-6 shadow-sm"><ul className="ml-5 list-disc space-y-3 leading-8 text-stone-700">{items.map((item) => <li key={item}>{item}</li>)}</ul><p className="mt-6 leading-8 text-stone-700">Send corrections or source questions to <a className="font-bold text-green-800 underline" href={`mailto:${siteConfig.email}`}>{siteConfig.email}</a>.</p></div></section></PageShell>;
}
