import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, Check, Globe2, MessageCircle } from "lucide-react";
import { PageShell } from "@/src/components/ui";
import { siteConfig, whatsappUrl } from "@/src/config/site";
import { BusinessSupplyForm } from "./business-supply-form";

export const metadata: Metadata = {
  title: "Business & Export Supply | Shields Farms",
  description: "Request recurring farm produce supply for your Nigerian business or submit an international buyer enquiry for selected Nigerian agricultural produce.",
  openGraph: { title: "Business & Export Supply | Shields Farms", description: "Request Nigerian business supply or submit an international buyer enquiry for selected Nigerian agricultural produce.", url: "/business-supply", type: "website" },
};

const businesses = ["Restaurants and food vendors", "Hotels and hospitality businesses", "Caterers and event kitchens", "Supermarkets and food retailers", "Food processors and distributors", "Schools, offices and institutional kitchens"];
const categories = ["Poultry and eggs", "Potatoes and tubers", "Tomatoes, onions and peppers", "Fresh vegetables", "Selected fruits and other produce"];
const benefits = ["One-time and recurring supply discussions", "Bulk and practical quantity support", "Current availability confirmed before commitment", "Product, size and packaging preferences recorded", "Trial-order option before a recurring arrangement", "Delivery or pickup assessed by location and product suitability", "Written quotation based on the buyer’s actual requirement"];
const domesticSteps = [
  ["Share requirements", "Provide products, quantities, preferred quality or packaging, location and required date."],
  ["Availability assessment", "We confirm sourcing, current availability and fulfilment feasibility."],
  ["Quotation and trial supply", "Receive commercial terms and, where suitable, begin with a paid trial order."],
  ["Recurring arrangement", "After a successful trial, agree quantities, frequency and delivery expectations."],
];
const exportSteps = [
  ["Buyer brief", "We receive company details, destination, product specification, quantity, packaging and schedule."],
  ["Feasibility review", "We assess sourcing capacity, product suitability, destination requirements, expected shelf life and logistics."],
  ["Compliance and documentation review", "We identify applicable inspections, certificates, buyer documents and destination requirements."],
  ["Commercial offer", "A quotation follows only when product, quantity, packaging, delivery basis and payment expectations are sufficiently clear."],
  ["Pre-shipment coordination", "Agreed quality checks, packaging, inspection, documentation and logistics are coordinated before shipment."],
];

