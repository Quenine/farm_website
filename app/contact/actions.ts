"use server";

import "server-only";
import { z } from "zod";
import { createAdminSupabaseClient } from "@/src/lib/supabase/admin";
import { emailConfig } from "@/src/lib/email-config";
import { sendEmail } from "@/src/lib/notifications";
import { siteConfig } from "@/src/config/site";

const schema = z.object({
  full_name: z.string().trim().min(2, "Enter your full name.").max(160),
  phone: z.string().trim().max(40).optional(),
  email: z.string().trim().email("Enter a valid email address.").max(254),
  inquiry_type: z.enum(["product_availability","order_support","bulk_business_supply","delivery_question","partnership","other"], { message: "Choose an inquiry type." }),
  message: z.string().trim().min(10, "Tell us a little more about your inquiry.").max(5000),
  website: z.string().max(0),
});
export type ContactState = { ok: boolean; delivered: boolean; message: string; fieldErrors: Record<string, string[]>; values: Record<string, string> };
export const initialContactState: ContactState = { ok: false, delivered: false, message: "", fieldErrors: {}, values: {} };
function escapeHtml(value: string) { return value.replace(/[&<>"']/g, (char) => ({ "&":"&amp;", "<":"&lt;", ">":"&gt;", '"':"&quot;", "'":"&#39;" })[char] || char); }

export async function submitContactInquiry(_: ContactState, formData: FormData): Promise<ContactState> {
  const values = Object.fromEntries(["full_name","phone","email","inquiry_type","message"].map((key) => [key, String(formData.get(key) ?? "")]));
  const parsed = schema.safeParse({ ...values, website: String(formData.get("website") ?? "") });
  if (!parsed.success) return { ok: false, delivered: false, message: "Please correct the highlighted fields.", fieldErrors: parsed.error.flatten().fieldErrors as Record<string, string[]>, values };
  try {
    const supabase = createAdminSupabaseClient();
    const { website: _honeypot, ...inquiry } = parsed.data;
    void _honeypot;
    const inserted = await supabase.from("contact_inquiries").insert({ ...inquiry, source_path: "/contact" }).select("id").single();
    if (inserted.error) throw new Error(inserted.error.message);
    let adminSent = false; let customerSent = false;
    if (emailConfig.contactInboxEmail && emailConfig.fromSupport) {
      adminSent = await sendEmail({ to: emailConfig.contactInboxEmail, from: emailConfig.fromSupport, replyTo: parsed.data.email, subject: `New ${siteConfig.name} inquiry: ${parsed.data.inquiry_type.replaceAll("_", " ")}`, html: `<p><strong>${escapeHtml(parsed.data.full_name)}</strong> submitted an inquiry.</p><p>Email: ${escapeHtml(parsed.data.email)}</p><p>Phone: ${escapeHtml(parsed.data.phone || "Not supplied")}</p><p>${escapeHtml(parsed.data.message).replaceAll("\n", "<br>")}</p>` });
      customerSent = await sendEmail({ to: parsed.data.email, from: emailConfig.fromSupport, replyTo: emailConfig.replyToSupport, subject: `We received your ${siteConfig.name} inquiry`, html: `<p>Hello ${escapeHtml(parsed.data.full_name)},</p><p>Your message has been received. ${siteConfig.name} will respond as soon as possible.</p><p>For urgent requests, contact us on WhatsApp or email ${escapeHtml(siteConfig.supportEmail)}.</p>` });
    }
    await supabase.from("contact_inquiries").update({ admin_notified_at: adminSent ? new Date().toISOString() : null, customer_acknowledged_at: customerSent ? new Date().toISOString() : null }).eq("id", inserted.data.id);
    if (!adminSent) {
      console.error("[Contact Inquiry Email Unavailable]", { inquiryId: inserted.data.id, providerConfigured: Boolean(emailConfig.provider), inboxConfigured: Boolean(emailConfig.contactInboxEmail) });
      return { ok: true, delivered: false, message: `Your inquiry was saved, but email delivery is currently unavailable. Please email ${siteConfig.supportEmail} or use WhatsApp for an urgent request.`, fieldErrors: {}, values };
    }
    return { ok: true, delivered: true, message: "Your message has been received. Shields Farms will respond as soon as possible.", fieldErrors: {}, values: {} };
  } catch (error) {
    console.error("[Contact Inquiry Failed]", { reason: error instanceof Error ? error.message : "unknown" });
    return { ok: false, delivered: false, message: `We could not record your inquiry. Please email ${siteConfig.supportEmail} or use WhatsApp.`, fieldErrors: {}, values };
  }
}
