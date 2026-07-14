import Link from "next/link";
import { notFound } from "next/navigation";
import { Search, X } from "lucide-react";
import { ContentSubscribeForm } from "@/src/components/content/subscribe-form";
import { BlogCardImage } from "@/src/components/content/blog-card-image";
import { PageShell, SectionHeader } from "@/src/components/ui";
import { contentPublicConfig, siteConfig } from "@/src/config/site";
import { contentMetadata } from "@/src/lib/content-config";
import {
  getContentIndexData,
  type ContentListFilters,
} from "@/src/lib/content";

export const dynamic = "force-dynamic";

export async function generateMetadata() {
  return contentMetadata({
    title: `${siteConfig.name} Agribusiness Blog`,
    description: `Practical farming, poultry, crop production, tools, and agribusiness guides for ${contentPublicConfig.primaryMarket}.`,
    path: "/blog",
  });
}

function filterLink(label: string, href: string, active?: boolean) {
  return (
    <Link
      href={href}
      className={`rounded-full px-4 py-2 text-sm font-bold ${active ? "bg-green-800 text-white" : "bg-white text-green-900 ring-1 ring-green-900/10"}`}
    >
      {label}
    </Link>
  );
}

export default async function BlogPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  if (!contentPublicConfig.hubEnabled) notFound();
  const params = await searchParams;
  const filters: ContentListFilters = {
    q: typeof params.q === "string" ? params.q : undefined,
    category: typeof params.category === "string" ? params.category : undefined,
    tag: typeof params.tag === "string" ? params.tag : undefined,
    format: typeof params.format === "string" ? params.format : undefined,
    audience: typeof params.audience === "string" ? params.audience : undefined,
    page: typeof params.page === "string" ? Number(params.page) : 1,
  };
  const data = await getContentIndexData(filters);
  const totalPages = Math.max(1, Math.ceil(data.total / data.pageSize));
  const featuredIds = new Set(data.featured.map((post) => post.id));
  const regularPosts = data.featured.length
    ? data.posts.filter((post) => !featuredIds.has(post.id))
    : data.posts;
  const pageHref = (page: number) => {
    const query = new URLSearchParams();
    if (filters.q) query.set("q", filters.q);
    if (filters.category) query.set("category", filters.category);
    if (filters.tag) query.set("tag", filters.tag);
    if (filters.format) query.set("format", filters.format);
    if (filters.audience) query.set("audience", filters.audience);
    query.set("page", String(page));
    return `/blog?${query.toString()}`;
  };

  return (
    <PageShell>
      <section className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
        <SectionHeader
          eyebrow="Agribusiness content"
          title="Practical farm guides, resources, and buying research"
          body={`Built for ${contentPublicConfig.primaryMarket}, with useful context for ${contentPublicConfig.secondaryMarket}.`}
        />
        <div className="mt-6 flex flex-wrap gap-3">
          <Link
            href="/resources"
            className="rounded-full bg-green-800 px-5 py-3 text-sm font-bold text-white"
          >
            Resources
          </Link>
          <Link
            href="/videos"
            className="rounded-full border border-green-800 px-5 py-3 text-sm font-bold text-green-950"
          >
            Videos
          </Link>
          <Link
            href="/tools"
            className="rounded-full border border-green-800 px-5 py-3 text-sm font-bold text-green-950"
          >
            Tools
          </Link>
          <Link
            href="/shop"
            className="rounded-full border border-green-800 px-5 py-3 text-sm font-bold text-green-950"
          >
            Shop {siteConfig.name}
          </Link>
        </div>
        <form className="mt-8 grid gap-3 rounded-lg bg-white p-4 shadow-sm md:grid-cols-[1fr_180px_180px_120px]">
          <label className="relative">
            <span className="sr-only">Search content</span>
            <Search
              className="absolute left-3 top-3.5 text-stone-400"
              size={18}
            />
            <input
              name="q"
              defaultValue={filters.q ?? ""}
              placeholder="Search guides, products, topics"
              className="h-12 w-full rounded-lg border border-stone-200 pl-10 pr-3 text-sm"
            />
          </label>
          <select
            name="format"
            defaultValue={filters.format ?? ""}
            className="h-12 rounded-lg border border-stone-200 px-3 text-sm"
          >
            <option value="">All formats</option>
            <option value="article">Articles</option>
            <option value="video_companion">Videos</option>
            <option value="comparison">Comparisons</option>
            <option value="resource_guide">Resources</option>
            <option value="case_study">Case studies</option>
          </select>
          <select
            name="audience"
            defaultValue={filters.audience ?? ""}
            className="h-12 rounded-lg border border-stone-200 px-3 text-sm"
          >
            <option value="">All audiences</option>
            <option value="nigeria">Nigeria</option>
            <option value="africa">Africa</option>
            <option value="global">Global</option>
          </select>
          <button className="h-12 rounded-full bg-green-800 px-4 text-sm font-bold text-white">
            Filter
          </button>
        </form>
        <div className="mt-5 flex flex-wrap gap-2">
          {filterLink("All", "/blog", !filters.category && !filters.tag)}
          {data.categories.map((category) =>
            filterLink(
              category.name,
              `/blog?category=${category.slug}`,
              filters.category === category.slug,
            ),
          )}
          {filters.q ||
          filters.category ||
          filters.tag ||
          filters.format ||
          filters.audience ? (
            <Link
              href="/blog"
              className="inline-flex items-center gap-2 rounded-full bg-stone-200 px-4 py-2 text-sm font-bold text-stone-800"
            >
              <X size={16} /> Clear filters
            </Link>
          ) : null}
        </div>
        <p className="mt-6 text-sm font-semibold text-stone-600">
          {data.total} result{data.total === 1 ? "" : "s"}
        </p>
        {data.featured.length ? (
          <div className="mt-6 grid gap-4 lg:grid-cols-3">
            {data.featured.map((post, index) => (
              <PostCard key={post.id} post={post} eagerImage={index === 0} />
            ))}
          </div>
        ) : null}
        {regularPosts.length ? (
          <div className="mt-8 grid grid-cols-1 gap-5 md:grid-cols-2 lg:grid-cols-3">
            {regularPosts.map((post) => (
              <PostCard key={post.id} post={post} />
            ))}
          </div>
        ) : data.featured.length ? null : (
          <div className="mt-8 rounded-lg bg-white p-8 text-center shadow-sm">
            <h2 className="text-2xl font-bold text-green-950">
              Agribusiness guides are being prepared
            </h2>
            <p className="mt-2 text-stone-600">
              Agribusiness guides, practical farming resources and product
              recommendations are being prepared. Check back soon.
            </p>
            <div className="mt-5 flex flex-wrap justify-center gap-3">
              <Link
                href="/tools"
                className="rounded-full border border-green-800 px-4 py-2 text-sm font-bold text-green-950"
              >
                Open Tools
              </Link>
              <Link
                href="/resources"
                className="rounded-full border border-green-800 px-4 py-2 text-sm font-bold text-green-950"
              >
                View Resources
              </Link>
              <Link
                href="/shop"
                className="rounded-full bg-green-800 px-4 py-2 text-sm font-bold text-white"
              >
                Shop Products
              </Link>
            </div>
          </div>
        )}
        {totalPages > 1 ? (
          <div className="mt-8 flex gap-3">
            {data.page > 1 ? (
              <Link
                href={pageHref(data.page - 1)}
                className="rounded-full border border-green-800 px-4 py-2 text-sm font-bold text-green-950"
              >
                Previous
              </Link>
            ) : null}
            {data.page < totalPages ? (
              <Link
                href={pageHref(data.page + 1)}
                className="rounded-full border border-green-800 px-4 py-2 text-sm font-bold text-green-950"
              >
                Next
              </Link>
            ) : null}
          </div>
        ) : null}
        <div className="mt-10">
          <ContentSubscribeForm sourcePath="/blog" />
        </div>
      </section>
    </PageShell>
  );
}

