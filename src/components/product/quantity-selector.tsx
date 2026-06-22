"use client";

import { Minus, Plus } from "lucide-react";

export function QuantitySelector({
  value,
  min,
  max,
  unit,
  onChange,
}: {
  value: number;
  min: number;
  max: number;
  unit: string;
  onChange: (value: number) => void;
}) {
  const update = (next: number) => {
    onChange(Math.min(Math.max(next, min), max));
  };

  return (
    <div className="flex items-center justify-between gap-3 rounded-lg border border-stone-200 bg-white p-2">
      <button
        type="button"
        aria-label="Decrease quantity"
        onClick={() => update(value - 1)}
        disabled={value <= min}
        className="grid size-10 place-items-center rounded-full bg-stone-100 text-stone-700 disabled:cursor-not-allowed disabled:opacity-40"
      >
        <Minus size={16} />
      </button>
      <div className="min-w-28 text-center">
        <p className="text-lg font-bold text-green-950">{value}</p>
        <p className="text-xs font-semibold text-stone-500">{unit}</p>
      </div>
      <button
        type="button"
        aria-label="Increase quantity"
        onClick={() => update(value + 1)}
        disabled={value >= max}
        className="grid size-10 place-items-center rounded-full bg-green-800 text-white disabled:cursor-not-allowed disabled:opacity-40"
      >
        <Plus size={16} />
      </button>
    </div>
  );
}
