import { Mail, MapPin, Phone } from "lucide-react";
import { Field, PageShell, SectionHeader, TextArea } from "@/src/components/ui";

export default function ContactPage() {
  return (
    <PageShell>
      <section className="mx-auto grid max-w-7xl gap-8 px-4 py-12 sm:px-6 lg:grid-cols-[0.9fr_1.1fr] lg:px-8">
        <div>
          <SectionHeader
            eyebrow="Contact"
            title="Talk to Noble Farms"
            body="Use this mock contact surface for customer questions, bulk orders, or delivery enquiries before backend integrations are added."
          />
          <div className="mt-8 grid gap-4">
            {[
              { label: "Location", value: "Ibadan, Nigeria", Icon: MapPin },
              { label: "Phone", value: "0800 000 0000", Icon: Phone },
              { label: "Email", value: "orders@noblefarm.xyz", Icon: Mail },
            ].map(({ label, value, Icon }) => (
              <div key={label} className="flex gap-4 rounded-lg bg-white p-4 shadow-sm">
                <Icon className="text-green-800" size={22} />
                <div>
                  <p className="text-sm font-bold text-green-950">{label}</p>
                  <p className="text-sm text-stone-600">{value}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
        <form className="grid gap-5 rounded-lg bg-white p-6 shadow-sm">
          <div className="grid gap-5 md:grid-cols-2">
            <Field label="Full name" placeholder="Adebayo Noble" />
            <Field label="Phone number" placeholder="0803 000 0000" />
          </div>
          <Field label="Email" placeholder="you@example.com" type="email" />
          <TextArea label="Message" placeholder="Tell us what you need" />
          <button className="h-12 rounded-full bg-green-800 px-6 text-sm font-bold text-white">
            Send mock message
          </button>
        </form>
      </section>
    </PageShell>
  );
}
