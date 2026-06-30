"use client";

import { useState, useTransition } from "react";
import { saveDeliveryRateAction } from "@/app/admin/(protected)/delivery-zones/actions";
import { AdminHeader, AdminTable, StatusBadge } from "@/src/components/admin";
import { formatNaira } from "@/src/lib/format";
import type { DeliveryMethod, DeliveryRate } from "@/src/types";

const emptyRate: DeliveryRate = {
  state: "Oyo",
  city: "Ibadan",
  deliveryMethod: "home_delivery",
  baseFee: 0,
  baseDeliveryUnits: 1,
  extraFeePerUnit: 0,
  estimatedDeliveryTime: "",
  isActive: true,
  sortOrder: 100,
};

export function AdminDeliveryRatesClient({ initialRates }: { initialRates: DeliveryRate[] }) {
  const [rates, setRates] = useState(initialRates);
  const [editing, setEditing] = useState<DeliveryRate | null>(null);
  const [form, setForm] = useState<DeliveryRate>(emptyRate);
  const [message, setMessage] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const openCreate = () => {
    setMessage(null);
    setForm({ ...emptyRate });
    setEditing(emptyRate);
  };

  const openEdit = (rate: DeliveryRate) => {
    setMessage(null);
    setForm({ ...rate });
    setEditing(rate);
  };

  const saveRate = (event: React.FormEvent) => {
    event.preventDefault();
    setMessage(null);
    startTransition(async () => {
      const result = await saveDeliveryRateAction(form);
      if (!result.success) {
        setMessage(result.message);
        return;
      }
      setRates((current) =>
        form.id
          ? current.map((rate) => (rate.id === result.rate.id ? result.rate : rate))
          : [result.rate, ...current],
      );
      setEditing(null);
      setMessage("Delivery rate saved.");
    });
  };

  return (
    <>
      <AdminHeader
        title="Delivery Rates"
        body="Manage upfront delivery pricing by state, city or area, and delivery method. Legacy distance-based zones are no longer used by checkout."
      />
      {message ? <div className="mb-4 rounded-lg border border-green-200 bg-green-50 p-4 text-sm font-semibold text-green-800">{message}</div> : null}
      <div className="mb-4 flex justify-end">
        <button type="button" onClick={openCreate} className="h-11 rounded-full bg-green-800 px-5 text-sm font-bold text-white">
          Add Rate
        </button>
      </div>
      <AdminTable
        headers={["Location", "Method", "Base fee", "Allowance", "Extra/unit", "ETA", "Status", "Actions"]}
        rows={rates.map((rate) => [
          <span key="location" className="font-bold text-green-950">{rate.state} / {rate.city}</span>,
          formatDeliveryMethod(rate.deliveryMethod),
          formatNaira(rate.baseFee),
          String(rate.baseDeliveryUnits),
          formatNaira(rate.extraFeePerUnit),
          rate.estimatedDeliveryTime || "Not set",
          <StatusBadge key="status" status={rate.isActive ? "Active" : "Inactive"} />,
          <button key="edit" type="button" onClick={() => openEdit(rate)} className="h-9 rounded-full bg-green-50 px-3 text-xs font-bold text-green-800">Edit</button>,
        ])}
      />
      {editing ? (
        <div className="fixed inset-0 z-50 grid place-items-center bg-green-950/50 p-4">
          <form onSubmit={saveRate} className="grid max-h-[90vh] w-full max-w-2xl gap-4 overflow-y-auto rounded-lg bg-white p-6 shadow-xl">
            <h2 className="text-xl font-bold text-green-950">{form.id ? "Edit delivery rate" : "Create delivery rate"}</h2>
            <div className="grid gap-4 md:grid-cols-2">
              <RateInput label="State" value={form.state} onChange={(state) => setForm({ ...form, state })} />
              <RateInput label="City / Area" value={form.city} onChange={(city) => setForm({ ...form, city })} />
              <label className="grid gap-2 text-sm font-semibold text-stone-800">
                Delivery method
                <select value={form.deliveryMethod} onChange={(event) => setForm({ ...form, deliveryMethod: event.target.value as DeliveryMethod })} className="h-11 rounded-lg border border-stone-200 bg-white px-4 font-normal">
                  <option value="home_delivery">Home Delivery</option>
                  <option value="pickup_point">Pickup Point Delivery</option>
                  <option value="farm_pickup">Farm Pickup / Direct Arrangement</option>
                </select>
              </label>
              <RateInput label="Base fee" type="number" min={0} value={form.baseFee} onChange={(baseFee) => setForm({ ...form, baseFee: Number(baseFee) })} />
              <RateInput label="Base delivery units" type="number" min={0} value={form.baseDeliveryUnits} onChange={(baseDeliveryUnits) => setForm({ ...form, baseDeliveryUnits: Number(baseDeliveryUnits) })} />
              <RateInput label="Extra fee per unit" type="number" min={0} value={form.extraFeePerUnit} onChange={(extraFeePerUnit) => setForm({ ...form, extraFeePerUnit: Number(extraFeePerUnit) })} />
              <RateInput label="Estimated delivery time" required={false} value={form.estimatedDeliveryTime ?? ""} onChange={(estimatedDeliveryTime) => setForm({ ...form, estimatedDeliveryTime })} />
              <RateInput label="Sort order" type="number" min={0} value={form.sortOrder} onChange={(sortOrder) => setForm({ ...form, sortOrder: Number(sortOrder) })} />
              <label className="flex items-center gap-3 rounded-lg border border-stone-200 p-3 text-sm font-semibold">
                <input type="checkbox" checked={form.isActive} onChange={(event) => setForm({ ...form, isActive: event.target.checked })} className="size-4" />
                Active
              </label>
            </div>
            <div className="flex justify-end gap-3">
              <button type="button" disabled={isPending} onClick={() => setEditing(null)} className="h-11 rounded-full border border-stone-300 px-5 text-sm font-bold">Cancel</button>
              <button type="submit" disabled={isPending} className="h-11 rounded-full bg-green-800 px-5 text-sm font-bold text-white disabled:opacity-60">{isPending ? "Saving..." : "Save rate"}</button>
            </div>
          </form>
        </div>
      ) : null}
    </>
  );
}

function formatDeliveryMethod(method: DeliveryMethod) {
  return {
    home_delivery: "Home Delivery",
    pickup_point: "Pickup Point Delivery",
    farm_pickup: "Farm Pickup / Direct Arrangement",
  }[method];
}

function RateInput({ label, value, onChange, type = "text", min, required = true }: { label: string; value: string | number; onChange: (value: string) => void; type?: string; min?: number; required?: boolean }) {
  return (
    <label className="grid gap-2 text-sm font-semibold text-stone-800">
      {label}
      <input required={required} type={type} min={min} step={type === "number" ? "any" : undefined} value={value} onChange={(event) => onChange(event.target.value)} className="h-11 rounded-lg border border-stone-200 px-4 font-normal" />
    </label>
  );
}