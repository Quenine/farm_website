import { PageShell, SectionHeader } from "@/src/components/ui";

export default function TermsPage() {
  return (
    <PageShell>
      <section className="mx-auto max-w-4xl px-4 py-12 sm:px-6 lg:px-8">
        <SectionHeader
          eyebrow="Terms"
          title="Terms of use"
          body="By using the Noble Farms website, you agree to use it for genuine product enquiries, orders, payment, and order tracking."
        />
        <div className="mt-8 grid gap-5 rounded-lg bg-white p-6 text-sm leading-7 text-stone-700 shadow-sm">
          <p>Product availability, stock, delivery methods, and delivery fees may vary by product, quantity, and location.</p>
          <p>Orders are only treated as paid after payment confirmation is received through Paystack and verified by Noble Farms systems.</p>
          <p>Noble Farms may contact customers to clarify delivery details, fulfilment timing, or product availability where necessary.</p>
          <p>Customers are responsible for providing accurate phone, email, delivery, and pickup details.</p>
          <p>For support, contact Noble Farms, Alapata, Ibadan, Nigeria, +2349035712314, or info@noblefarms.xyz.</p>
        </div>
      </section>
    </PageShell>
  );
}