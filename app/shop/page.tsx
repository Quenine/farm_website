import { PageShell, ProductCard, SectionHeader } from "@/src/components/ui";
import { getPublicProducts } from "@/src/lib/products";

export const dynamic = "force-dynamic";

export default async function ShopPage() {
  const products = await getPublicProducts();

  return (
    <PageShell>
      <section className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
        <SectionHeader
          eyebrow="Catalogue"
          title="Shop Noble Farms produce"
          body="Browse poultry, eggs, manure, and seasonal farm produce from Noble Farms. Delivery options depend on product type, quantity, and location."
        />
        <p className="mt-6 rounded-lg bg-green-50 p-4 text-sm font-semibold leading-6 text-green-900">
          Crop produce such as tomatoes, peppers, and other seasonal items will
          be added as supply becomes available.
        </p>
        <div className="mt-9 grid gap-5 md:grid-cols-2 lg:grid-cols-3">
          {products.map((product) => (
            <ProductCard key={product.slug} product={product} />
          ))}
        </div>
      </section>
    </PageShell>
  );
}
