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
          body="Browse eggs, broilers, fresh crop produce, and selected farm inputs from Noble Farms. Product availability, quantity, and delivery options may vary by item and location."
        />
        <div className="mt-6 rounded-lg bg-green-50 p-5 text-green-950">
          <h2 className="text-lg font-bold">Fresh crop produce supply</h2>
          <p className="mt-2 text-sm font-semibold leading-6 text-green-900">
            Noble Farms also supplies fresh produce including Irish potatoes,
            bell peppers, onions, sweet potatoes, ata rodo, carrots, cabbage,
            broccoli, avocado, cucumber, shombo pepper, cauliflower, and baskets
            of tomatoes. Crop produce is supplied based on harvest, sourcing,
            and confirmed availability.
          </p>
        </div>
        <div className="mt-9 grid gap-5 md:grid-cols-2 lg:grid-cols-3">
          {products.map((product) => (
            <ProductCard key={product.slug} product={product} />
          ))}
        </div>
      </section>
    </PageShell>
  );
}
