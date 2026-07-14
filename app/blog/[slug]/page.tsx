/* eslint-disable @next/next/no-img-element */
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArticleShare } from "@/src/components/content/article-share";
import { AffiliateDisclosure, ArticleMeta, SafeContentMarkdown, WhatsAppContentCta } from "@/src/components/content/content-renderer";
import { ContentSubscribeForm } from "@/src/components/content/subscribe-form";
import { PageShell } from "@/src/components/ui";
import { contentPublicConfig, siteConfig } from "@/src/config/site";
import { getPublishedPostBySlug } from "@/src/lib/content";
import { contentMetadata } from "@/src/lib/content-config";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const post = contentPublicConfig.hubEnabled ? await getPublishedPostBySlug(slug) : null;
  if (!post) return contentMetadata({ title: "Article", description: siteConfig.description, path: `/blog/${slug}` });
  return contentMetadata({ title: post.seo_title || post.title, description: post.seo_description || post.excerpt, path: `/blog/${post.slug}`, image: post.featured_image_url });
}

export default async function ArticlePage({ params }: { params: Promise<{ slug: string }> }) {
  if (!contentPublicConfig.hubEnabled) notFound();
  const { slug } = await params;
  const post = await getPublishedPostBySlug(slug);
  if (!post) notFound();
  const hasAffiliate = post.contains_affiliate_content || post.offers.length > 0;
  const articleJsonLd = {
    "@context": "https://schema.org",
    "@type": "BlogPosting",
    headline: post.title,
    description: post.excerpt,
    datePublished: post.published_at,
    dateModified: post.updated_at,
    author: post.author ? { "@type": "Person", name: post.author.name, description: post.author.credentials_or_experience ?? post.author.bio ?? undefined } : undefined,
    publisher: { "@type": "Organization", name: siteConfig.name, url: siteConfig.url },
    image: post.featured_image_url || siteConfig.logoPath,
    mainEntityOfPage: `${siteConfig.url.replace(/\/$/, "")}/blog/${post.slug}`,
  };
  const breadcrumbJsonLd = { "@context": "https://schema.org", "@type": "BreadcrumbList", itemListElement: [{ "@type": "ListItem", position: 1, name: "Blog", item: `${siteConfig.url}/blog` }, { "@type": "ListItem", position: 2, name: post.title, item: `${siteConfig.url}/blog/${post.slug}` }] };
  const videoJsonLd = post.video && post.video.thumbnail_url && post.video.upload_date ? { "@context": "https://schema.org", "@type": "VideoObject", name: post.video.title, description: post.video.description || post.excerpt, thumbnailUrl: [post.video.thumbnail_url], uploadDate: post.video.upload_date, duration: post.video.duration_seconds ? `PT${post.video.duration_seconds}S` : undefined, embedUrl: post.video.embed_url ?? undefined, contentUrl: post.video.watch_url ?? undefined } : null;

  return (
    <PageShell>
      <article className="mx-auto max-w-4xl px-4 py-12 sm:px-6 lg:px-8">
        <Link href="/blog" className="text-sm font-bold text-green-800">Back to blog</Link>
        <p className="mt-6 text-sm font-bold uppercase tracking-[0.18em] text-green-700">{post.category?.name ?? post.content_format.replaceAll("_", " ")}</p>
        <h1 className="mt-3 text-4xl font-bold tracking-tight text-green-950 sm:text-5xl">{post.title}</h1>
        <p className="mt-5 text-xl leading-8 text-stone-700">{post.excerpt}</p>
        <div className="mt-5"><ArticleMeta post={post} /></div>
        {post.featured_image_url ? <img src={post.featured_image_url} alt={post.featured_image_alt || post.title} className="mt-8 aspect-video w-full rounded-lg object-cover" /> : null}
        <div className="mt-8 grid gap-4">
          {post.answer_summary ? <section className="rounded-lg bg-green-50 p-5"><h2 className="text-xl font-bold text-green-950">Answer summary</h2><p className="mt-2 leading-7 text-green-950">{post.answer_summary}</p></section> : null}
          {post.key_takeaways?.length ? <section className="rounded-lg bg-white p-5 shadow-sm"><h2 className="text-xl font-bold text-green-950">Key takeaways</h2><ul className="mt-3 ml-5 list-disc space-y-2 text-stone-700">{post.key_takeaways.map((item) => <li key={item}>{item}</li>)}</ul></section> : null}
          {hasAffiliate ? <AffiliateDisclosure post={post} /> : null}
          {post.recommendation_methodology ? <section className="rounded-lg border border-green-900/10 bg-white p-5"><h2 className="text-xl font-bold text-green-950">Recommendation methodology</h2><p className="mt-2 text-sm leading-6 text-stone-700">{post.recommendation_methodology}</p></section> : null}
        </div>
        <div className="mt-8"><SafeContentMarkdown post={post} /></div>
        {post.author ? <section className="mt-10 rounded-lg bg-white p-5 shadow-sm"><h2 className="text-xl font-bold text-green-950">About the author</h2><p className="mt-2 font-bold text-stone-900">{post.author.name}</p>{post.author.credentials_or_experience || post.author.bio ? <p className="mt-2 text-sm leading-6 text-stone-700">{post.author.credentials_or_experience ?? post.author.bio}</p> : null}</section> : null}
        <div className="mt-8 flex flex-wrap gap-3"><WhatsAppContentCta title={post.title} /><ArticleShare title={post.title} text={post.excerpt} slug={post.slug} canonicalUrl={`${siteConfig.url.replace(/\/$/, "")}/blog/${post.slug}`} /><Link href="/shop" className="rounded-full bg-green-800 px-5 py-3 text-sm font-bold text-white">Shop {siteConfig.name}</Link></div>
        <div className="mt-10"><ContentSubscribeForm sourcePath={`/blog/${post.slug}`} /></div>
      </article>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(articleJsonLd) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbJsonLd) }} />
      {videoJsonLd ? <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(videoJsonLd) }} /> : null}
    </PageShell>
  );
}
