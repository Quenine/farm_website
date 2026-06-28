import Link from "next/link";
import { CheckCircle2, ShieldCheck, Truck, type LucideIcon } from "lucide-react";
import { PageShell, ProductCard, SectionHeader } from "@/src/components/ui";
import { getPublicProducts } from "@/src/lib/products";

export const dynamic = "force-dynamic";

const trustFeatures: {
  title: string;
  body: string;
  Icon: LucideIcon;
}[] = [
  {
    title: "Farm-direct supply",
    body: "Clear prices, current stock, minimum order rules, and direct order fulfilment.",
    Icon: CheckCircle2,
  },
  {
    title: "Flexible delivery",
    body: "Scheduled local delivery for poultry and eggs, with wider delivery arrangements for eligible crop produce.",
    Icon: Truck,
  },
  {
    title: "Secure checkout",
    body: "Create an order, pay securely online, and track fulfilment with your order reference.",
    Icon: ShieldCheck,
  },
];

export default async function Home() {
  const products = await getPublicProducts();
  const activeProducts = products.filter(
    (product) => product.status === "active",
  );
  const featuredProducts = activeProducts.filter(
    (product) => product.isFeatured,
  );
  const homepageProducts = (
    featuredProducts.length > 0 ? featuredProducts : activeProducts
  ).slice(0, 3);

  return (
    <PageShell>
      <section className="bg-[#f3ead8]">
        <div className="mx-auto grid max-w-7xl gap-10 px-4 py-14 sm:px-6 lg:grid-cols-[1.05fr_0.95fr] lg:px-8 lg:py-20">
          <div className="flex flex-col justify-center">
            <p className="text-sm font-bold uppercase tracking-[0.18em] text-green-700">
              Noble Farms
            </p>
            <h1 className="mt-4 max-w-3xl text-4xl font-bold tracking-tight text-green-950 sm:text-6xl">
              Fresh poultry, eggs, and farm produce supplied with care.
            </h1>
            <p className="mt-5 max-w-2xl text-lg leading-8 text-stone-700">
              Order live broilers, processed chicken, eggs, manure, and
              seasonal produce directly from Noble Farms. We serve homes, food
              vendors, kitchens, caterers, and resellers with clear pricing,
              scheduled fulfilment, and secure online payment.
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
          <div className="rounded-lg bg-green-950 p-6 text-white shadow-xl">
            <div className="grid min-h-[360px] place-items-center rounded-lg bg-[linear-gradient(135deg,#fff7ed_0%,#dcfce7_45%,#fde68a_100%)] p-6 text-green-950">
              <div className="w-full max-w-sm">
                <div className="rounded-lg bg-white/85 p-5 shadow-sm">
                  <p className="text-sm font-bold text-amber-700">
                    Today at farm gate
                  </p>
                  <p className="mt-3 text-4xl font-bold">Live broilers</p>
                  <p className="mt-2 text-sm text-stone-700">
                    Available by weight for bulk and scheduled orders.
                  </p>
                </div>
                <div className="mt-4 grid grid-cols-2 gap-4">
                  <div className="rounded-lg bg-white/80 p-4">
                    <p className="text-2xl font-bold">Egg supply</p>
                    <p className="text-xs font-semibold text-stone-600">
                      Crates and half-crates for homes, bakeries, vendors, and
                      resellers.
                    </p>
                  </div>
                  <div className="rounded-lg bg-white/80 p-4">
                    <p className="text-2xl font-bold">Seasonal crops</p>
                    <p className="text-xs font-semibold text-stone-600">
                      Tomatoes, peppers, and selected produce available as
                      supply opens.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
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
            title="Popular farm produce"
            body="Browse available Noble Farms products and place an order securely online."
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
        <p className="mt-6 rounded-lg bg-green-50 p-4 text-sm font-semibold leading-6 text-green-900">
          Crop produce such as tomatoes, peppers, and other seasonal items will
          be added as supply becomes available.
        </p>
      </section>
    </PageShell>
  );
}
