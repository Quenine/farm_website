"use client";

import { FormEvent, useRef, useState } from "react";
import { getAttributionSnapshot, trackLead } from "@/src/lib/analytics";
import { siteContact } from "@/src/config/site";

type ResponseState = { ok: boolean; saved: boolean; message: string; fieldErrors?: Record<string, string[]> };
const initial = { inquiry_type: "", company_name: "", contact_person: "", email: "", phone: "", company_website: "", country: "Nigeria", city_state: "", products_required: "", approximate_quantity: "", requirement_pattern: "", preferred_date: "", quality_packaging: "", additional_information: "", delivery_location: "", preferred_frequency: "", procurement_challenge: "", destination_country: "", destination_city: "", destination_port: "", product_grade: "", preferred_packaging: "", certifications_requirements: "", preferred_incoterm: "", expected_order_frequency: "", payment_expectation: "", acknowledgement: false, website: "" };
type Values = typeof initial;

export function BusinessSupplyForm() {
  const [values, setValues] = useState<Values>(initial);
  const [result, setResult] = useState<ResponseState | null>(null);
  const [pending, setPending] = useState(false);
  const submitting = useRef(false);
  const set = (name: keyof Values, value: string | boolean) => setValues((current) => ({ ...current, [name]: value }));
  const error = (name: string) => result?.fieldErrors?.[name]?.[0];
  const exportEnquiry = values.inquiry_type === "export_supply";

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitting.current) return;
    submitting.current = true; setPending(true); setResult(null);
    const data = new FormData(event.currentTarget);
    data.set("acknowledgement", values.acknowledgement ? "yes" : "");
    data.set("attribution", JSON.stringify(getAttributionSnapshot()));
    try {
      const response = await fetch("/api/business-supply/inquiries", { method: "POST", body: data });
      const body = response.headers.get("content-type")?.includes("application/json") ? await response.json() as ResponseState : null;
      if (!body || typeof body.saved !== "boolean") setResult({ ok: false, saved: false, message: "We could not submit your enquiry. Please use WhatsApp or email support@shieldsfarms.store." });
      else {
        setResult(body);
        if (body.saved) { setValues(initial); trackLead(exportEnquiry ? "export_supply" : "business_supply"); }
      }
    } catch { setResult({ ok: false, saved: false, message: "Network access is unavailable. Please try again or use WhatsApp." }); }
    finally { submitting.current = false; setPending(false); }
  }

  return (
    <form onSubmit={submit} noValidate className="rounded-2xl border border-green-900/10 bg-white p-5 shadow-sm sm:p-8">
      <div className="absolute -left-[9999px]" aria-hidden="true"><label>Website<input name="website" value={values.website} onChange={(event) => set("website", event.target.value)} tabIndex={-1} autoComplete="off" /></label></div>
      <fieldset>
        <legend className="text-lg font-bold text-green-950">What kind of supply do you need? *</legend>
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <Choice name="inquiry_type" value="bulk_business_supply" checked={values.inquiry_type === "bulk_business_supply"} onChange={() => set("inquiry_type", "bulk_business_supply")} label="Nigerian business supply" />
          <Choice name="inquiry_type" value="export_supply" checked={exportEnquiry} onChange={() => { set("inquiry_type", "export_supply"); if (values.country === "Nigeria") set("country", ""); }} label="International export enquiry" />
        </div>
        <ErrorText id="inquiry_type-error" message={error("inquiry_type")} />
      </fieldset>
      <div aria-live="polite" className="mt-5">{result?.message ? <p role="status" className={`rounded-lg p-4 text-sm font-semibold ${result.ok ? "bg-green-50 text-green-950" : "bg-red-50 text-red-800"}`}>{result.message}</p> : null}</div>
      <div className="mt-6 grid gap-5 sm:grid-cols-2">
        <Field name="company_name" label="Company or business name *" value={values.company_name} set={set} error={error("company_name")} />
        <Field name="contact_person" label="Contact person *" value={values.contact_person} set={set} error={error("contact_person")} />
        <Field name="email" type="email" label="Business email *" value={values.email} set={set} error={error("email")} />
        <Field name="phone" type="tel" label="Phone or WhatsApp number *" value={values.phone} set={set} error={error("phone")} />
        <Field name="company_website" type="url" label="Company website (optional)" value={values.company_website} set={set} error={error("company_website")} />
        <Field name="country" label="Country *" value={values.country} set={set} error={error("country")} />
        <Field name="city_state" label="City or state *" value={values.city_state} set={set} error={error("city_state")} />
        <Field name="products_required" label="Products required *" value={values.products_required} set={set} error={error("products_required")} />
        <Field name="approximate_quantity" label="Approximate quantity and unit *" placeholder="e.g. 500 kg or 200 crates" value={values.approximate_quantity} set={set} error={error("approximate_quantity")} />
        <Select name="requirement_pattern" label="One-time or recurring requirement *" value={values.requirement_pattern} set={set} options={["One-time", "Recurring"]} error={error("requirement_pattern")} />
        <Field name="preferred_date" type="date" label="Preferred supply or delivery date (optional)" value={values.preferred_date} set={set} error={error("preferred_date")} />
        <Field name="quality_packaging" label="Quality, grade, size or packaging preference (optional)" value={values.quality_packaging} set={set} error={error("quality_packaging")} />
      </div>
      {values.inquiry_type === "bulk_business_supply" ? (
        <fieldset className="mt-8 border-t border-stone-200 pt-6"><legend className="px-2 text-lg font-bold text-green-950">Nigerian supply details</legend><div className="grid gap-5 sm:grid-cols-2">
          <Field name="delivery_location" label="Delivery location *" value={values.delivery_location} set={set} error={error("delivery_location")} />
          <Select name="preferred_frequency" label="Preferred frequency *" value={values.preferred_frequency} set={set} options={["One-time", "Weekly", "Every two weeks", "Monthly", "Other recurring schedule"]} error={error("preferred_frequency")} />
          <Field name="procurement_challenge" label="Current procurement challenge (optional)" value={values.procurement_challenge} set={set} error={error("procurement_challenge")} />
        </div></fieldset>
      ) : null}
      {exportEnquiry ? (
        <fieldset className="mt-8 border-t border-stone-200 pt-6"><legend className="px-2 text-lg font-bold text-green-950">Export requirement details</legend><div className="grid gap-5 sm:grid-cols-2">
          <Field name="destination_country" label="Destination country *" value={values.destination_country} set={set} error={error("destination_country")} />
          <Field name="destination_city" label="Destination city *" value={values.destination_city} set={set} error={error("destination_city")} />
          <Field name="destination_port" label="Destination port or airport (optional)" value={values.destination_port} set={set} error={error("destination_port")} />
          <Field name="product_grade" label="Product variety or grade (optional)" value={values.product_grade} set={set} error={error("product_grade")} />
          <Field name="preferred_packaging" label="Preferred packaging (optional)" value={values.preferred_packaging} set={set} error={error("preferred_packaging")} />
          <Field name="certifications_requirements" label="Required certifications or buyer import requirements (optional)" value={values.certifications_requirements} set={set} error={error("certifications_requirements")} />
          <Field name="preferred_incoterm" label="Preferred Incoterm, if known (optional)" value={values.preferred_incoterm} set={set} error={error("preferred_incoterm")} />
          <Field name="expected_order_frequency" label="Expected order frequency *" value={values.expected_order_frequency} set={set} error={error("expected_order_frequency")} />
          <Field name="payment_expectation" label="Payment or trade-finance expectation (optional)" value={values.payment_expectation} set={set} error={error("payment_expectation")} />
        </div></fieldset>
      ) : null}
      <div className="mt-5"><Field name="additional_information" textarea label="Additional information (optional)" value={values.additional_information} set={set} error={error("additional_information")} /></div>
      <label className="mt-6 flex items-start gap-3 rounded-lg bg-[#f3ead8] p-4 text-sm font-semibold text-stone-800">
        <input name="acknowledgement" type="checkbox" checked={values.acknowledgement} onChange={(event) => set("acknowledgement", event.target.checked)} aria-invalid={Boolean(error("acknowledgement"))} aria-describedby={error("acknowledgement") ? "acknowledgement-error" : undefined} className="mt-1 size-4 accent-green-800" />
        I understand that this is an enquiry and not a confirmed order or quotation.
      </label>
      <ErrorText id="acknowledgement-error" message={error("acknowledgement")} />
      <button disabled={pending} className="mt-6 h-12 w-full rounded-full bg-green-800 px-6 text-sm font-bold text-white transition hover:bg-green-900 focus-visible:outline-2 focus-visible:outline-offset-2 disabled:cursor-wait disabled:opacity-60">{pending ? "Submitting enquiry…" : "Submit supply enquiry"}</button>
      <p className="mt-4 text-center text-sm text-stone-600">Urgent? <a className="font-bold text-green-800 underline" href={siteContact.whatsappHref}>Contact Shields Farms on WhatsApp</a>.</p>
    </form>
  );
}

