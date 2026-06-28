import { CheckCircle2, MapPin, Sprout } from "lucide-react";
import { PageShell, SectionHeader } from "@/src/components/ui";

export default function AboutPage() {
  return (
    <PageShell>
      <section className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
        <SectionHeader
          eyebrow="About"
          title="Farm-direct supply for homes, kitchens, and resellers."
          body="Noble Farms is a poultry and farm produce business based in Ibadan, Nigeria. We supply live broilers, processed chicken, eggs, manure, and selected seasonal produce with a focus on clear pricing, reliable fulfilment, and honest communication."
        />
        <div className="mt-10 grid gap-5 md:grid-cols-3">
          {[
            {
              title: "What we supply",
              body: "Our catalogue includes poultry products, eggs, manure, and seasonal crop produce such as tomatoes and peppers as supply becomes available.",
              Icon: Sprout,
            },
            {
              title: "How delivery works",
              body: "Poultry and eggs are handled through scheduled delivery within Ibadan and nearby areas. Selected crop produce may be arranged for wider delivery depending on quantity, product condition, and logistics.",
              Icon: MapPin,
            },
            {
              title: "Who we serve",
              body: "We serve households, food vendors, restaurants, caterers, bakeries, small retailers, and bulk buyers who want dependable farm-direct supply.",
              Icon: CheckCircle2,
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
