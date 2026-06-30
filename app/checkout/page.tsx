import { CheckoutForm } from "@/src/components/checkout/checkout-form";
import { PageShell } from "@/src/components/ui";
import { getActiveProductDeliveryRates } from "@/src/lib/product-delivery-rates";

export const dynamic = "force-dynamic";

export default async function CheckoutPage() {
  const rates = await getActiveProductDeliveryRates();

  return (
    <PageShell>
      <section className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
        <h1 className="text-4xl font-bold text-green-950">Checkout</h1>
        <p className="mt-3 text-stone-700">
          Enter your delivery location, review the calculated delivery fee, and pay securely.
        </p>
        <div className="mt-8">
          <CheckoutForm rates={rates} />
        </div>
      </section>
    </PageShell>
  );
}
