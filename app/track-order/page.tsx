import { TrackOrderForm } from "@/src/components/orders/track-order-form";
import { PageShell } from "@/src/components/ui";

export default function TrackOrderPage() {
  return (
    <PageShell>
      <section className="mx-auto max-w-4xl px-4 py-12 sm:px-6 lg:px-8">
        <h1 className="text-4xl font-bold text-green-950">Track order</h1>
        <p className="mt-3 text-stone-700">
          Enter the order reference and the same phone number used at checkout.
        </p>
        <TrackOrderForm />
      </section>
    </PageShell>
  );
}
