import Link from "next/link";
import { CheckCircle2, ShieldCheck, Truck, type LucideIcon } from "lucide-react";
import { HeroSlideshowPanel } from "@/src/components/home-hero-slideshow";
import { siteConfig } from "@/src/config/site";
import { PageShell, ProductCard, SectionHeader } from "@/src/components/ui";
import { categoryRank, getPublicProducts } from "@/src/lib/products";
import type { Product } from "@/src/types";

export const dynamic = "force-dynamic";

const trustFeatures: {
  title: string;
  body: string;
  Icon: LucideIcon;
}[] = [
  {
    title: "Farm-direct supply",
    body: `Order fresh produce, chicken and eggs directly from ${siteConfig.name} with clear product information and reliable fulfilment.`,
    Icon: CheckCircle2,
  },
  {
    title: "Produce for homes and businesses",
    body: "We serve households, food vendors, restaurants, caterers, resellers, and bulk buyers.",
    Icon: Truck,
  },
  {
    title: "Secure ordering",
    body: "Create an order, pay securely online, and track fulfilment with your order reference.",
    Icon: ShieldCheck,
  },
];

function heroSlideImages(featuredProducts: Product[], activeProducts: Product[]) {
  const images: Array<{ url: string; alt: string }> = [];
  const seen = new Set<string>();

  const addImage = (product: Product, url?: string | null, alt?: string | null) => {
    if (!url || seen.has(url) || images.length >= 5) return;
    seen.add(url);
    images.push({
      url,
      alt: alt || `${product.name} from ${siteConfig.name}`,
    });
  };

  for (const product of featuredProducts) {
    if (product.primaryMedia?.mediaType === "image") {
      addImage(product, product.primaryMedia.url, product.primaryMedia.altText);
    }
  }

  for (const product of featuredProducts) {
    for (const media of product.media ?? []) {
      if (media.mediaType === "image") addImage(product, media.url, media.altText);
    }
  }

  for (const product of activeProducts) {
    for (const media of product.media ?? []) {
      if (media.mediaType === "image") addImage(product, media.url, media.altText);
    }
  }

  return images;
}

export default async function Home() {
  const products = await getPublicProducts();
  const activeProducts = products.filter(
    (product) => product.status === "active",
  );
  const featuredProducts = activeProducts.filter(
    (product) => product.isFeatured,
  );
  const slideshowImages = heroSlideImages(featuredProducts, activeProducts);
  const homepageProducts = (
    featuredProducts.length > 0
      ? featuredProducts.sort(
          (a, b) =>
            (a.featuredSortOrder ?? 100) - (b.featuredSortOrder ?? 100) ||
            a.name.localeCompare(b.name),
        )
      : activeProducts.sort(
          (a, b) =>
            categoryRank(a.category) - categoryRank(b.category) ||
            a.name.localeCompare(b.name),
        )
  ).slice(0, 6);

  return (
    <PageShell>
      <section className="bg-[#f3ead8]">
        <div className="mx-auto grid max-w-7xl gap-10 px-4 py-14 sm:px-6 lg:grid-cols-[1.05fr_0.95fr] lg:px-8 lg:py-20">
          <div className="flex flex-col justify-center">
            <p className="text-sm font-bold uppercase tracking-[0.18em] text-green-700">
              {siteConfig.name}
            </p>
            <h1 className="mt-4 max-w-3xl text-4xl font-bold tracking-tight text-green-950 sm:text-6xl">
              Fresh crop produce, eggs, and chicken supplied with care.
            </h1>
            <p className="mt-5 max-w-2xl text-lg leading-8 text-stone-700">
              Order eggs, chicken, fresh vegetables, tubers, tomatoes,
              peppers, and selected farm inputs directly from {siteConfig.name}. We
              serve households, food vendors, restaurants, caterers, resellers,
              and bulk buyers with clear pricing, secure checkout, and reliable
              fulfilment.
            </p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <Link
                href="/shop"
                className="inline-flex h-12 items-center justify-center rounded-full bg-green-800 px-6 text-sm font-bold text-white transition hover:bg-green-900"
              >
                Shop farm produce
              </Link>
              <Link
                href="/track-order"
                className="inline-flex h-12 items-center justify-center rounded-full border border-green-800 px-6 text-sm font-bold text-green-950 transition hover:bg-white"
              >
                Track an order
              </Link>
            </div>
          </div>
          <HeroSlideshowPanel images={slideshowImages}>
            <div className="w-full max-w-sm">
              <div className="rounded-lg bg-white/[0.88] p-5 shadow-sm ring-1 ring-white/60 backdrop-blur-md">
                <p className="text-sm font-bold text-amber-700">
                  Today at farm gate
                </p>
                <p className="mt-3 text-4xl font-bold">Fresh crops</p>
                <p className="mt-2 text-sm text-stone-700">
                  Tomatoes, peppers, potatoes, onions, carrots, cabbage,
                  and other produce supplied by confirmed availability.
                </p>
              </div>
              <div className="mt-4 grid grid-cols-2 gap-4">
                <div className="rounded-lg bg-white/[0.84] p-4 shadow-sm ring-1 ring-white/55 backdrop-blur-md">
                  <p className="text-2xl font-bold">Broilers</p>
                  <p className="text-xs font-semibold text-stone-600">
                    4-week and table-size chicken available for scheduled
                    orders.
                  </p>
                </div>
                <div className="rounded-lg bg-white/[0.84] p-4 shadow-sm ring-1 ring-white/55 backdrop-blur-md">
                  <p className="text-2xl font-bold">Egg supply</p>
                  <p className="text-xs font-semibold text-stone-600">
                    Crates and half-crates for homes, vendors, bakeries, and
                    resellers.
                  </p>
                </div>
              </div>
            </div>
          </HeroSlideshowPanel>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-4 py-14 sm:px-6 lg:px-8">
        <div className="grid gap-4 md:grid-cols-3">
          {trustFeatures.map(({ title, body, Icon }) => (
            <div key={title} className="rounded-lg bg-white p-5 shadow-sm">
              <Icon className="text-green-800" size={24} />
              <h2 className="mt-4 text-lg font-bold text-green-950">{title}</h2>
              <p className="mt-2 text-sm leading-6 text-stone-600">{body}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-4 pb-16 sm:px-6 lg:px-8">
        <div className="mb-8 flex flex-col justify-between gap-4 md:flex-row md:items-end">
          <SectionHeader
            eyebrow="Shop"
            title="Popular Farm Produce"
            body={`${siteConfig.name} supplies eggs, broilers, tomatoes, peppers, potatoes, onions, carrots, cabbage, and other fresh produce based on confirmed availability, quantity, and logistics.`}
          />
          <Link href="/shop" className="font-bold text-green-800 hover:text-green-950">
            View all products
          </Link>
        </div>
        <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
          {homepageProducts.map((product) => (
            <ProductCard key={product.slug} product={product} />
          ))}
        </div>
        <div className="mt-8 rounded-lg bg-green-50 p-5 text-green-950">
          <h2 className="text-lg font-bold">Fresh crop produce supply</h2>
          <p className="mt-2 text-sm font-semibold leading-6 text-green-900">
            {siteConfig.name} supplies eggs, chicken, tomatoes, peppers, potatoes,
            onions, carrots, cabbage, and other fresh produce based on confirmed
            availability, quantity, and logistics.
          </p>
        </div>
      </section>
    </PageShell>
  );
}