function Field({ name, label, type = "text", value, set, error, placeholder, textarea = false }: { name: keyof Values; label: string; type?: string; value: string; set: (name: keyof Values, value: string) => void; error?: string; placeholder?: string; textarea?: boolean }) {
  const id = `business-${name}`; const classes = "rounded-lg border border-stone-300 bg-white px-4 py-3 focus:border-green-700 focus:outline-2 focus:outline-green-700";
  return <label htmlFor={id} className="grid gap-2 text-sm font-semibold text-stone-800">{label}{textarea ? <textarea id={id} name={name} rows={5} value={value} onChange={(e) => set(name, e.target.value)} aria-invalid={Boolean(error)} aria-describedby={error ? `${id}-error` : undefined} className={classes} /> : <input id={id} name={name} type={type} value={value} placeholder={placeholder} onChange={(e) => set(name, e.target.value)} aria-invalid={Boolean(error)} aria-describedby={error ? `${id}-error` : undefined} className={`h-12 ${classes}`} />}<ErrorText id={`${id}-error`} message={error} /></label>;
}
function Select({ name, label, value, set, options, error }: { name: keyof Values; label: string; value: string; set: (name: keyof Values, value: string) => void; options: string[]; error?: string }) {
  const id = `business-${name}`; return <label htmlFor={id} className="grid gap-2 text-sm font-semibold text-stone-800">{label}<select id={id} name={name} value={value} onChange={(e) => set(name, e.target.value)} aria-invalid={Boolean(error)} aria-describedby={error ? `${id}-error` : undefined} className="h-12 rounded-lg border border-stone-300 bg-white px-4 focus:outline-2 focus:outline-green-700"><option value="">Choose one</option>{options.map((option) => <option key={option}>{option}</option>)}</select><ErrorText id={`${id}-error`} message={error} /></label>;
}
function Choice(props: { name: string; value: string; checked: boolean; onChange: () => void; label: string }) { return <label className={`flex cursor-pointer items-center gap-3 rounded-lg border p-4 font-semibold ${props.checked ? "border-green-800 bg-green-50 text-green-950" : "border-stone-300"}`}><input type="radio" {...props} className="size-4 accent-green-800" />{props.label}</label>; }
function ErrorText({ id, message }: { id: string; message?: string }) { return message ? <span id={id} className="text-xs font-bold text-red-700">{message}</span> : null; }

