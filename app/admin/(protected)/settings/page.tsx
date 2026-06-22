"use client";

import { useState } from "react";
import { AdminHeader } from "@/src/components/admin";
import { deliverySettings } from "@/src/lib/mock-data";
import type { DeliverySettings } from "@/src/types";

export default function AdminSettingsPage() {
  const [settings, setSettings] =
    useState<DeliverySettings>(deliverySettings);
  const [saved, setSaved] = useState(false);

  const updateNumber = (
    key: keyof Omit<DeliverySettings, "roundTripEnabled">,
    value: string,
  ) => {
    setSaved(false);
    setSettings((current) => ({
      ...current,
      [key]: Math.max(0, Number(value)),
    }));
  };

  return (
    <>
      <AdminHeader
        title="Settings"
        body="Mock business, delivery, and payment configuration for the future Supabase-backed admin."
      />
      <div className="grid gap-6 rounded-lg bg-white p-6 shadow-sm">
        <div className="grid gap-5 md:grid-cols-2">
          <SettingInput label="Business name" value="Noble Farms" disabled />
          <SettingInput label="Domain" value="noblefarm.xyz" disabled />
          <SettingInput label="Delivery city" value="Ibadan" disabled />
          <SettingInput
            label="Fuel price per litre"
            type="number"
            value={settings.fuelPricePerLitre}
            onChange={(value) => updateNumber("fuelPricePerLitre", value)}
          />
          <SettingInput
            label="Vehicle km per litre"
            type="number"
            value={settings.vehicleKmPerLitre}
            onChange={(value) => updateNumber("vehicleKmPerLitre", value)}
          />
          <SettingInput
            label="Driver flat fee"
            type="number"
            value={settings.driverFlatFee}
            onChange={(value) => updateNumber("driverFlatFee", value)}
          />
          <label className="grid gap-2 text-sm font-semibold text-stone-800">
            Round trip enabled
            <select
              value={settings.roundTripEnabled ? "yes" : "no"}
              onChange={(event) => {
                setSaved(false);
                setSettings((current) => ({
                  ...current,
                  roundTripEnabled: event.target.value === "yes",
                }));
              }}
              className="h-12 rounded-lg border border-stone-200 bg-white px-4 font-normal shadow-sm"
            >
              <option value="yes">Yes</option>
              <option value="no">No</option>
            </select>
          </label>
          <SettingInput label="Payment provider" value="Paystack (future step)" disabled />
          <SettingInput label="Admin access" value="Owner only (future step)" disabled />
        </div>
        {saved ? (
          <div
            role="status"
            className="rounded-lg border border-green-200 bg-green-50 p-4 text-sm font-semibold text-green-800"
          >
            Mock settings saved successfully.
          </div>
        ) : null}
        <button
          type="button"
          onClick={() => setSaved(true)}
          className="h-12 w-full rounded-full bg-green-800 px-6 text-sm font-bold text-white md:w-fit"
        >
          Save mock settings
        </button>
      </div>
    </>
  );
}

function SettingInput({
  label,
  value,
  onChange,
  type = "text",
  disabled = false,
}: {
  label: string;
  value: string | number;
  onChange?: (value: string) => void;
  type?: string;
  disabled?: boolean;
}) {
  return (
    <label className="grid gap-2 text-sm font-semibold text-stone-800">
      {label}
      <input
        type={type}
        min={type === "number" ? 0 : undefined}
        step={type === "number" ? "any" : undefined}
        value={value}
        disabled={disabled}
        onChange={(event) => onChange?.(event.target.value)}
        className="h-12 rounded-lg border border-stone-200 bg-white px-4 font-normal shadow-sm disabled:bg-stone-100 disabled:text-stone-500"
      />
    </label>
  );
}
