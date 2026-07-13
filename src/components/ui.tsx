/* eslint-disable @next/next/no-img-element */
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { CartLink } from "@/src/components/cart/cart-link";
import { CookiePreferencesLink } from "@/src/components/marketing-runtime";
import { AddToCartButton } from "@/src/components/product/add-to-cart-button";
import { ProductMediaThumbnail } from "@/src/components/product/product-media";
import { contentPublicConfig, siteConfig, siteContact } from "@/src/config/site";
import { formatNaira } from "@/src/lib/format";
import {
  isProductOrderable,
  productPriceLabel,
  productRequestUrl,
} from "@/src/lib/product-pricing";
import type { Product } from "@/src/types";

export function PublicHeader() {
  return (
    <header className="sticky top-0 z-20 border-b border-green-900/10 bg-[#fbf7ed]/95 backdrop-blur">
      <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-4 sm:px-6 lg:px-8">
        <Link href="/" className="flex items-center gap-3">
          <span className="grid size-11 place-items-center overflow-hidden rounded-full bg-white shadow-sm ring-1 ring-green-900/10">
            <img
              src={siteConfig.logoPath}
              alt={`${siteConfig.name} logo`}
              className="h-9 w-9 object-contain"
            />
          </span>
          <span>
            <span className="block text-lg font-bold leading-5 text-green-950">
              {siteConfig.name}
            </span>
            <span className="text-xs font-medium text-stone-600">
              {siteConfig.tagline}
            </span>
          </span>
        </Link>
        <nav className="hidden items-center gap-6 text-sm font-semibold text-stone-700 md:flex">
          <Link href="/shop" className="hover:text-green-800">
            Shop
          </Link>
          <Link href="/about" className="hover:text-green-800">
            About
          </Link>
          <Link href="/contact" className="hover:text-green-800">
            Contact
          </Link>
          <Link href="/track-order" className="hover:text-green-800">
            Track order
          </Link>
        </nav>
        <CartLink />
      </div>
    </header>
  );
}

export function Footer() {
  return (
    <footer className="border-t border-green-900/10 bg-green-950 text-green-50">
      <div className="mx-auto grid max-w-7xl gap-8 px-4 py-10 sm:px-6 md:grid-cols-3 lg:px-8">
        <div>
          <div className="flex items-center gap-3">
            <span className="grid size-12 place-items-center overflow-hidden rounded-full bg-white">
              <img
                src={siteConfig.logoPath}
                alt={`${siteConfig.name} logo`}
                className="h-10 w-10 object-contain"
              />
            </span>
            <p className="text-lg font-bold">{siteConfig.name}</p>
          </div>
          <p className="mt-3 text-sm leading-6 text-green-100">
            {siteConfig.name} supplies poultry, eggs, fresh crop produce, and selected
            farm inputs with clear pricing and reliable fulfilment.
          </p>
        </div>
        <div>
          <p className="font-semibold">Support</p>
          <div className="mt-2 grid gap-1 text-sm leading-6 text-green-100">
            <Link href="/business-supply" className="hover:text-white">Business Supply</Link>
            {contentPublicConfig.hubEnabled ? <Link href="/blog" className="hover:text-white">Blog</Link> : null}
            {contentPublicConfig.hubEnabled ? <Link href="/resources" className="hover:text-white">Resources</Link> : null}
            {contentPublicConfig.toolsEnabled ? <Link href="/tools" className="hover:text-white">Tools</Link> : null}
            {contentPublicConfig.affiliateEnabled ? <Link href="/affiliate-disclosure" className="hover:text-white">Affiliate Disclosure</Link> : null}
            {contentPublicConfig.hubEnabled ? <Link href="/editorial-policy" className="hover:text-white">Editorial Policy</Link> : null}
            <Link href="/delivery" className="hover:text-white">Delivery information</Link>
            <Link href="/refund-policy" className="hover:text-white">Refund & cancellation</Link>
            <Link href="/privacy-policy" className="hover:text-white">Privacy policy</Link>
            <Link href="/terms" className="hover:text-white">Terms of use</Link>
            <CookiePreferencesLink />
          </div>
        </div>
        <div>
          <p className="font-semibold">Contact</p>
          <div className="mt-2 grid gap-1 text-sm leading-6 text-green-100">
            <p>{siteConfig.address}</p>
            <a href={siteContact.phoneHref} className="hover:text-white">{siteConfig.phone}</a>
            <a href={siteContact.emailHref} className="hover:text-white">{siteConfig.email}</a>
            <a href={siteConfig.url} className="hover:text-white">{siteConfig.domain}</a>
          </div>
        </div>
      </div>
    </footer>
  );
}

