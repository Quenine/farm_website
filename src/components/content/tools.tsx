"use client";

import { useMemo, useState } from "react";
import { trackContentToolComplete, trackContentToolStart } from "@/src/lib/content-analytics";
import { formatNaira } from "@/src/lib/format";

function numberValue(value: string, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : fallback;
}

function NumberField({ label, value, onChange, min = 0, step = "any" }: { label: string; value: string; min?: number; step?: string; onChange: (value: string) => void }) {
  return (
    <label className="grid gap-2 text-sm font-semibold text-stone-800">
      {label}
      <input type="number" min={min} step={step} value={value} onFocus={() => trackContentToolStart(label)} onChange={(event) => onChange(event.target.value)} className="h-12 rounded-lg border border-stone-200 px-4 text-sm focus:border-green-700 focus:outline-none focus:ring-2 focus:ring-green-700/20" />
    </label>
  );
}

export function PoultryFeedEstimator() {
  const [birds, setBirds] = useState("100");
  const [dailyFeed, setDailyFeed] = useState("0.12");
  const [days, setDays] = useState("14");
  const [bagSize, setBagSize] = useState("25");
  const [bagPrice, setBagPrice] = useState("");
  const result = useMemo(() => {
    const feedKg = numberValue(birds) * numberValue(dailyFeed) * numberValue(days);
    const bags = numberValue(bagSize) > 0 ? Math.ceil(feedKg / numberValue(bagSize)) : 0;
    const cost = numberValue(bagPrice) > 0 ? bags * numberValue(bagPrice) : null;
    return { feedKg, bags, cost };
  }, [birds, dailyFeed, days, bagSize, bagPrice]);

  return (
    <section id="poultry-feed-requirement" className="rounded-lg bg-white p-6 shadow-sm">
      <h2 className="text-2xl font-bold text-green-950">Poultry Feed Requirement Estimator</h2>
      <p className="mt-2 text-sm leading-6 text-stone-700">Formula: birds x daily feed per bird x days. Results are estimates and do not guarantee performance.</p>
      <div className="mt-5 grid gap-4 md:grid-cols-2">
        <NumberField label="Number of birds" value={birds} onChange={setBirds} step="1" />
        <NumberField label="Estimated daily feed per bird (kg)" value={dailyFeed} onChange={setDailyFeed} />
        <NumberField label="Number of days" value={days} onChange={setDays} step="1" />
        <NumberField label="Feed bag size (kg)" value={bagSize} onChange={setBagSize} />
        <NumberField label="Optional feed price per bag" value={bagPrice} onChange={setBagPrice} />
      </div>
      <div className="mt-5 grid gap-3 rounded-lg bg-green-50 p-4 text-green-950 sm:grid-cols-3">
        <p><span className="block text-sm text-green-800">Estimated feed</span><strong>{result.feedKg.toLocaleString("en-NG", { maximumFractionDigits: 2 })} kg</strong></p>
        <p><span className="block text-sm text-green-800">Estimated bags</span><strong>{result.bags.toLocaleString("en-NG")}</strong></p>
        <p><span className="block text-sm text-green-800">Estimated cost</span><strong>{result.cost === null ? "Optional" : formatNaira(result.cost)}</strong></p>
      </div>
      <button type="button" onClick={() => trackContentToolComplete("poultry_feed_requirement")} className="mt-4 rounded-full border border-green-800 px-4 py-2 text-sm font-bold text-green-950">Mark estimate complete</button>
    </section>
  );
}

export function EggSalesMarginCalculator() {
  const [crates, setCrates] = useState("10");
  const [eggsPerCrate, setEggsPerCrate] = useState("30");
  const [costPerCrate, setCostPerCrate] = useState("4500");
  const [sellingPrice, setSellingPrice] = useState("5200");
  const [transport, setTransport] = useState("0");
  const [other, setOther] = useState("0");
  const result = useMemo(() => {
    const revenue = numberValue(crates) * numberValue(sellingPrice);
    const cost = numberValue(crates) * numberValue(costPerCrate) + numberValue(transport) + numberValue(other);
    const margin = revenue - cost;
    const marginPerCrate = numberValue(crates) > 0 ? margin / numberValue(crates) : 0;
    return { revenue, cost, margin, marginPerCrate, eggs: numberValue(crates) * numberValue(eggsPerCrate) };
  }, [crates, eggsPerCrate, costPerCrate, sellingPrice, transport, other]);

  return (
    <section id="egg-sales-margin" className="rounded-lg bg-white p-6 shadow-sm">
      <h2 className="text-2xl font-bold text-green-950">Egg Sales Margin Calculator</h2>
      <p className="mt-2 text-sm leading-6 text-stone-700">Formula: revenue minus crate cost, transport, packaging, and other expenses. Results are estimates and do not guarantee profit.</p>
      <div className="mt-5 grid gap-4 md:grid-cols-2">
        <NumberField label="Number of crates" value={crates} onChange={setCrates} />
        <NumberField label="Eggs per crate" value={eggsPerCrate} onChange={setEggsPerCrate} />
        <NumberField label="Cost per crate" value={costPerCrate} onChange={setCostPerCrate} />
        <NumberField label="Selling price per crate" value={sellingPrice} onChange={setSellingPrice} />
        <NumberField label="Transport or packaging expense" value={transport} onChange={setTransport} />
        <NumberField label="Other expense" value={other} onChange={setOther} />
      </div>
      <div className="mt-5 grid gap-3 rounded-lg bg-green-50 p-4 text-green-950 sm:grid-cols-4">
        <p><span className="block text-sm text-green-800">Eggs</span><strong>{result.eggs.toLocaleString("en-NG")}</strong></p>
        <p><span className="block text-sm text-green-800">Revenue</span><strong>{formatNaira(result.revenue)}</strong></p>
        <p><span className="block text-sm text-green-800">Total cost</span><strong>{formatNaira(result.cost)}</strong></p>
        <p><span className="block text-sm text-green-800">Margin / crate</span><strong>{formatNaira(result.marginPerCrate)}</strong></p>
      </div>
      <button type="button" onClick={() => trackContentToolComplete("egg_sales_margin")} className="mt-4 rounded-full border border-green-800 px-4 py-2 text-sm font-bold text-green-950">Mark estimate complete</button>
    </section>
  );
}
