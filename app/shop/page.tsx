import Link from "next/link";
import { ShopFilters } from "@/app/shop/shop-filters";
import { ShopAnalytics } from "@/app/shop/shop-analytics";
import { siteConfig, siteContact } from "@/src/config/site";
import { PageShell, ProductCard, SectionHeader } from "@/src/components/ui";
import { getPublicProducts } from "@/src/lib/products";
import type { Product } from "@/src/types";
import type { Metadata } from "next";

export const dynamic = "force-dynamic";

type ShopPageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export async function generateMetadata({ searchParams }: ShopPageProps): Promise<Metadata> {
  const query = await searchParams;
  const filtered = Object.values(query).some((value) => Array.isArray(value) ? value.length > 0 : Boolean(value));
  return {
    title: "Shop | " + siteConfig.name,
    description: "Shop active farm products from " + siteConfig.name + ".",
    alternates: { canonical: siteConfig.url + "/shop" },
    robots: filtered ? { index: false, follow: true } : { index: true, follow: true },
  };
}

type SortOption = "price-asc" | "featured" | "newest" | "price-desc" | "name-asc";

const preferredUnits = ["bag", "kg", "crate", "head", "piece", "rubber", "custard rubber", "basket", "bunch", "dozen"];

function firstParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] ?? "" : value ?? "";
}

function slugify(value: string) {
  return value.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
}

function productSearchText(product: Product) {
  return [product.name, product.description, product.category, product.unit, product.minimumUnit]
    .join(" ")
    .toLowerCase();
}

function matchesAvailability(product: Product, availability: string) {
  if (availability === "in-stock") return product.stockCount > 0;
  if (availability === "out-of-stock") return product.stockCount <= 0;
  if (availability === "orderable") return product.isOrderableOnline && product.pricingMode === "fixed";
  if (availability === "quote") return product.pricingMode === "quote_required" || !product.isOrderableOnline;
  return true;
}

function sortProducts(products: Product[], sort: SortOption) {
  return [...products].sort((a, b) => {
    if (sort === "price-asc") return a.price - b.price || a.name.localeCompare(b.name);
    if (sort === "price-desc") return b.price - a.price || a.name.localeCompare(b.name);
    if (sort === "name-asc") return a.name.localeCompare(b.name);
    if (sort === "newest") return (b.id ?? b.slug).localeCompare(a.id ?? a.slug);
    return Number(b.isFeatured) - Number(a.isFeatured) || (a.featuredSortOrder ?? 100) - (b.featuredSortOrder ?? 100) || a.name.localeCompare(b.name);
  });
}

export default async function ShopPage({ searchParams }: ShopPageProps) {
  const [products, query] = await Promise.all([getPublicProducts(), searchParams]);
  const search = firstParam(query.search).trim();
  const category = firstParam(query.category);
  const availability = firstParam(query.availability) || "all";
  const unit = firstParam(query.unit);
  const requestedSort = firstParam(query.sort) as SortOption;
  const sort = (["price-asc", "featured", "newest", "price-desc", "name-asc"].includes(requestedSort) ? requestedSort : "price-asc") as SortOption;
  const minPrice = Number(firstParam(query.minPrice));
  const maxPrice = Number(firstParam(query.maxPrice));
  const normalizedSearch = search.toLowerCase();
  const minPriceParam = firstParam(query.minPrice);
  const maxPriceParam = firstParam(query.maxPrice);
  const filterKey = JSON.stringify({ search, category, availability, unit, sort, minPrice: minPriceParam, maxPrice: maxPriceParam });

  const categories = [...new Map(products.map((product) => [slugify(product.category), product.category])).entries()];
  const units = Array.from(new Set([...preferredUnits, ...products.map((product) => product.unit.toLowerCase())])).sort();

  const filteredProducts = sortProducts(
    products.filter((product) => {
      if (normalizedSearch && !productSearchText(product).includes(normalizedSearch)) return false;
      if (category && slugify(product.category) !== category) return false;
      if (!matchesAvailability(product, availability)) return false;
      if (unit && ![product.unit, product.minimumUnit].some((value) => value.toLowerCase().includes(unit))) return false;
      if (Number.isFinite(minPrice) && minPrice > 0 && product.price < minPrice) return false;
      if (Number.isFinite(maxPrice) && maxPrice > 0 && product.price > maxPrice) return false;
      return true;
    }),
    sort,
  );

  return (
    <PageShell>
      <section className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
        <SectionHeader
          eyebrow="Catalogue"
          title={`Shop ${siteConfig.name} produce`}
          body={`Browse eggs, broilers, fresh crop produce, and selected farm inputs from ${siteConfig.name}. Product availability, quantity, and delivery options may vary by item and location.`}
        />
        <ShopAnalytics products={filteredProducts} search={search} />
        <ShopFilters
          key={filterKey}
          categories={categories}
          units={units}
          totalCount={products.length}
          shownCount={filteredProducts.length}
          initialValues={{
            search,
            category,
            availability,
            unit,
            sort,
            minPrice: minPriceParam,
            maxPrice: maxPriceParam,
          }}
        />

        {filteredProducts.length > 0 ? (
          <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {filteredProducts.map((product) => (
              <ProductCard key={product.slug} product={product} />
            ))}
          </div>
        ) : (
          <div className="mt-6 rounded-lg border border-amber-200 bg-amber-50 p-8 text-center text-amber-950">
            <h2 className="text-xl font-bold">No products match your filters.</h2>
            <p className="mt-2 text-sm leading-6">Try adjusting your search or contact us for availability.</p>
            <div className="mt-4 flex justify-center gap-3">
              <Link href="/shop" className="rounded-full border border-amber-700 px-4 py-2 text-sm font-bold text-amber-950">Clear filters</Link>
              <a href={siteContact.whatsappHref} className="rounded-full bg-green-800 px-4 py-2 text-sm font-bold text-white">Contact us</a>
            </div>
          </div>
        )}
      </section>
    </PageShell>
  );
}




