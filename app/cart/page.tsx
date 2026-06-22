import { CartPageClient } from "@/src/components/cart/cart-page-client";
import { PageShell } from "@/src/components/ui";

export default function CartPage() {
  return (
    <PageShell>
      <section className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
        <h1 className="text-4xl font-bold text-green-950">Cart</h1>
        <p className="mt-3 text-stone-700">
          Quantity controls respect minimum order quantities and available stock.
        </p>
        <div className="mt-8">
          <CartPageClient />
        </div>
      </section>
    </PageShell>
  );
}
