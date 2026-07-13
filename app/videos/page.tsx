/* eslint-disable @next/next/no-img-element */
import Link from "next/link";
import { notFound } from "next/navigation";
import { PageShell, SectionHeader } from "@/src/components/ui";
import { contentPublicConfig, siteConfig } from "@/src/config/site";
import { getContentIndexData } from "@/src/lib/content";
import { contentMetadata } from "@/src/lib/content-config";

export const dynamic = "force-dynamic";
export async function generateMetadata() { return contentMetadata({ title: `${siteConfig.name} Videos`, description: "Video companion guides for farming, poultry, crops, tools, and agribusiness.", path: "/videos" }); }

export default async function VideosPage() {
  if (!contentPublicConfig.hubEnabled) notFound();
  const data = await getContentIndexData({ format: "video_companion" });
  return <PageShell><section className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8"><SectionHeader eyebrow="Videos" title="Video companion guides" body="Watch practical farming videos with written summaries, sources, transcripts, related tools, and product links." />
    <div className="mt-8 grid gap-4 md:grid-cols-2 lg:grid-cols-3">{data.posts.length ? data.posts.map((post) => <article key={post.id} className="rounded-lg bg-white p-5 shadow-sm">{post.video?.thumbnail_url ? <img src={post.video.thumbnail_url} alt={post.video.thumbnail_alt || post.title} loading="lazy" className="aspect-video w-full rounded-lg object-cover" /> : <div className="aspect-video rounded-lg bg-green-50" />}<h2 className="mt-4 text-xl font-bold text-green-950">{post.title}</h2><p className="mt-2 text-sm leading-6 text-stone-700">{post.excerpt}</p><Link href={`/blog/${post.slug}`} className="mt-4 inline-flex rounded-full bg-green-800 px-4 py-2 text-sm font-bold text-white">Open companion page</Link></article>) : <div className="rounded-lg bg-white p-8 text-center shadow-sm md:col-span-2 lg:col-span-3"><h2 className="text-2xl font-bold text-green-950">No videos published yet</h2><p className="mt-2 text-stone-600">Published video companion posts will appear here. Videos never autoplay.</p></div>}</div>
  </section></PageShell>;
}
