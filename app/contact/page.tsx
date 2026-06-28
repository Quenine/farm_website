import { Globe2, Mail, MapPin, MessageCircle, Phone } from "lucide-react";
import { Field, PageShell, SectionHeader, TextArea } from "@/src/components/ui";

const phone = "+2349035712314";
const whatsappUrl = "https://wa.me/2349035712314";

export default function ContactPage() {
  return (
    <PageShell>
      <section className="mx-auto grid max-w-7xl gap-8 px-4 py-12 sm:px-6 lg:grid-cols-[0.9fr_1.1fr] lg:px-8">
        <div>
          <SectionHeader
            eyebrow="Contact"
            title="Talk to Noble Farms"
            body="Need help with an order, bulk supply, produce availability, or delivery arrangement? Contact Noble Farms and we'll respond as soon as possible."
          />
          <div className="mt-8 grid gap-4">
            {[
              {
                label: "Location",
                value: "Noble Farms, Alapata, Ibadan, Nigeria",
                Icon: MapPin,
              },
              { label: "Phone", value: phone, Icon: Phone },
              { label: "Email", value: "info@noblefarms.xyz", Icon: Mail },
              { label: "Website", value: "https://noblefarms.xyz", Icon: Globe2 },
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
          <div className="mt-6 flex flex-col gap-3 sm:flex-row">
            <a
              href={whatsappUrl}
              className="inline-flex h-12 items-center justify-center gap-2 rounded-full bg-green-800 px-6 text-sm font-bold text-white transition hover:bg-green-900"
            >
              <MessageCircle size={18} />
              WhatsApp Noble Farms
            </a>
            <a
              href={`tel:${phone}`}
              className="inline-flex h-12 items-center justify-center rounded-full border border-green-800 px-6 text-sm font-bold text-green-950 transition hover:bg-white"
            >
              Call now
            </a>
          </div>
        </div>
        <form
          action="mailto:info@noblefarms.xyz"
          method="post"
          encType="text/plain"
          className="grid gap-5 rounded-lg bg-white p-6 shadow-sm"
        >
          <p className="rounded-lg bg-amber-50 p-3 text-sm font-semibold leading-6 text-amber-900">
            For urgent orders, call or WhatsApp Noble Farms directly. You can
            also use this form to open an email message.
          </p>
          <div className="grid gap-5 md:grid-cols-2">
            <Field label="Full name" placeholder="Adebayo Noble" />
            <Field label="Phone number" placeholder="0803 571 2314" />
          </div>
          <Field label="Email" placeholder="you@example.com" type="email" />
          <TextArea label="Message" placeholder="Tell us what you need" />
          <button className="h-12 rounded-full bg-green-800 px-6 text-sm font-bold text-white">
            Send message
          </button>
        </form>
      </section>
    </PageShell>
  );
}
