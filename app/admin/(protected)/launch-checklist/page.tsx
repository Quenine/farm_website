import Link from "next/link";
import { AdminHeader } from "@/src/components/admin";

export const dynamic = "force-dynamic";

const checklistSections = [
  {
    title: "Catalogue",
    items: [
      "Product prices confirmed",
      "Stock quantities confirmed",
      "Product stock reviewed after test cleanup",
      "Product images uploaded",
    ],
  },
  {
    title: "Delivery",
    items: [
      "Delivery coverage checked",
      "Delivery rates checked for launch locations",
      "Every orderable product has destination rates or All-city fallbacks",
    ],
  },
  {
    title: "Payments",
    items: [
      "Paystack mode confirmed",
      "Paystack live keys configured when ready",
      "One successful launch test order reviewed",
    ],
  },
  {
    title: "Notifications",
    items: [
      "Notification email configured",
      "Notifications tested",
      "WhatsApp notification configured if used",
    ],
  },
  {
    title: "Operations",
    items: [
      "Admin links are hidden from public site",
      "Test orders cleared before launch",
      "Test orders reviewed, cancelled, or ignored",
      "Someone assigned to monitor orders",
      "Real paid orders will be kept for reconciliation",
    ],
  },
];

export default function AdminLaunchChecklistPage() {
  return (
    <>
      <AdminHeader
        title="Launch Checklist"
        body="A simple operational checklist for public launch and daily readiness. These checks are intentionally manual."
      />
      <div className="mb-4 rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm leading-6 text-amber-900">
        Test orders can be cancelled instead of deleted. Real paid orders should not be deleted; keep records for Paystack, inventory, delivery, and payment reconciliation.
      </div>
      <div className="mb-5 flex flex-wrap gap-2">
        <Link href="/admin/delivery-coverage" className="inline-flex h-10 items-center rounded-full bg-green-800 px-4 text-sm font-bold text-white">
          Check Delivery Coverage
        </Link>
        <Link href="/admin/diagnostics" className="inline-flex h-10 items-center rounded-full border border-green-800 px-4 text-sm font-bold text-green-950">
          Check Diagnostics
        </Link>
      </div>
      <section className="grid gap-4 lg:grid-cols-2">
        {checklistSections.map((section) => (
          <div key={section.title} className="rounded-lg border border-green-100 bg-white p-5 shadow-sm">
            <h2 className="text-lg font-bold text-green-950">{section.title}</h2>
            <div className="mt-4 grid gap-2">
              {section.items.map((item) => (
                <label key={item} className="flex items-start gap-3 rounded-lg border border-stone-100 bg-stone-50 p-3 text-sm font-semibold text-stone-800">
                  <input type="checkbox" className="mt-1 size-4 rounded border-stone-300" />
                  <span>{item}</span>
                </label>
              ))}
            </div>
          </div>
        ))}
      </section>
    </>
  );
}