export function PageShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col">
      <PublicHeader />
      <main className="flex-1">{children}</main>
      <Footer />
    </div>
  );
}

export function SectionHeader({
  eyebrow,
  title,
  body,
}: {
  eyebrow?: string;
  title: string;
  body?: string;
}) {
  return (
    <div className="max-w-3xl">
      {eyebrow ? (
        <p className="text-sm font-bold uppercase tracking-[0.18em] text-green-700">
          {eyebrow}
        </p>
      ) : null}
      <h1 className="mt-3 text-3xl font-bold tracking-tight text-green-950 sm:text-5xl">
        {title}
      </h1>
      {body ? <p className="mt-4 text-lg leading-8 text-stone-700">{body}</p> : null}
    </div>
  );
}

export function ProductCard({ product }: { product: Product }) {
  const priceLabel = productPriceLabel(product);
  const isOrderable = isProductOrderable(product);

  return (
    <article className="flex h-full flex-col rounded-lg border border-green-900/10 bg-white p-5 shadow-sm">
      <div className="mb-5 aspect-[4/3] overflow-hidden rounded-lg bg-[linear-gradient(135deg,#ecfccb,#fef3c7)] text-green-950">
        <ProductMediaThumbnail product={product} />
      </div>
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.16em] text-amber-700">
            {product.category}
          </p>
          <h2 className="mt-2 text-xl font-bold text-green-950">{product.name}</h2>
        </div>
        <span className="rounded-full bg-lime-100 px-3 py-1 text-xs font-bold text-green-800">
          {product.badge}
        </span>
      </div>
      <p className="mt-4 text-sm leading-6 text-stone-600">{product.description}</p>
      <div className="mt-5 grid gap-3 text-sm text-stone-700">
        <InfoRow
          label="Price"
          value={priceLabel ?? `${formatNaira(product.price)} / ${product.unit}`}
        />
        {product.pricingMode === "quote_required" ? null : (
          <>
            <InfoRow label="Stock" value={product.stock} />
            <InfoRow
              label="Minimum"
              value={`${product.minimumOrder} ${product.minimumUnit}`}
            />
          </>
        )}
        <InfoRow label="Status" value={product.availability} />
      </div>
      <div className="mt-6 flex flex-col gap-3 sm:flex-row">
        <Link
          href={`/shop/${product.slug}`}
          className="inline-flex h-11 flex-1 items-center justify-center gap-2 rounded-full border border-green-800 px-4 text-sm font-bold text-green-900 transition hover:bg-green-50"
        >
          View
          <ArrowRight size={16} />
        </Link>
        {isOrderable ? (
          <AddToCartButton product={product} />
        ) : (
          <Link
            href={productRequestUrl(product)}
            className="inline-flex h-11 flex-1 items-center justify-center rounded-full bg-green-800 px-4 text-sm font-bold text-white transition hover:bg-green-900"
            target="_blank"
          >
            Request Availability
          </Link>
        )}
      </div>
    </article>
  );
}

export function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-4 border-b border-stone-100 pb-2">
      <span className="text-stone-500">{label}</span>
      <span className="text-right font-semibold text-stone-900">{value}</span>
    </div>
  );
}

export function Field({
  label,
  placeholder,
  type = "text",
  name,
}: {
  label: string;
  placeholder: string;
  type?: string;
  name?: string;
}) {
  return (
    <label className="grid gap-2 text-sm font-semibold text-stone-800">
      {label}
      <input
        name={name ?? label.toLowerCase().replaceAll(" ", "-")}
        type={type}
        placeholder={placeholder}
        className="h-12 rounded-lg border border-stone-200 bg-white px-4 text-sm font-normal text-stone-900 shadow-sm"
      />
    </label>
  );
}

export function TextArea({
  label,
  placeholder,
  name,
}: {
  label: string;
  placeholder: string;
  name?: string;
}) {
  return (
    <label className="grid gap-2 text-sm font-semibold text-stone-800">
      {label}
      <textarea
        name={name ?? label.toLowerCase().replaceAll(" ", "-")}
        placeholder={placeholder}
        rows={4}
        className="rounded-lg border border-stone-200 bg-white px-4 py-3 text-sm font-normal text-stone-900 shadow-sm"
      />
    </label>
  );
}







