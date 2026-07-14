/* eslint-disable @next/next/no-img-element */
import Link from "next/link";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeSanitize from "rehype-sanitize";
import { ArrowRight, ExternalLink } from "lucide-react";
import { AffiliateRecommendation } from "@/src/components/content/affiliate-recommendation";
import { ContentSubscribeForm } from "@/src/components/content/subscribe-form";
import { siteConfig, siteContact } from "@/src/config/site";
import type { AffiliateOffer, ContentPost } from "@/src/lib/content";
import { readingMinutes } from "@/src/lib/content";
import { formatNaira } from "@/src/lib/format";

const tokenPattern = /^\[\[(affiliate|product|comparison|video|sources|newsletter|callout|tool):?([^\]]*)\]\]$/;

function MarkdownChunk({ value }: { value: string }) {
  return (
    <ReactMarkdown
      remarkPlugins={[remarkGfm]}
      rehypePlugins={[rehypeSanitize]}
      allowedElements={["p", "strong", "em", "a", "ul", "ol", "li", "blockquote", "code", "pre", "h2", "h3", "h4", "table", "thead", "tbody", "tr", "th", "td", "hr", "br", "img"]}
      urlTransform={(url) => {
        const trimmed = url.trim();
        if (/^(https?:|mailto:|tel:|\/)/i.test(trimmed)) return trimmed;
        return "";
      }}
      components={{
        a: ({ href, children }) => (
          <a href={href} rel="nofollow noopener noreferrer" target={href?.startsWith("http") ? "_blank" : undefined} className="font-bold text-green-800 underline underline-offset-4">
            {children}
          </a>
        ),
        img: ({ src, alt, title }) => {
          const imageSrc = typeof src === "string" && /^(https?:|\/)/i.test(src.trim()) ? src.trim() : "";
          if (!imageSrc) return null;
          return (
            <figure className="my-8">
              <img src={imageSrc} alt={alt || ""} loading="lazy" decoding="async" className="max-h-[620px] w-full rounded-lg object-contain" />
              {title ? <figcaption className="mt-2 text-center text-sm text-stone-500">{title}</figcaption> : null}
            </figure>
          );
        },
        h2: ({ children }) => <h2 className="mt-10 text-2xl font-bold text-green-950">{children}</h2>,
        h3: ({ children }) => <h3 className="mt-8 text-xl font-bold text-green-950">{children}</h3>,
        p: ({ children }) => <p className="leading-8 text-stone-700">{children}</p>,
        ul: ({ children }) => <ul className="ml-5 list-disc space-y-2 text-stone-700">{children}</ul>,
        ol: ({ children }) => <ol className="ml-5 list-decimal space-y-2 text-stone-700">{children}</ol>,
        blockquote: ({ children }) => <blockquote className="border-l-4 border-green-700 bg-green-50 p-4 text-green-950">{children}</blockquote>,
        table: ({ children }) => <div className="overflow-x-auto"><table className="min-w-full border-collapse text-sm">{children}</table></div>,
        th: ({ children }) => <th className="border border-stone-200 bg-stone-100 px-3 py-2 text-left font-bold">{children}</th>,
        td: ({ children }) => <td className="border border-stone-200 px-3 py-2 align-top">{children}</td>,
      }}
    >
      {value}
    </ReactMarkdown>
  );
}

export function AffiliateDisclosure({ post }: { post?: ContentPost }) {
  const custom = post?.custom_affiliate_disclosure?.trim();
  return (
    <div className="rounded-md border border-amber-200 bg-amber-50 px-4 py-3 text-sm leading-6 text-amber-950">
      <p>
        <Link href="/affiliate-disclosure" className="font-bold underline underline-offset-4">Disclosure</Link>: This article may contain{" "}
        <Link href="/affiliate-disclosure" className="font-bold underline underline-offset-4">affiliate links</Link>. {siteConfig.name} may earn a commission at no additional cost to you.
      </p>
      {custom ? <p className="mt-1 text-amber-900">{custom}</p> : null}
    </div>
  );
}

function OfferCard({ offer, post }: { offer: AffiliateOffer; post: ContentPost }) {
  return <AffiliateRecommendation offer={offer} postSlug={post.slug} />;
}

