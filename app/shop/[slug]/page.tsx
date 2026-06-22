import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { ProductDetailActions } from "@/src/components/product/product-detail-actions";
import { InfoRow, PageShell } from "@/src/components/ui";
import { formatNaira } from "@/src/lib/format";
import { getPublicProductBySlug } from "@/src/lib/products";

export const dynamic = "force-dynamic";

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

  return (
    <PageShell>
      <section className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
        <Link
          href="/shop"
          className="inline-flex items-center gap-2 text-sm font-bold text-green-800"
        >
          <ArrowLeft size={16} />
          Back to shop
        </Link>
        <div className="mt-6 grid gap-8 lg:grid-cols-[0.9fr_1.1fr]">
          <div className="rounded-lg bg-[linear-gradient(135deg,#fef3c7,#dcfce7)] p-8 shadow-sm">
            <div className="grid aspect-square place-items-center rounded-lg bg-white/70 p-8 text-center">
              <div>
                <p className="text-sm font-bold uppercase tracking-[0.16em] text-amber-700">
                  {product.category}
                </p>
                <h1 className="mt-3 text-4xl font-bold text-green-950">
                  {product.name}
                </h1>
                <p className="mt-4 text-stone-700">{product.badge}</p>
              </div>
            </div>
          </div>
          <div className="rounded-lg bg-white p-6 shadow-sm">
            <p className="text-sm font-bold uppercase tracking-[0.16em] text-green-700">
              {product.availability}
            </p>
            <h2 className="mt-3 text-3xl font-bold text-green-950">
              {formatNaira(product.price)} per {product.unit}
            </h2>
            <p className="mt-4 text-lg leading-8 text-stone-700">
              {product.description}
            </p>
            <div className="mt-6 rounded-lg border border-amber-200 bg-amber-50 p-4">
              <p className="font-bold text-amber-900">Minimum order requirement</p>
              <p className="mt-2 text-sm leading-6 text-amber-900">
                This product can only be added from {product.minimumOrder}{" "}
                {product.minimumUnit} and above. The local cart enforces this
                minimum and the currently available stock.
              </p>
            </div>
            <div className="mt-6 grid gap-3">
              <InfoRow label="Stock" value={product.stock} />
              <InfoRow label="Unit" value={product.unit} />
              <InfoRow
                label="Minimum order"
                value={`${product.minimumOrder} ${product.minimumUnit}`}
              />
            </div>
            <ProductDetailActions product={product} />
            <div className="mt-4">
              <Link
                href="/checkout"
                className="inline-flex h-12 w-full items-center justify-center rounded-full border border-green-800 px-5 text-sm font-bold text-green-950 transition hover:bg-green-50"
              >
                Continue to checkout
              </Link>
            </div>
          </div>
        </div>
      </section>
    </PageShell>
  );
}
