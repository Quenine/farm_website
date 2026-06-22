"use client";

import { useState } from "react";
import { AdminHeader, AdminTable } from "@/src/components/admin";
import { deliveryAreas, deliverySettings, formatNaira } from "@/src/lib/mock-data";
import { calculateDeliveryFee } from "@/src/lib/delivery";
import type { DeliveryZone } from "@/src/types";

export default function AdminDeliveryZonesPage() {
  const [zones, setZones] = useState<DeliveryZone[]>(deliveryAreas);
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [form, setForm] = useState<DeliveryZone>({
    area: "",
    distanceKm: 1,
  });

  const openCreate = () => {
    setForm({ area: "", distanceKm: 1 });
    setEditingIndex(-1);
  };

  const openEdit = (zone: DeliveryZone, index: number) => {
    setForm(zone);
    setEditingIndex(index);
  };

  const saveZone = (event: React.FormEvent) => {
    event.preventDefault();
    setZones((current) =>
      editingIndex === -1
        ? [...current, form]
        : current.map((zone, index) =>
            index === editingIndex ? form : zone,
          ),
    );
    setEditingIndex(null);
  };

  return (
    <>
      <AdminHeader
        title="Delivery zones"
        body="Set Ibadan delivery estimates using fuel cost by distance plus the flat driver fee."
      />
      <div className="mb-4 flex justify-end">
        <button
          type="button"
          onClick={openCreate}
          className="h-11 rounded-full bg-green-800 px-5 text-sm font-bold text-white"
        >
          Add Zone
        </button>
      </div>
      <AdminTable
        headers={["Area", "Distance", "Calculated fee", "Actions"]}
        rows={zones.map((zone, index) => [
          <span key="area" className="font-bold text-green-950">
            {zone.area}
          </span>,
          `${zone.distanceKm} km`,
          formatNaira(calculateDeliveryFee(zone, deliverySettings)),
          <div key="actions" className="flex gap-2">
            <button
              type="button"
              onClick={() => openEdit(zone, index)}
              className="h-9 rounded-full bg-green-50 px-3 text-xs font-bold text-green-800"
            >
              Edit
            </button>
            <button
              type="button"
              onClick={() =>
                setZones((current) =>
                  current.filter((_, zoneIndex) => zoneIndex !== index),
                )
              }
              className="h-9 rounded-full bg-red-50 px-3 text-xs font-bold text-red-700"
            >
              Delete
            </button>
          </div>,
        ])}
      />
      {editingIndex !== null ? (
        <div className="fixed inset-0 z-50 grid place-items-center bg-green-950/50 p-4">
          <form
            onSubmit={saveZone}
            className="w-full max-w-md rounded-lg bg-white p-6 shadow-xl"
          >
            <h2 className="text-xl font-bold text-green-950">
              {editingIndex === -1 ? "Add delivery zone" : "Edit delivery zone"}
            </h2>
            <div className="mt-5 grid gap-4">
              <label className="grid gap-2 text-sm font-semibold">
                Area
                <input
                  required
                  value={form.area}
                  onChange={(event) =>
                    setForm({ ...form, area: event.target.value })
                  }
                  className="h-11 rounded-lg border border-stone-200 px-4 font-normal"
                />
              </label>
              <label className="grid gap-2 text-sm font-semibold">
                One-way distance (km)
                <input
                  required
                  min={0.1}
                  step={0.1}
                  type="number"
                  value={form.distanceKm}
                  onChange={(event) =>
                    setForm({
                      ...form,
                      distanceKm: Number(event.target.value),
                    })
                  }
                  className="h-11 rounded-lg border border-stone-200 px-4 font-normal"
                />
              </label>
              <div className="rounded-lg bg-green-50 p-4 text-sm text-green-950">
                Calculated fee:{" "}
                <strong>
                  {formatNaira(calculateDeliveryFee(form, deliverySettings))}
                </strong>
              </div>
            </div>
            <div className="mt-6 flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setEditingIndex(null)}
                className="h-11 rounded-full border border-stone-300 px-5 text-sm font-bold"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="h-11 rounded-full bg-green-800 px-5 text-sm font-bold text-white"
              >
                Save zone
              </button>
            </div>
          </form>
        </div>
      ) : null}
    </>
  );
}
