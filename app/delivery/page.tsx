import { siteConfig } from "@/src/config/site";
import { PageShell, SectionHeader } from "@/src/components/ui";

const points = [
  "Delivery fee is calculated at checkout based on location, order size, and handling requirements.",
  "Some products or locations may require direct arrangement before fulfilment.",
  "Pickup or direct arrangement is available where shown at checkout.",
  `For bulk orders or unsupported locations, contact ${siteConfig.name} for help before placing an order.`,
];

export default function DeliveryInformationPage() {
  return (
    <PageShell>
      <section className="mx-auto max-w-4xl px-4 py-12 sm:px-6 lg:px-8">
        <SectionHeader
          eyebrow="Delivery"
          title="Delivery information"
          body={`${siteConfig.name} keeps delivery simple: choose your location and available delivery method at checkout, then review the delivery fee before payment.`}
        />
        <div className="mt-8 grid gap-4">
          {points.map((point) => (
            <div key={point} className="rounded-lg bg-white p-5 text-sm leading-6 text-stone-700 shadow-sm">
              {point}
            </div>
          ))}
        </div>
        <div className="mt-8 rounded-lg border border-green-100 bg-green-50 p-5 text-sm leading-6 text-green-950">
          Need help with delivery? Call or WhatsApp <strong>{siteConfig.phone}</strong> or email <strong>{siteConfig.email}</strong>.
        </div>
      </section>
    </PageShell>
  );
}

