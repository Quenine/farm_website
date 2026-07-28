import { AdminHeader } from "@/src/components/admin";
import { requireAdmin } from "@/src/lib/admin-auth";
import { createAdminSupabaseClient } from "@/src/lib/supabase/admin";
import { InquiryActions } from "./inquiry-actions";

export const dynamic = "force-dynamic";
type SearchParams = Promise<Record<string, string | string[] | undefined>>;
type Details = Record<string, unknown>;
const detailLabels: Record<string, string> = {
  company_website: "Company website", country: "Country", city_state: "City or state", products_required: "Products required",
  approximate_quantity: "Approximate quantity", requirement_pattern: "Requirement", preferred_date: "Preferred date",
  quality_packaging: "Quality, grade, size or packaging", additional_information: "Additional information",
  delivery_location: "Delivery location", preferred_frequency: "Preferred frequency", procurement_challenge: "Procurement challenge",
  destination_country: "Destination country", destination_city: "Destination city", destination_port: "Destination port or airport",
  product_grade: "Product variety or grade", preferred_packaging: "Preferred packaging",
  certifications_requirements: "Certifications or import requirements", preferred_incoterm: "Preferred Incoterm",
  expected_order_frequency: "Expected order frequency", payment_expectation: "Payment or trade-finance expectation",
};

export default async function InquiriesPage({ searchParams }: { searchParams: SearchParams }) {
  await requireAdmin();
  const params = await searchParams;
  const q = typeof params.q === "string" ? params.q : "";
  const status = typeof params.status === "string" ? params.status : "all";
  const type = typeof params.type === "string" ? params.type : "all";
  const safeSearch = q.replace(/[,%]/g, " ");
  let query = createAdminSupabaseClient().from("contact_inquiries")
    .select("id,full_name,phone,email,inquiry_type,message,status,created_at,company_name,inquiry_details", { count: "exact" })
    .order("created_at", { ascending: false }).limit(100);
  if (q) query = query.or(`full_name.ilike.%${safeSearch}%,email.ilike.%${safeSearch}%,company_name.ilike.%${safeSearch}%`);
  if (status !== "all") query = query.eq("status", status);
  if (type !== "all") query = query.eq("inquiry_type", type);
  const { data, error } = await query;
  return <div>
    <AdminHeader title="Sales & Support Inquiries" body="Review customer, business-supply and export enquiries from one server-managed workflow." />
    <form className="mb-5 grid gap-2 rounded-lg bg-white p-4 md:grid-cols-[1fr_180px_220px_auto]">
      <input name="q" defaultValue={q} placeholder="Search company, name or email" className="h-11 rounded-lg border px-3" />
      <select name="status" defaultValue={status} className="h-11 rounded-lg border px-3"><option value="all">All statuses</option><option value="new">New</option><option value="in_progress">In progress</option><option value="resolved">Resolved</option><option value="spam">Spam</option></select>
      <select name="type" defaultValue={type} className="h-11 rounded-lg border px-3"><option value="all">All inquiry types</option><option value="product_availability">Product availability</option><option value="order_support">Order support</option><option value="bulk_business_supply">Business supply</option><option value="export_supply">Export supply</option><option value="delivery_question">Delivery question</option><option value="partnership">Partnership</option><option value="other">Other</option></select>
      <button className="rounded-full bg-green-800 px-4 text-sm font-bold text-white">Filter</button>
    </form>
    {error ? <p className="rounded-lg bg-red-50 p-4 text-red-800">Inquiries could not be loaded.</p> : null}
    <div className="grid gap-4">{(data ?? []).map((row) => {
      const details = row.inquiry_details && typeof row.inquiry_details === "object" && !Array.isArray(row.inquiry_details) ? row.inquiry_details as Details : {};
      const visibleDetails = Object.entries(details).filter(([key, value]) => key !== "marketing_attribution" && value !== null && value !== "");
      const customerWhatsApp = row.phone ? String(row.phone).replace(/\D/g, "") : "";
      return <article key={row.id} className="rounded-lg bg-white p-5 shadow-sm">
        <div className="flex flex-col gap-3 md:flex-row md:justify-between"><div>
          <p className="text-xs font-bold uppercase tracking-wider text-green-700">{String(row.inquiry_type).replaceAll("_", " ")}</p>
          <h2 className="mt-1 text-lg font-bold text-green-950">{row.company_name || row.full_name}</h2>
          {row.company_name ? <p className="text-sm text-stone-600">Contact: {row.full_name}</p> : null}
          <p className="text-sm text-stone-600">{String(row.status).replaceAll("_", " ")} · {new Date(row.created_at).toLocaleString("en-NG")}</p>
        </div><div className="flex shrink-0 flex-col gap-2 text-sm"><a className="font-bold text-green-800 underline" href={`mailto:${row.email}`}>{row.email}</a>{customerWhatsApp ? <a className="font-bold text-green-800 underline" href={`https://wa.me/${customerWhatsApp}`}>WhatsApp {row.phone}</a> : null}</div></div>
        {visibleDetails.length ? <dl className="mt-5 grid gap-x-8 gap-y-3 border-y border-stone-100 py-4 sm:grid-cols-2">{visibleDetails.map(([key, value]) => <div key={key}><dt className="text-xs font-bold uppercase tracking-wide text-stone-500">{detailLabels[key] ?? key.replaceAll("_", " ")}</dt><dd className="mt-1 whitespace-pre-wrap text-sm text-stone-800">{String(value)}</dd></div>)}</dl> : <p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-stone-800">{row.message}</p>}
        <InquiryActions id={row.id} />
      </article>;
    })}</div>
    {!error && (data ?? []).length === 0 ? <p className="rounded-lg bg-white p-8 text-center text-stone-600">No inquiries match these filters.</p> : null}
  </div>;
}
