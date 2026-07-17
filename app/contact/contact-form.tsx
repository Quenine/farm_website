"use client";

import { FormEvent, useRef, useState } from "react";

const inquiryTypes = [
  ["product_availability", "Product availability"],
  ["order_support", "Order support"],
  ["bulk_business_supply", "Bulk/business supply"],
  ["delivery_question", "Delivery question"],
  ["partnership", "Partnership"],
  ["other", "Other"],
] as const;
const emptyValues = { full_name: "", phone: "", email: "", inquiry_type: "", message: "", website: "" };
type Values = typeof emptyValues;
type ContactResponse = {
  ok: boolean;
  saved: boolean;
  message: string;
  fieldErrors?: Record<string, string[]>;
};

export function ContactForm() {
  const [values, setValues] = useState<Values>(emptyValues);
  const [result, setResult] = useState<ContactResponse | null>(null);
  const [pending, setPending] = useState(false);
  const submitting = useRef(false);
  const fieldError = (name: string) => result?.fieldErrors?.[name]?.[0];
  const update = (name: keyof Values, value: string) => setValues((current) => ({ ...current, [name]: value }));

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitting.current) return;
    submitting.current = true;
    setPending(true);
    setResult(null);
    try {
      const response = await fetch("/api/contact/inquiries", { method: "POST", body: new FormData(event.currentTarget) });
      const contentType = response.headers.get("content-type") || "";
      if (!contentType.includes("application/json")) {
        setResult({ ok: false, saved: false, message: "We could not submit your message right now. Please contact Shields Farms through WhatsApp or support@shieldsfarms.store." });
        return;
      }
      const body = await response.json() as ContactResponse;
      if (!body || typeof body.ok !== "boolean" || typeof body.saved !== "boolean" || typeof body.message !== "string") {
        setResult({ ok: false, saved: false, message: "We could not submit your message right now. Please contact Shields Farms through WhatsApp or support@shieldsfarms.store." });
        return;
      }
      setResult(body);
      if (body.saved) setValues(emptyValues);
    } catch {
      setResult({ ok: false, saved: false, message: "Network access is unavailable. Please try again or contact Shields Farms through WhatsApp." });
    } finally {
      submitting.current = false;
      setPending(false);
    }
  }

  return (
    <form onSubmit={submit} className="grid gap-5 rounded-lg bg-white p-6 shadow-sm" noValidate>
      <div className="absolute -left-[9999px]" aria-hidden="true">
        <label>Website<input name="website" value={values.website} onChange={(event) => update("website", event.target.value)} tabIndex={-1} autoComplete="off" /></label>
      </div>
      <p className="rounded-lg bg-amber-50 p-3 text-sm font-semibold leading-6 text-amber-900">For urgent orders, call or WhatsApp Shields Farms directly.</p>
      <div aria-live="polite" aria-atomic="true">
        {result?.message ? <p role="status" className={`rounded-lg p-3 text-sm font-bold ${result.ok ? "bg-green-50 text-green-900" : "bg-red-50 text-red-800"}`}>{result.message}</p> : null}
      </div>
      <div className="grid gap-5 md:grid-cols-2">
        <Field name="full_name" label="Full name *" value={values.full_name} onChange={(value) => update("full_name", value)} error={fieldError("full_name")} />
        <Field name="phone" label="Phone number" value={values.phone} onChange={(value) => update("phone", value)} error={fieldError("phone")} />
      </div>
      <Field name="email" label="Email *" type="email" value={values.email} onChange={(value) => update("email", value)} error={fieldError("email")} />
      <label className="grid gap-2 text-sm font-semibold text-stone-800">
        Inquiry type *
        <select name="inquiry_type" value={values.inquiry_type} onChange={(event) => update("inquiry_type", event.target.value)} aria-invalid={fieldError("inquiry_type") ? true : undefined} className="h-12 rounded-lg border border-stone-200 px-4">
          <option value="">Choose one</option>
          {inquiryTypes.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
        </select>
        {fieldError("inquiry_type") ? <span className="text-xs font-bold text-red-700">{fieldError("inquiry_type")}</span> : null}
      </label>
      <label className="grid gap-2 text-sm font-semibold text-stone-800">
        Message *
        <textarea name="message" value={values.message} onChange={(event) => update("message", event.target.value)} rows={6} aria-invalid={fieldError("message") ? true : undefined} className="rounded-lg border border-stone-200 px-4 py-3" />
        {fieldError("message") ? <span className="text-xs font-bold text-red-700">{fieldError("message")}</span> : null}
      </label>
      <button type="submit" disabled={pending} className="h-12 rounded-full bg-green-800 px-6 text-sm font-bold text-white disabled:opacity-60">{pending ? "Sending..." : "Send message"}</button>
    </form>
  );
}

function Field({ name, label, type = "text", value, onChange, error }: { name: string; label: string; type?: string; value: string; onChange: (value: string) => void; error?: string }) {
  return <label className="grid gap-2 text-sm font-semibold text-stone-800">{label}<input name={name} type={type} value={value} onChange={(event) => onChange(event.target.value)} aria-invalid={error ? true : undefined} className="h-12 rounded-lg border border-stone-200 px-4" />{error ? <span className="text-xs font-bold text-red-700">{error}</span> : null}</label>;
}
