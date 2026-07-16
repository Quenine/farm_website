import { AdminHeader } from "@/src/components/admin";
import { requireAdmin } from "@/src/lib/admin-auth";
import { createAdminSupabaseClient } from "@/src/lib/supabase/admin";
import { InquiryActions } from "./inquiry-actions";

export const dynamic = "force-dynamic";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

export default async function InquiriesPage({ searchParams }: { searchParams: SearchParams }) {
  await requireAdmin();
  const params = await searchParams;
  const q = typeof params.q === "string" ? params.q : "";
  const status = typeof params.status === "string" ? params.status : "all";
  const type = typeof params.type === "string" ? params.type : "all";
  const safeSearch = q.replace(/[,%]/g, " ");
  let query = createAdminSupabaseClient()
    .from("contact_inquiries")
    .select("id,full_name,phone,email,inquiry_type,message,status,created_at", { count: "exact" })
    .order("created_at", { ascending: false })
    .limit(100);

  if (q) query = query.or(`full_name.ilike.%${safeSearch}%,email.ilike.%${safeSearch}%`);
  if (status !== "all") query = query.eq("status", status);
  if (type !== "all") query = query.eq("inquiry_type", type);
  const { data, error } = await query;

  return (
    <div>
      <AdminHeader title="Sales & Support Inquiries" body="Monitor legitimate customer inquiries; retain records by default." />
      <form className="mb-5 grid gap-2 rounded-lg bg-white p-4 md:grid-cols-[1fr_180px_220px_auto]">
        <input name="q" defaultValue={q} placeholder="Search name or email" className="h-11 rounded-lg border px-3" />
        <select name="status" defaultValue={status} className="h-11 rounded-lg border px-3">
          <option value="all">All statuses</option>
          <option value="new">New</option>
          <option value="in_progress">In progress</option>
          <option value="resolved">Resolved</option>
          <option value="spam">Spam</option>
        </select>
        <select name="type" defaultValue={type} className="h-11 rounded-lg border px-3">
          <option value="all">All inquiry types</option>
          <option value="product_availability">Product availability</option>
          <option value="order_support">Order support</option>
          <option value="bulk_business_supply">Bulk/business supply</option>
          <option value="delivery_question">Delivery question</option>
          <option value="partnership">Partnership</option>
          <option value="other">Other</option>
        </select>
        <button className="rounded-full bg-green-800 px-4 text-sm font-bold text-white">Filter</button>
      </form>
      {error ? <p className="rounded-lg bg-red-50 p-4 text-red-800">{error.message}</p> : null}
      <div className="grid gap-4">
        {(data ?? []).map((row) => {
          const customerWhatsApp = row.phone ? String(row.phone).replace(/\D/g, "") : "";
          const message = encodeURIComponent(`Hello ${row.full_name}, regarding your Shields Farms inquiry:`);
          return (
            <article key={row.id} className="rounded-lg bg-white p-5 shadow-sm">
              <div className="flex flex-col gap-3 md:flex-row md:justify-between">
                <div>
                  <h2 className="font-bold text-green-950">{row.full_name}</h2>
                  <p className="text-sm text-stone-600">
                    {row.inquiry_type.replaceAll("_", " ")} · {row.status.replaceAll("_", " ")} · {new Date(row.created_at).toLocaleString("en-NG")}
                  </p>
                  <p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-stone-800">{row.message}</p>
                </div>
                <div className="relative z-10 flex shrink-0 flex-col gap-2 text-sm">
                  <a className="font-bold text-green-800 underline" href={`mailto:${row.email}`}>{row.email}</a>
                  {customerWhatsApp ? <a className="font-bold text-green-800 underline" href={`https://wa.me/${customerWhatsApp}?text=${message}`}>WhatsApp {row.phone}</a> : null}
                </div>
              </div>
              <InquiryActions id={row.id} />
            </article>
          );
        })}
      </div>
      {!error && (data ?? []).length === 0 ? <p className="rounded-lg bg-white p-8 text-center text-stone-600">No inquiries match these filters.</p> : null}
    </div>
  );
}
