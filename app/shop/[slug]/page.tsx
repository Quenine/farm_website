import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { ProductDetailActions } from "@/src/components/product/product-detail-actions";
import { ProductGallery } from "@/src/components/product/product-gallery";
import { ProductMarketingActions } from "@/src/components/product/product-marketing-actions";
import { InfoRow, PageShell } from "@/src/components/ui";
import { formatNaira } from "@/src/lib/format";
import { getPublicProductBySlug } from "@/src/lib/products";
import type { Metadata } from "next";
import { siteConfig } from "@/src/config/site";
import {
  isProductOrderable,
  productAvailabilityMessage,
  productPriceLabel,
  productRequestUrl,
} from "@/src/lib/product-pricing";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const product = await getPublicProductBySlug(slug);
  if (!product) return {};
  const description = product.description.slice(0, 160);
  return {
    title: product.name + " | " + siteConfig.name,
    description,
    alternates: { canonical: siteConfig.url + "/shop/" + product.slug },
    robots: { index: product.status === "active", follow: true },
    openGraph: { title: product.name, description, images: product.primaryMedia?.url ? [{ url: product.primaryMedia.url, alt: product.primaryMedia.altText || product.name }] : [] },
  };
}

export default async function ProductDetailPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const product = await getPublicProductBySlug(slug);

  if (!product) {
    notFound();
  }
  const priceLabel = productPriceLabel(product);
  const isOrderable = isProductOrderable(product);
  const productJsonLd = {
    "@context": "https://schema.org",
    "@type": "Product",
    name: product.name,
    description: product.description,
    image: product.primaryMedia?.url ? [product.primaryMedia.url] : undefined,
    offers: product.pricingMode === "fixed" && product.price > 0 ? {
      "@type": "Offer",
      priceCurrency: "NGN",
      price: product.price,
      availability: product.stockCount > 0 ? "https://schema.org/InStock" : "https://schema.org/OutOfStock",
      url: siteConfig.url + "/shop/" + product.slug,
    } : undefined,
  };
  const breadcrumbJsonLd = { "@context": "https://schema.org", "@type": "BreadcrumbList", itemListElement: [
    { "@type": "ListItem", position: 1, name: "Shop", item: siteConfig.url + "/shop" },
    { "@type": "ListItem", position: 2, name: product.name, item: siteConfig.url + "/shop/" + product.slug },
  ] };

  return (
    <PageShell>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(productJsonLd).replaceAll("<", "\u003c") }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbJsonLd).replaceAll("<", "\u003c") }} />
      <section className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
        <Link
          href="/shop"
          className="inline-flex items-center gap-2 text-sm font-bold text-green-800"
        >
          <ArrowLeft size={16} />
          Back to shop
        </Link>
        <div className="mt-6 grid gap-8 lg:grid-cols-[0.9fr_1.1fr]">
          <ProductGallery product={product} />
          <div className="rounded-lg bg-white p-6 shadow-sm">
            <p className="text-sm font-bold uppercase tracking-[0.16em] text-green-700">
              {productAvailabilityMessage(product)}
            </p>
            <h2 className="mt-3 text-3xl font-bold text-green-950">
              {priceLabel ?? `${formatNaira(product.price)} per ${product.unit}`}
            </h2>
            <p className="mt-4 text-lg leading-8 text-stone-700">
              {product.description}
            </p>
            {isOrderable ? (
              <div className="mt-6 rounded-lg border border-amber-200 bg-amber-50 p-4">
                <p className="font-bold text-amber-900">Minimum order requirement</p>
                <p className="mt-2 text-sm leading-6 text-amber-900">
                  This product can only be added from {product.minimumOrder}{" "}
                  {product.minimumUnit} and above. Your cart enforces this
                  minimum and the currently available stock.
                </p>
              </div>
            ) : (
              <div className="mt-6 rounded-lg border border-green-200 bg-green-50 p-4 text-sm leading-6 text-green-900">
                <p><strong>Availability:</strong> Confirm before ordering</p>
                <p><strong>Delivery:</strong> Based on quantity and location</p>
              </div>
            )}
            <div className="mt-6 grid gap-3">
              {isOrderable ? (
                <>
                  <InfoRow label="Stock" value={product.stock} />
                  <InfoRow label="Unit" value={product.unit} />
                  <InfoRow
                    label="Minimum order"
                    value={`${product.minimumOrder} ${product.minimumUnit}`}
                  />
                </>
              ) : (
                <InfoRow label="Price" value={priceLabel ?? "Check Availability"} />
              )}
            </div>
            <ProductDetailActions product={product} />
            <ProductMarketingActions product={product} />
            <div className="mt-4">
              {isOrderable ? (
                <Link
                  href="/checkout"
                  className="inline-flex h-12 w-full items-center justify-center rounded-full border border-green-800 px-5 text-sm font-bold text-green-950 transition hover:bg-green-50"
                >
                  Continue to checkout
                </Link>
              ) : (
                <Link
                  href={productRequestUrl(product)}
                  target="_blank"
                  className="inline-flex h-12 w-full items-center justify-center rounded-full bg-green-800 px-5 text-sm font-bold text-white transition hover:bg-green-900"
                >
                  Request Availability
                </Link>
              )}
            </div>
          </div>
        </div>
      </section>
    </PageShell>
  );
}

