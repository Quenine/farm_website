import "server-only";

import { NextResponse } from "next/server";
import { z } from "zod";
import { siteConfig } from "@/src/config/site";
import { emailConfig } from "@/src/lib/email-config";
import { sendEmail } from "@/src/lib/notifications";
import { createAdminSupabaseClient } from "@/src/lib/supabase/admin";
import { createOperationalNotification } from "@/src/lib/operational-notifications";

export const dynamic = "force-dynamic";

const inquirySchema = z.object({
  full_name: z.string().trim().min(2, "Enter your full name.").max(160),
  phone: z.string().trim().max(40).optional(),
  email: z.string().trim().email("Enter a valid email address.").max(254),
  inquiry_type: z.enum(
    ["product_availability", "order_support", "bulk_business_supply", "delivery_question", "partnership", "other"],
    { message: "Choose an inquiry type." },
  ),
  message: z.string().trim().min(10, "Tell us a little more about your inquiry.").max(5000),
  website: z.string().max(0),
});

const storageUnavailable = {
  ok: false,
  saved: false,
  code: "CONTACT_STORAGE_UNAVAILABLE",
  message: "We could not submit your message right now. Please contact Shields Farms through WhatsApp or support@shieldsfarms.store.",
} as const;

function json(body: object, status = 200) {
  return NextResponse.json(body, { status, headers: { "Cache-Control": "no-store" } });
}

function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char] || char);
}

function logStorage(stage: "availability" | "insert" | "timestamps", code?: string) {
  console.error("[Contact Storage Unavailable]", { stage, code: code || "unknown" });
}

async function attemptEmail(stage: "admin_notification" | "customer_acknowledgement", task: () => Promise<boolean>) {
  try {
    return await task();
  } catch {
    console.error("[Contact Email Unavailable]", { stage, provider: emailConfig.provider || "missing", reason: "provider_rejected_or_unavailable" });
    return false;
  }
}

export async function POST(request: Request) {
  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return json({ ok: false, saved: false, code: "VALIDATION_ERROR", message: "Please correct the highlighted fields.", fieldErrors: {} }, 400);
  }

  const submitted = Object.fromEntries(
    ["full_name", "phone", "email", "inquiry_type", "message", "website"].map((key) => [key, String(formData.get(key) ?? "")]),
  );
  const parsed = inquirySchema.safeParse(submitted);
  if (!parsed.success) {
    return json({
      ok: false,
      saved: false,
      code: "VALIDATION_ERROR",
      message: "Please correct the highlighted fields.",
      fieldErrors: parsed.error.flatten().fieldErrors,
    }, 400);
  }

  let supabase: ReturnType<typeof createAdminSupabaseClient>;
  try {
    supabase = createAdminSupabaseClient();
  } catch {
    logStorage("availability", "configuration");
    return json(storageUnavailable, 503);
  }
  let tableCheck;
  try {
    tableCheck = await supabase.from("contact_inquiries").select("id").limit(1);
  } catch {
    logStorage("availability", "request_failed");
    return json(storageUnavailable, 503);
  }
  if (tableCheck.error) {
    logStorage("availability", tableCheck.error.code);
    return json(storageUnavailable, 503);
  }

  const { website: _honeypot, ...inquiry } = parsed.data;
  void _honeypot;
  let inserted;
  try {
    inserted = await supabase.from("contact_inquiries").insert({ ...inquiry, source_path: "/contact" }).select("id").single();
  } catch {
    logStorage("insert", "request_failed");
    return json(storageUnavailable, 503);
  }
  if (inserted.error || !inserted.data?.id) {
    logStorage("insert", inserted.error?.code);
    return json(storageUnavailable, 503);
  }
  const businessSupply = parsed.data.inquiry_type === "bulk_business_supply";
  await createOperationalNotification({ type: "inquiry", severity: businessSupply ? "warning" : "info", event: "new", title: businessSupply ? "Business Supply inquiry needs review" : "New Contact inquiry", message: "A new inquiry is ready for admin review.", targetUrl: "/admin/inquiries", entityType: "contact_inquiry", entityId: inserted.data.id });

  let adminNotified = false;
  let customerAcknowledged = false;
  if (["brevo", "resend", "gmail"].includes(emailConfig.provider) && emailConfig.contactInboxEmail && emailConfig.fromSupport) {
    adminNotified = await attemptEmail("admin_notification", () => sendEmail({
      to: emailConfig.contactInboxEmail,
      from: emailConfig.fromSupport,
      replyTo: parsed.data.email,
      subject: `New ${siteConfig.name} inquiry: ${parsed.data.inquiry_type.replaceAll("_", " ")}`,
      html: `<p><strong>${escapeHtml(parsed.data.full_name)}</strong> submitted an inquiry.</p><p>Email: ${escapeHtml(parsed.data.email)}</p><p>Phone: ${escapeHtml(parsed.data.phone || "Not supplied")}</p><p>${escapeHtml(parsed.data.message).replaceAll("\n", "<br>")}</p>`,
    }));
    customerAcknowledged = await attemptEmail("customer_acknowledgement", () => sendEmail({
      to: parsed.data.email,
      from: emailConfig.fromSupport,
      replyTo: emailConfig.replyToSupport,
      subject: `We received your ${siteConfig.name} inquiry`,
      html: `<p>Hello ${escapeHtml(parsed.data.full_name)},</p><p>Your message has been received. ${siteConfig.name} will respond as soon as possible.</p><p>For urgent requests, contact us through WhatsApp or ${escapeHtml(siteConfig.supportEmail)}.</p>`,
    }));
  } else {
    console.error("[Contact Email Unavailable]", { stage: "configuration", provider: emailConfig.provider || "missing", reason: "provider_or_sender_not_ready" });
  }
  if (!adminNotified) await createOperationalNotification({ type: "system", severity: "warning", event: "contact-email-failed", title: "Contact email delivery unavailable", message: "An inquiry was saved but its operational email needs review.", targetUrl: "/admin/inquiries", entityType: "contact_inquiry", entityId: inserted.data.id });

  try {
    const timestampUpdate = await supabase.from("contact_inquiries").update({
      admin_notified_at: adminNotified ? new Date().toISOString() : null,
      customer_acknowledged_at: customerAcknowledged ? new Date().toISOString() : null,
    }).eq("id", inserted.data.id);
    if (timestampUpdate.error) logStorage("timestamps", timestampUpdate.error.code);
  } catch {
    logStorage("timestamps", "request_failed");
  }

  if (adminNotified && customerAcknowledged) {
    return json({
      ok: true,
      saved: true,
      adminNotified: true,
      customerAcknowledged: true,
      message: "Your message has been received. Shields Farms will respond as soon as possible.",
    });
  }
  return json({
    ok: true,
    saved: true,
    adminNotified,
    customerAcknowledged,
    message: "Your message was saved. For an urgent request, contact Shields Farms through WhatsApp.",
  });
}
