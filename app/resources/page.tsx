import Link from "next/link";
import { notFound } from "next/navigation";
import { ContentSubscribeForm } from "@/src/components/content/subscribe-form";
import { PageShell, SectionHeader } from "@/src/components/ui";
import { contentPublicConfig, siteConfig } from "@/src/config/site";
import { getContentIndexData } from "@/src/lib/content";
import { contentMetadata } from "@/src/lib/content-config";

export const dynamic = "force-dynamic";
export async function generateMetadata() { return contentMetadata({ title: `${siteConfig.name} Resources`, description: "Curated agribusiness resources, recommendations, and guides.", path: "/resources" }); }

export default async function ResourcesPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  if (!contentPublicConfig.hubEnabled) notFound();
  const params = await searchParams;
  const q = typeof params.q === "string" ? params.q : undefined;
  const data = await getContentIndexData({ q, format: "resource_guide" });
  const offers = data.posts.flatMap((post) => post.offers.map((offer) => ({ ...offer, post })));
  return (
    <PageShell><section className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8"><SectionHeader eyebrow="Resources" title="Curated farm tools, products, and practical references" body="Recommendations are editorial resources. Merchants control external prices, availability, checkout, and commission tracking." />
      <form className="mt-8 grid gap-3 rounded-lg bg-white p-4 shadow-sm md:grid-cols-[1fr_160px]"><input name="q" defaultValue={q ?? ""} placeholder="Search resources" className="h-12 rounded-lg border border-stone-200 px-4 text-sm" /><button className="rounded-full bg-green-800 px-4 text-sm font-bold text-white">Search</button></form>
      <div className="mt-8 grid gap-4 md:grid-cols-2 lg:grid-cols-3">{offers.length ? offers.map((item) => <article key={`${item.post.id}-${item.id}`} className="rounded-lg bg-white p-5 shadow-sm"><p className="text-xs font-bold uppercase tracking-[0.16em] text-amber-700">{item.partner?.name ?? "Partner"}</p><h2 className="mt-2 text-xl font-bold text-green-950">{item.title}</h2><p className="mt-2 text-sm leading-6 text-stone-700">{item.short_description}</p><p className="mt-3 text-xs text-stone-500">Basis: {item.recommendation_basis.replaceAll("_", " ")}. Price freshness: {item.price_last_checked_at ? new Date(item.price_last_checked_at).toLocaleDateString("en-NG") : "confirm with merchant"}.</p><Link href={`/blog/${item.post.slug}`} className="mt-4 inline-flex rounded-full border border-green-800 px-4 py-2 text-sm font-bold text-green-950">Read guide</Link></article>) : <div className="rounded-lg bg-white p-8 text-center shadow-sm md:col-span-2 lg:col-span-3"><h2 className="text-2xl font-bold text-green-950">No resources published yet</h2><p className="mt-2 text-stone-600">Add reviewed resources and affiliate recommendations from the protected admin.</p></div>}</div>
      <div className="mt-10"><ContentSubscribeForm sourcePath="/resources" /></div>
    </section></PageShell>
  );
}
