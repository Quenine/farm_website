import "server-only";

import { NextResponse } from "next/server";
import { siteConfig, siteContact } from "@/src/config/site";
import { businessInquiryFieldNames, businessSupplyInquirySchema, inquiryDetails } from "@/src/lib/business-supply-inquiry";
import { emailConfig } from "@/src/lib/email-config";
import { sendEmail } from "@/src/lib/notifications";
import { createOperationalNotification } from "@/src/lib/operational-notifications";
import { createAdminSupabaseClient } from "@/src/lib/supabase/admin";

export const dynamic = "force-dynamic";
const fallback = "We could not save your enquiry right now. Please contact Shields Farms through WhatsApp or support@shieldsfarms.store.";
const labels: Record<string, string> = {
  company_website: "Company website", country: "Company country", city_state: "City or state",
  products_required: "Products required", approximate_quantity: "Approximate quantity", requirement_pattern: "Requirement",
  preferred_date: "Preferred date", quality_packaging: "Quality, size or packaging", additional_information: "Additional information",
  delivery_location: "Delivery location", preferred_frequency: "Preferred frequency", procurement_challenge: "Procurement challenge",
  destination_country: "Destination country", destination_city: "Destination city", destination_port: "Destination port or airport",
  product_grade: "Product variety or grade", preferred_packaging: "Preferred packaging",
  certifications_requirements: "Certifications or import requirements", preferred_incoterm: "Preferred Incoterm",
  expected_order_frequency: "Expected order frequency", payment_expectation: "Payment or trade-finance expectation",
};
const escapeHtml = (value: string) => value.replace(/[&<>"']/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[character] ?? character);
const json = (body: object, status = 200) => NextResponse.json(body, { status, headers: { "Cache-Control": "no-store" } });

export async function POST(request: Request) {
  let formData: FormData;
  try { formData = await request.formData(); } catch { return json({ ok: false, saved: false, message: "Please correct the highlighted fields.", fieldErrors: {} }, 400); }
  const submitted = Object.fromEntries(businessInquiryFieldNames.map((key) => [key, String(formData.get(key) ?? "")]));
  const parsed = businessSupplyInquirySchema.safeParse(submitted);
  if (!parsed.success) return json({ ok: false, saved: false, message: "Please correct the highlighted fields.", fieldErrors: parsed.error.flatten().fieldErrors }, 400);

  const value = parsed.data;
  const details: Record<string, unknown> = inquiryDetails(value);
  let attribution: unknown = null;
  try { attribution = value.attribution ? JSON.parse(value.attribution) : null; } catch { attribution = null; }
  if (attribution && typeof attribution === "object") details.marketing_attribution = attribution;
  const message = [
    `${value.products_required} — ${value.approximate_quantity}`,
    value.additional_information,
  ].filter(Boolean).join("\n\n");

  let database: ReturnType<typeof createAdminSupabaseClient>;
  try { database = createAdminSupabaseClient(); } catch { return json({ ok: false, saved: false, message: fallback }, 503); }
  let inserted;
  try {
    inserted = await database.from("contact_inquiries").insert({
      full_name: value.contact_person, phone: value.phone, email: value.email,
      inquiry_type: value.inquiry_type, message, source_path: "/business-supply",
      company_name: value.company_name, inquiry_details: details,
    }).select("id").single();
  } catch { return json({ ok: false, saved: false, message: fallback }, 503); }
  if (inserted.error || !inserted.data?.id) return json({ ok: false, saved: false, message: fallback }, 503);

  await createOperationalNotification({
    type: "inquiry", severity: "warning", event: "new", title: value.inquiry_type === "export_supply" ? "Export enquiry needs review" : "Business supply enquiry needs review",
    message: `${value.company_name} submitted a new requirement.`, targetUrl: "/admin/inquiries", entityType: "contact_inquiry", entityId: inserted.data.id,
  });
  const detailHtml = Object.entries(details).filter(([key]) => key !== "marketing_attribution").map(([key, item]) => `<tr><th align="left">${escapeHtml(labels[key] ?? key.replaceAll("_", " "))}</th><td>${escapeHtml(String(item)).replaceAll("\n", "<br>")}</td></tr>`).join("");
  let adminNotified = false;
  let customerAcknowledged = false;
  if (["brevo", "resend", "gmail"].includes(emailConfig.provider) && emailConfig.contactInboxEmail && emailConfig.fromSupport) {
    try {
      adminNotified = await sendEmail({ to: emailConfig.contactInboxEmail, from: emailConfig.fromSupport, replyTo: value.email,
        subject: `New ${siteConfig.name} ${value.inquiry_type === "export_supply" ? "export" : "business-supply"} enquiry from ${value.company_name}`,
        html: `<p><strong>${escapeHtml(value.company_name)}</strong></p><p>Contact: ${escapeHtml(value.contact_person)} · ${escapeHtml(value.email)} · ${escapeHtml(value.phone)}</p><table cellpadding="6">${detailHtml}</table>` });
    } catch { adminNotified = false; }
    try {
      customerAcknowledged = await sendEmail({ to: value.email, from: emailConfig.fromSupport, replyTo: emailConfig.replyToSupport,
        subject: `We received your ${siteConfig.name} supply enquiry`,
        html: `<p>Hello ${escapeHtml(value.contact_person)},</p><p>We received your enquiry for ${escapeHtml(value.company_name)} and are assessing it.</p><p>This is not yet an accepted order or quotation. Availability, specifications, compliance requirements and logistics must be reviewed before a commercial offer.</p><p>For urgent communication, continue through our <a href="${escapeHtml(siteContact.whatsappHref)}">official WhatsApp channel</a>.</p>` });
    } catch { customerAcknowledged = false; }
  }
  if (!adminNotified) await createOperationalNotification({ type: "system", severity: "warning", event: "business-enquiry-email-failed", title: "Business enquiry email unavailable", message: "The enquiry was saved and needs review in Admin.", targetUrl: "/admin/inquiries", entityType: "contact_inquiry", entityId: inserted.data.id });
  try {
    await database.from("contact_inquiries").update({
      admin_notified_at: adminNotified ? new Date().toISOString() : null,
      customer_acknowledged_at: customerAcknowledged ? new Date().toISOString() : null,
    }).eq("id", inserted.data.id);
  } catch { /* Persistence already succeeded. */ }
  return json({ ok: true, saved: true, adminNotified, customerAcknowledged, message: "Your enquiry has been received and is being assessed. It is not yet an accepted order or quotation." });
}
