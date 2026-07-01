import { siteConfig } from "@/src/config/site";
import { PageShell, SectionHeader } from "@/src/components/ui";

export default function PrivacyPolicyPage() {
  return (
    <PageShell>
      <section className="mx-auto max-w-4xl px-4 py-12 sm:px-6 lg:px-8">
        <SectionHeader eyebrow="Privacy" title="Privacy policy" body={`${siteConfig.name} collects only the information needed to process orders, accept payment, arrange fulfilment, and support customers.`} />
        <div className="mt-8 grid gap-5 rounded-lg bg-white p-6 text-sm leading-7 text-stone-700 shadow-sm">
          <p>We may collect your name, phone number, email address, delivery location, order details, and payment confirmation details.</p>
          <p>Payment is processed through Paystack. {siteConfig.name} does not store card details on this website.</p>
          <p>We use order information to fulfil purchases, contact customers about orders, manage inventory, and improve customer support.</p>
          <p>We do not sell customer personal information. We may share necessary order details with fulfilment or delivery partners only when needed to complete your order.</p>
          <p>For privacy questions, contact {siteConfig.supportEmail}.</p>
        </div>
      </section>
    </PageShell>
  );
}

