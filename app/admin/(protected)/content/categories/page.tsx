import { notFound } from "next/navigation";
import { AdminHeader } from "@/src/components/admin";
import { contentPublicConfig } from "@/src/config/site";

export default function ContentPlaceholderPage() {
  if (!contentPublicConfig.hubEnabled) notFound();
  return <div><AdminHeader title="Content workflow" body="The protected content engine is enabled. Use the database migration before creating posts, authors, categories, tags, sources, videos, related products, and affiliate offer relationships." /><div className="rounded-lg bg-white p-5 text-sm leading-6 text-stone-700 shadow-sm"><p>Publishing must be explicit. Do not publish without title, slug, excerpt, meaningful Markdown, author, category, required alt text, valid sources, and disclosure when affiliate offers are attached.</p><p className="mt-3 font-semibold text-green-950">Editor helpers support tokens: [[affiliate:offer-slug]], [[product:product-slug]], [[comparison:post-offers]], [[video:post-video]], [[sources]], [[newsletter]], [[callout:business-supply]], [[tool:poultry-feed-requirement]], [[tool:egg-sales-margin]].</p></div></div>;
}

