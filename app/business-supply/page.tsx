import type { Metadata } from "next";
import Link from "next/link";
import { ShoppingBasket, Truck, ClipboardCheck } from "lucide-react";
import { PageShell, SectionHeader } from "@/src/components/ui";
import { BusinessSupplyWhatsappCta } from "@/src/components/business-supply-whatsapp-cta";
import { siteConfig, whatsappUrl } from "@/src/config/site";

export const metadata: Metadata = {
  title: "Business Supply",
  description: `Recurring farm produce supply for restaurants, caterers, bukas, meal-prep businesses, food vendors, and small retailers from ${siteConfig.name}.`,
  openGraph: {
    title: `${siteConfig.name} Business Supply`,
    description: "Chicken, tomatoes, pepper, Irish potatoes, bell peppers, and other produce for food businesses.",
    url: "/business-supply",
  },
};

const heroProducts = ["Chicken", "Tomatoes", "Pepper", "Irish Potatoes", "Bell Peppers"];
const benefits = [
  "Clear online ordering",
  "Delivery and pickup options",
  "Order tracking",
  "Recurring supply discussion",
  "Bulk quantity support",
];

export default function BusinessSupplyPage() {
  const message = `Hello ${siteConfig.name}, I want to discuss recurring supply for my food business. I found this page: ${siteConfig.url.replace(/\/$/, "")}/business-supply`;
  return (
    <PageShell>
      <section className="bg-[#f3ead8]">
        <div className="mx-auto grid max-w-7xl gap-8 px-4 py-14 sm:px-6 lg:grid-cols-[1.1fr_0.9fr] lg:px-8 lg:py-18">
          <div>
            <p className="text-sm font-bold uppercase tracking-[0.18em] text-green-700">Business Supply</p>
            <h1 className="mt-4 text-4xl font-bold tracking-tight text-green-950 sm:text-6xl">Reliable recurring farm supply for food businesses.</h1>
            <p className="mt-5 max-w-2xl text-lg leading-8 text-stone-700">
              {siteConfig.name} supports restaurants, caterers, bukas, meal-prep businesses, food vendors, and small retailers with practical ordering for chicken, tomatoes, pepper, potatoes, bell peppers, and other farm produce.
            </p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <Link href="/shop" className="inline-flex h-12 items-center justify-center rounded-full bg-green-800 px-6 text-sm font-bold text-white">Browse the shop</Link>
              <BusinessSupplyWhatsappCta href={whatsappUrl(message)} />
            </div>
          </div>
          <div className="grid content-center gap-3">
            {heroProducts.map((product) => <div key={product} className="rounded-lg bg-white/80 p-4 text-lg font-bold text-green-950 shadow-sm">{product}</div>)}
          </div>
        </div>
      </section>
      <section className="mx-auto max-w-7xl px-4 py-14 sm:px-6 lg:px-8">
        <SectionHeader eyebrow="Why food teams use it" title="Built for practical procurement" body="Order online when pricing and delivery are available, or discuss recurring quantities with the team before scaling supply." />
        <div className="mt-8 grid gap-4 md:grid-cols-3">
          {benefits.map((benefit, index) => {
            const Icon = index % 3 === 0 ? ShoppingBasket : index % 3 === 1 ? Truck : ClipboardCheck;
            return <div key={benefit} className="rounded-lg bg-white p-5 shadow-sm"><Icon className="text-green-800" size={24} /><h2 className="mt-4 text-lg font-bold text-green-950">{benefit}</h2></div>;
          })}
        </div>
      </section>
      <section className="mx-auto max-w-7xl px-4 pb-16 sm:px-6 lg:px-8">
        <div className="rounded-lg bg-green-950 p-6 text-white">
          <h2 className="text-2xl font-bold">How it works</h2>
          <div className="mt-5 grid gap-4 md:grid-cols-3">
            <p className="text-sm leading-6 text-green-50"><strong>1. Browse products.</strong> Check available items, units, minimum quantities, and delivery options.</p>
            <p className="text-sm leading-6 text-green-50"><strong>2. Place an order or ask.</strong> Use checkout for available items or WhatsApp for recurring supply discussions.</p>
            <p className="text-sm leading-6 text-green-50"><strong>3. Track fulfilment.</strong> Follow order status with your order reference after checkout.</p>
          </div>
        </div>
      </section>
    </PageShell>
  );
}