function ProductBlock({ slug, post }: { slug: string; post: ContentPost }) {
  const product = post.products.find((item) => item.slug === slug);
  if (!product) return <MissingToken label={`product:${slug}`} />;
  return (
    <article className="rounded-lg border border-green-900/10 bg-green-50 p-5">
      <p className="text-xs font-bold uppercase tracking-[0.16em] text-green-700">Related {siteConfig.name} product</p>
      <h3 className="mt-2 text-xl font-bold text-green-950">{product.name}</h3>
      <p className="mt-2 text-sm leading-6 text-stone-700">{product.description}</p>
      <div className="mt-4 flex flex-wrap items-center gap-3">
        <span className="text-sm font-bold text-green-950">{formatNaira(product.price)} / {product.unit}</span>
        <Link href={`/content-product/${post.slug}/${product.slug}`} className="inline-flex h-10 items-center gap-2 rounded-full bg-green-800 px-4 text-sm font-bold text-white hover:bg-green-900">
          View product <ArrowRight size={16} />
        </Link>
      </div>
    </article>
  );
}

function ComparisonBlock({ post }: { post: ContentPost }) {
  if (!post.offers.length) return <MissingToken label="comparison:post-offers" />;
  return (
    <div className="overflow-x-auto rounded-lg border border-stone-200 bg-white">
      <table className="min-w-[760px] w-full text-sm">
        <thead className="bg-green-950 text-white"><tr><th className="px-4 py-3 text-left">Offer</th><th className="px-4 py-3 text-left">Best for</th><th className="px-4 py-3 text-left">Basis</th><th className="px-4 py-3 text-left">Verdict</th><th className="px-4 py-3 text-left">Action</th></tr></thead>
        <tbody className="divide-y divide-stone-100">
          {post.offers.map((offer) => (
            <tr key={offer.id}>
              <td className="px-4 py-3 font-bold text-green-950">{offer.title}</td>
              <td className="px-4 py-3">{offer.best_for ?? "Review merchant details"}</td>
              <td className="px-4 py-3 capitalize">{offer.recommendation_basis.replaceAll("_", " ")}</td>
              <td className="px-4 py-3">{offer.editorial_verdict ?? "No fabricated rating or score."}</td>
              <td className="px-4 py-3"><Link href={`/recommend/${offer.slug}?post=${encodeURIComponent(post.slug)}`} target="_blank" rel="sponsored nofollow noopener noreferrer" className="inline-flex items-center gap-1 font-bold text-green-800 underline">Check current price <ExternalLink size={14} aria-hidden /><span className="sr-only">External merchant link</span></Link></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function VideoBlock({ post }: { post: ContentPost }) {
  if (!post.video) return <MissingToken label="video:post-video" />;
  const src = post.video.embed_url;
  return (
    <section className="rounded-lg bg-stone-950 p-4 text-white">
      <h3 className="text-xl font-bold">{post.video.title}</h3>
      {src ? <iframe className="mt-4 aspect-video w-full rounded-lg" src={src} title={post.video.title} loading="lazy" allow="accelerometer; encrypted-media; gyroscope; picture-in-picture" allowFullScreen /> : null}
      {post.video.description ? <p className="mt-3 text-sm leading-6 text-stone-200">{post.video.description}</p> : null}
    </section>
  );
}

function SourcesBlock({ post }: { post: ContentPost }) {
  if (!post.sources.length) return <MissingToken label="sources" />;
  return (
    <section className="rounded-lg bg-white p-5 shadow-sm">
      <h3 className="text-xl font-bold text-green-950">Sources and references</h3>
      <ol className="mt-3 ml-5 list-decimal space-y-2 text-sm leading-6 text-stone-700">
        {post.sources.map((source) => (
          <li key={source.id}><a href={source.url} rel="nofollow noopener noreferrer" target="_blank" className="font-bold text-green-800 underline">{source.citation_label || source.title}</a>{source.publisher ? ` - ${source.publisher}` : ""}</li>
        ))}
      </ol>
    </section>
  );
}

function NewsletterBlock() {
  return <ContentSubscribeForm sourcePath="content" compact />;
}

function BusinessSupplyCallout() {
  return (
    <div className="rounded-lg bg-green-950 p-5 text-white">
      <h3 className="text-xl font-bold">Need regular farm supply?</h3>
      <p className="mt-2 text-sm leading-6 text-green-100">Talk to {siteConfig.name} about recurring poultry, eggs, produce, or farm input supply.</p>
      <Link href="/business-supply" className="mt-4 inline-flex rounded-full bg-white px-4 py-2 text-sm font-bold text-green-950">Business Supply</Link>
    </div>
  );
}

function ToolLink({ slug }: { slug: string }) {
  const labels: Record<string, string> = {
    "poultry-feed-requirement": "Poultry Feed Requirement Estimator",
    "egg-sales-margin": "Egg Sales Margin Calculator",
  };
  return (
    <div className="rounded-lg border border-green-900/10 bg-white p-5 shadow-sm">
      <h3 className="text-xl font-bold text-green-950">{labels[slug] ?? "Farm tool"}</h3>
      <Link href={`/tools#${slug}`} className="mt-3 inline-flex items-center gap-2 rounded-full bg-green-800 px-4 py-2 text-sm font-bold text-white">Open tool <ArrowRight size={16} /></Link>
    </div>
  );
}

function MissingToken({ label }: { label: string }) {
  return <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm font-semibold text-amber-900">Content block unavailable: {label}</div>;
}

function TokenBlock({ line, post }: { line: string; post: ContentPost }) {
  const match = line.match(tokenPattern);
  if (!match) return null;
  const [, type, rawValue] = match;
  const value = rawValue.trim();
  if (type === "affiliate") {
    const offer = post.offers.find((item) => item.slug === value);
    return offer ? <OfferCard offer={offer} post={post} /> : <MissingToken label={`affiliate:${value}`} />;
  }
  if (type === "product") return <ProductBlock slug={value} post={post} />;
  if (type === "comparison") return <ComparisonBlock post={post} />;
  if (type === "video") return <VideoBlock post={post} />;
  if (type === "sources") return <SourcesBlock post={post} />;
  if (type === "newsletter") return <NewsletterBlock />;
  if (type === "callout" && value === "business-supply") return <BusinessSupplyCallout />;
  if (type === "tool") return <ToolLink slug={value} />;
  return <MissingToken label={`${type}:${value}`} />;
}

export function SafeContentMarkdown({ post }: { post: ContentPost }) {
  const blocks: Array<{ type: "markdown" | "token"; value: string }> = [];
  let chunk: string[] = [];
  for (const line of post.content_markdown.split(/\r?\n/)) {
    if (tokenPattern.test(line.trim())) {
      if (chunk.join("\n").trim()) blocks.push({ type: "markdown", value: chunk.join("\n") });
      chunk = [];
      blocks.push({ type: "token", value: line.trim() });
    } else {
      chunk.push(line);
    }
  }
  if (chunk.join("\n").trim()) blocks.push({ type: "markdown", value: chunk.join("\n") });

  return <div className="space-y-6">{blocks.map((block, index) => block.type === "markdown" ? <MarkdownChunk key={index} value={block.value} /> : <TokenBlock key={index} line={block.value} post={post} />)}</div>;
}

export function ArticleMeta({ post }: { post: ContentPost }) {
  return (
    <div className="flex flex-wrap gap-3 text-sm text-stone-600">
      {post.author ? <span>By <strong>{post.author.name}</strong>{post.author.role_title ? `, ${post.author.role_title}` : ""}</span> : null}
      {post.published_at ? <span>Published {new Date(post.published_at).toLocaleDateString("en-NG")}</span> : null}
      <span>Updated {new Date(post.updated_at).toLocaleDateString("en-NG")}</span>
      <span>{readingMinutes(post.content_markdown)} min read</span>
    </div>
  );
}

export function WhatsAppContentCta({ title }: { title: string }) {
  const href = `${siteContact.whatsappHref}?text=${encodeURIComponent(`I have a question about ${title}`)}`;
  return <a href={href} target="_blank" rel="noreferrer" className="inline-flex rounded-full border border-green-800 px-5 py-3 text-sm font-bold text-green-950">Ask on WhatsApp</a>;
}

