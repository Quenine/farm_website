import { CheckCircle2, MapPin, Sprout } from "lucide-react";
import { PageShell, SectionHeader } from "@/src/components/ui";

export default function AboutPage() {
  return (
    <PageShell>
      <section className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
        <SectionHeader
          eyebrow="About"
          title="Farm-direct supply for Ibadan buyers"
          body="Noble Farms is being built as a trustworthy online storefront for poultry, eggs, old layers, and farm supplies in Ibadan, Nigeria."
        />
        <div className="mt-10 grid gap-5 md:grid-cols-3">
          {[
            {
              title: "Local focus",
              body: "Delivery is intentionally limited to Ibadan so stock, timing, and communication stay reliable.",
              Icon: MapPin,
            },
            {
              title: "Practical catalogue",
              body: "Products show price, stock, units, and minimum order rules clearly before checkout.",
              Icon: CheckCircle2,
            },
            {
              title: "Farm operations",
              body: "The admin side is prepared for owner-managed products, inventory, orders, and delivery zones.",
              Icon: Sprout,
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
