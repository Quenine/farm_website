import { Globe2, Mail, MapPin, MessageCircle, Phone } from "lucide-react";
import { siteConfig, siteContact } from "@/src/config/site";
import { PageShell, SectionHeader } from "@/src/components/ui";
import { ContactForm } from "./contact-form";

export default function ContactPage() {
  return (
    <PageShell>
      <section className="mx-auto grid max-w-7xl gap-8 px-4 py-12 sm:px-6 lg:grid-cols-[0.9fr_1.1fr] lg:px-8">
        <div>
          <SectionHeader
            eyebrow="Contact"
            title={`Talk to ${siteConfig.name}`}
            body={`Need help with an order, bulk supply, produce availability, or delivery arrangement? Contact ${siteConfig.name} and we'll respond as soon as possible.`}
          />
          <div className="mt-8 grid gap-4">
            {[
              { label: "Location", value: siteConfig.address, Icon: MapPin },
              { label: "Phone", value: siteConfig.phone, Icon: Phone },
              { label: "Email", value: siteConfig.email, Icon: Mail },
              { label: "Website", value: siteConfig.url, Icon: Globe2 },
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
            <a href={siteContact.whatsappHref} className="inline-flex h-12 items-center justify-center gap-2 rounded-full bg-green-800 px-6 text-sm font-bold text-white transition hover:bg-green-900">
              <MessageCircle size={18} />
              WhatsApp {siteConfig.name}
            </a>
            <a href={siteContact.phoneHref} className="inline-flex h-12 items-center justify-center rounded-full border border-green-800 px-6 text-sm font-bold text-green-950 transition hover:bg-white">
              Call now
            </a>
          </div>
        </div>
        <ContactForm />
      </section>
    </PageShell>
  );
}