export default function BusinessSupplyPage() {
  const message = `Hello ${siteConfig.name}, I want to discuss a business or export supply enquiry. ${siteConfig.url.replace(/\/$/, "")}/business-supply`;
  return <PageShell><main>
    <section className="border-b border-green-950/10 bg-[#f3ead8]"><div className="mx-auto grid max-w-7xl gap-10 px-4 py-14 sm:px-6 lg:grid-cols-[1.15fr_0.85fr] lg:px-8 lg:py-20">
      <div><p className="text-sm font-bold uppercase tracking-[0.18em] text-green-700">Business &amp; Export Supply</p><h1 className="mt-4 max-w-4xl text-4xl font-bold tracking-tight text-green-950 sm:text-5xl lg:text-6xl">Reliable produce supply for growing businesses—within Nigeria and beyond.</h1><p className="mt-6 max-w-3xl text-lg leading-8 text-stone-700">Shields Farms helps food businesses and qualified international buyers source selected poultry and agricultural produce. Tell us what you need, the quantity, destination and schedule, and we will assess availability, specifications, compliance requirements and logistics before issuing a quote.</p>
        <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:flex-wrap"><a href="#supply-enquiry" className="inline-flex h-12 items-center justify-center rounded-full bg-green-800 px-6 text-sm font-bold text-white">Request business supply</a><a href="#export-enquiries" className="inline-flex h-12 items-center justify-center rounded-full border border-green-800 px-6 text-sm font-bold text-green-950">Submit an export enquiry</a><Link href="/shop" className="inline-flex h-12 items-center justify-center gap-2 px-3 text-sm font-bold text-green-800 underline">Browse current products <ArrowRight size={16} /></Link></div>
      </div><aside className="self-end rounded-2xl border border-amber-900/20 bg-white/70 p-6" aria-label="Export enquiry notice"><Globe2 className="text-green-800" /><p className="mt-4 font-bold text-green-950">Export enquiries are assessed individually.</p><p className="mt-2 text-sm leading-6 text-stone-700">International fulfilment is confirmed only after reviewing the product, required volume, destination, quality specification, packaging, documentation and logistics.</p></aside>
    </div></section>

    <section className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8" aria-labelledby="domestic-heading"><div className="grid gap-10 lg:grid-cols-[0.9fr_1.1fr]">
      <div><Eyebrow>Domestic business supply</Eyebrow><h2 id="domestic-heading" className="mt-3 text-3xl font-bold text-green-950 sm:text-4xl">A practical supply partner for food businesses</h2><p className="mt-5 leading-7 text-stone-700">Whether a buyer needs a one-time restock or recurring supply, Shields Farms works from a clear product list, quantity, quality preference, delivery location and schedule before confirming availability and commercial terms.</p></div>
      <div className="grid gap-x-8 gap-y-3 sm:grid-cols-2">{businesses.map((item) => <p key={item} className="flex gap-3 border-b border-stone-200 pb-3 font-semibold text-stone-800"><Check className="mt-0.5 shrink-0 text-green-700" size={18} />{item}</p>)}</div>
    </div></section>

    <section className="bg-green-950 py-16 text-white" aria-labelledby="categories-heading"><div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8"><div className="grid gap-10 lg:grid-cols-[0.75fr_1.25fr]">
      <div><Eyebrow light>Products &amp; supply categories</Eyebrow><h2 id="categories-heading" className="mt-3 text-3xl font-bold">Discuss the requirement, then confirm stock</h2><p className="mt-4 leading-7 text-green-50">These categories indicate the kinds of supply discussions we accept; they are not a guarantee of current stock.</p><Link href="/shop" className="mt-6 inline-flex items-center gap-2 font-bold text-green-200 underline">See currently listed products <ArrowRight size={16} /></Link></div>
      <div className="divide-y divide-green-800 border-y border-green-800">{categories.map((item, index) => <div key={item} className="flex items-center gap-5 py-4"><span className="font-mono text-sm text-green-300">0{index + 1}</span><p className="text-xl font-semibold">{item}</p></div>)}</div>
    </div><div className="mt-12 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{benefits.map((item) => <p key={item} className="flex gap-3 text-sm leading-6 text-green-50"><Check className="mt-1 shrink-0 text-green-300" size={16} />{item}</p>)}</div></div></section>

    <ProcessSection eyebrow="How domestic supply works" title="From requirement to a workable arrangement" steps={domesticSteps} />

    <section id="export-enquiries" className="scroll-mt-20 border-y border-green-950/10 bg-[#f3ead8] py-16" aria-labelledby="export-heading"><div className="mx-auto grid max-w-7xl gap-10 px-4 sm:px-6 lg:grid-cols-2 lg:px-8">
      <div><Eyebrow>International buyers</Eyebrow><h2 id="export-heading" className="mt-3 text-3xl font-bold text-green-950 sm:text-4xl">Export enquiries for selected Nigerian agricultural produce</h2><p className="mt-5 leading-7 text-stone-700">Shields Farms welcomes enquiries from importers, wholesalers, food processors, distributors and diaspora-focused retailers. Each opportunity is reviewed according to the requested product, specification, volume, destination-country requirements, packaging, inspection or certification needs, freight feasibility and commercial terms.</p><p className="mt-5 leading-7 text-stone-700">International buyers may enquire about ginger, onions, potatoes, peppers and other selected Nigerian agricultural produce. Availability and export suitability are confirmed for each request.</p></div>
      <aside className="rounded-2xl bg-white p-6 shadow-sm"><p className="font-bold text-green-950">Important commercial notice</p><p className="mt-3 leading-7 text-stone-700">Submitting an export enquiry does not confirm availability, export eligibility, shipping, pricing or acceptance of an order. A commercial offer is issued only after the requirement and fulfilment route have been assessed.</p></aside>
    </div></section>

    <ProcessSection eyebrow="Export enquiry assessment" title="A five-stage feasibility review" steps={exportSteps} note="This process overview is not legal or regulatory advice." />

    <section id="supply-enquiry" className="scroll-mt-20 bg-[#eee4d0] py-16" aria-labelledby="form-heading"><div className="mx-auto grid max-w-7xl gap-10 px-4 sm:px-6 lg:grid-cols-[0.7fr_1.3fr] lg:px-8">
      <div><Eyebrow>Business &amp; export enquiry</Eyebrow><h2 id="form-heading" className="mt-3 text-3xl font-bold text-green-950 sm:text-4xl">Give us a clear buyer brief</h2><p className="mt-5 leading-7 text-stone-700">The more specific your product, quantity, destination, packaging and schedule, the more useful our assessment can be. Submission is an enquiry only—not a confirmed order or quote.</p></div><BusinessSupplyForm />
    </div></section>

    <section className="mx-auto max-w-7xl px-4 py-14 sm:px-6 lg:px-8"><div className="flex flex-col justify-between gap-6 rounded-2xl bg-green-950 p-7 text-white md:flex-row md:items-center"><div><h2 className="text-2xl font-bold">Need to discuss the requirement directly?</h2><p className="mt-2 text-green-100">Use the official WhatsApp channel for urgent enquiries, or send a general message through our contact page.</p></div><div className="flex flex-col gap-3 sm:flex-row"><a href={whatsappUrl(message)} className="inline-flex h-12 items-center justify-center gap-2 rounded-full bg-white px-5 text-sm font-bold text-green-950"><MessageCircle size={18} />WhatsApp</a><Link href="/contact" className="inline-flex h-12 items-center justify-center rounded-full border border-green-200 px-5 text-sm font-bold">Contact Shields Farms</Link></div></div></section>
  </main></PageShell>;
}

function Eyebrow({ children, light = false }: { children: React.ReactNode; light?: boolean }) { return <p className={`text-sm font-bold uppercase tracking-widest ${light ? "text-green-300" : "text-green-700"}`}>{children}</p>; }
function ProcessSection({ eyebrow, title, steps, note }: { eyebrow: string; title: string; steps: string[][]; note?: string }) { return <section className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8"><Eyebrow>{eyebrow}</Eyebrow><h2 className="mt-3 max-w-3xl text-3xl font-bold text-green-950 sm:text-4xl">{title}</h2><ol className={`mt-10 grid gap-8 md:grid-cols-2 ${steps.length === 5 ? "lg:grid-cols-5" : "lg:grid-cols-4"}`}>{steps.map(([heading, body], index) => <li key={heading}><span className="font-mono text-sm font-bold text-green-700">{String(index + 1).padStart(2, "0")}</span><h3 className="mt-3 text-xl font-bold text-green-950">{heading}</h3><p className="mt-2 text-sm leading-6 text-stone-700">{body}</p></li>)}</ol>{note ? <p className="mt-8 text-sm italic text-stone-600">{note}</p> : null}</section>; }