function PostCard({
  post,
  eagerImage = false,
}: {
  post: Awaited<ReturnType<typeof getContentIndexData>>["posts"][number];
  eagerImage?: boolean;
}) {
  const formatLabel = post.content_format.replaceAll("_", " ");
  const mediaLabel = post.category?.name || formatLabel;
  return (
    <article className="group relative flex h-full flex-col overflow-hidden rounded-xl border border-green-950/10 bg-white shadow-sm transition duration-200 hover:-translate-y-0.5 hover:shadow-md focus-within:ring-2 focus-within:ring-green-700 focus-within:ring-offset-2">
      <BlogCardImage
        src={post.featured_image_url}
        alt={post.featured_image_alt?.trim() || post.title}
        label={mediaLabel}
        eager={eagerImage}
      />
      <div className="flex flex-1 flex-col p-5">
        <p className="text-xs font-bold uppercase tracking-[0.16em] text-amber-700">
          {post.is_featured ? "Featured" : formatLabel}
        </p>
        <h2 className="mt-2 text-xl font-bold leading-snug text-green-950">
          {post.title}
        </h2>
        <p className="mt-2 line-clamp-3 text-sm leading-6 text-stone-700">
          {post.excerpt}
        </p>
        <Link
          href={`/blog/${post.slug}`}
          aria-label={`Read ${post.title}`}
          className="absolute inset-0 z-10 rounded-xl focus:outline-none"
        >
          <span className="sr-only">Read {post.title}</span>
        </Link>
        <div className="relative z-20 mt-auto flex flex-wrap items-center gap-x-2 gap-y-1 pt-5 text-xs font-bold text-green-800">
          {post.category ? (
            <Link
              className="rounded-sm hover:underline focus:outline-none focus:ring-2 focus:ring-green-700"
              href={`/blog/category/${post.category.slug}`}
            >
              {post.category.name}
            </Link>
          ) : null}
          {post.category && post.tags.length ? (
            <span aria-hidden="true" className="text-stone-400">·</span>
          ) : null}
          {post.tags.slice(0, 3).map((tag) => (
            <Link
              className="rounded-sm hover:underline focus:outline-none focus:ring-2 focus:ring-green-700"
              key={tag.id}
              href={`/blog/tag/${tag.slug}`}
            >
              #{tag.name}
            </Link>
          ))}
        </div>
      </div>
    </article>
  );
}
