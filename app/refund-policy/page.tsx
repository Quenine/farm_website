import { PageShell, SectionHeader } from "@/src/components/ui";

const items = [
  "Contact Noble Farms as quickly as possible if you need to change or cancel an order.",
  "Failed payments are not treated as completed orders.",
  "Perishable or fresh products may not be refundable once dispatched or delivered unless there is a confirmed issue with the order.",
  "Refund handling depends on payment confirmation, order status, product condition, and fulfilment progress.",
  "If Noble Farms cannot fulfil a paid order, we will contact you to arrange a replacement, reschedule, or refund where appropriate.",
];

export default function RefundPolicyPage() {
  return (
    <PageShell>
      <section className="mx-auto max-w-4xl px-4 py-12 sm:px-6 lg:px-8">
        <SectionHeader
          eyebrow="Support"
          title="Refund and cancellation policy"
          body="This policy is designed for real farm produce orders, including perishable products and scheduled fulfilment."
        />
        <div className="mt-8 grid gap-4">
          {items.map((item) => (
            <p key={item} className="rounded-lg bg-white p-5 text-sm leading-6 text-stone-700 shadow-sm">{item}</p>
          ))}
        </div>
        <p className="mt-8 rounded-lg border border-green-100 bg-green-50 p-5 text-sm leading-6 text-green-950">
          For order support, contact Noble Farms at +2349035712314 or info@noblefarms.xyz.
        </p>
      </section>
    </PageShell>
  );
}