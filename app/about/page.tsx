import { CheckCircle2, MapPin, Sprout } from "lucide-react";
import { PageShell, SectionHeader } from "@/src/components/ui";

export default function AboutPage() {
  return (
    <PageShell>
      <section className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
        <SectionHeader
          eyebrow="About"
          title="Farm-direct supply for homes, kitchens, vendors, and resellers."
          body="Noble Farms is a farm produce business supplying poultry, eggs, fresh crops, and selected farm inputs from Ibadan, Nigeria. We focus on practical supply, clear pricing, reliable fulfilment, and honest communication with every customer."
        />
        <div className="mt-10 grid gap-5 md:grid-cols-3">
          {[
            {
              title: "What we supply",
              body: "Our catalogue includes eggs, broilers, processed chicken, tomatoes, peppers, potatoes, onions, carrots, cabbage, cucumber, avocado, broccoli, cauliflower, and selected farm inputs such as manure.",
              Icon: Sprout,
            },
            {
              title: "Who we serve",
              body: "We serve households, restaurants, caterers, food vendors, bakeries, small retailers, market resellers, and bulk buyers.",
              Icon: CheckCircle2,
            },
            {
              title: "How fulfilment works",
              body: "Orders are handled based on product type, quantity, and location. Poultry and eggs can be scheduled locally, while crop produce may be arranged for wider delivery depending on availability and logistics.",
              Icon: MapPin,
            },
          ].map(({ title, body, Icon }) => (
            <div key={title} className="rounded-lg bg-white p-6 shadow-sm">
              <Icon className="text-green-800" size={26} />
              <h2 className="mt-4 text-xl font-bold text-green-950">{title}</h2>
              <p className="mt-3 text-sm leading-6 text-stone-600">{body}</p>
            </div>
          ))}
        </div>
      </section>
    </PageShell>
  );
}
