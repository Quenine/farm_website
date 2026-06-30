"use client";

import { Minus, Plus } from "lucide-react";

import {
  formatQuantity,
  nextQuantityValue,
  normalizeQuantity,
  type QuantityInputType,
} from "@/src/lib/quantity";

export function QuantitySelector({
  value,
  min,
  max,
  step = 1,
  inputType = "whole",
  unit,
  onChange,
}: {
  value: number;
  min: number;
  max: number;
  step?: number;
  inputType?: QuantityInputType;
  unit: string;
  onChange: (value: number) => void;
}) {
  const normalizedStep = inputType === "whole" ? Math.max(1, Math.round(step)) : step;
  const update = (next: number) => {
    onChange(
      normalizeQuantity({
        quantity: next,
        min,
        max,
        step: normalizedStep,
        inputType,
      }),
    );
  };
  const downValue = nextQuantityValue({
    value,
    direction: "down",
    min,
    max,
    step: normalizedStep,
    inputType,
  });
  const upValue = nextQuantityValue({
    value,
    direction: "up",
    min,
    max,
    step: normalizedStep,
    inputType,
  });

  return (
    <div className="flex items-center justify-between gap-3 rounded-lg border border-stone-200 bg-white p-2">
      <button
        type="button"
        aria-label="Decrease quantity"
        onClick={() => onChange(downValue)}
        disabled={value <= min || downValue === value}
        className="grid size-10 place-items-center rounded-full bg-stone-100 text-stone-700 disabled:cursor-not-allowed disabled:opacity-40"
      >
        <Minus size={16} />
      </button>
      <label className="min-w-28 text-center">
        <span className="sr-only">Quantity</span>
        <input
          type="number"
          inputMode={inputType === "decimal" ? "decimal" : "numeric"}
          min={min}
          max={max}
          step={normalizedStep}
          value={value}
          onChange={(event) => update(Number(event.target.value))}
          onBlur={(event) => update(Number(event.target.value))}
          className="w-24 rounded-md border border-transparent bg-transparent text-center text-lg font-bold text-green-950 outline-none focus:border-green-200 focus:bg-cream-50"
        />
        <span className="block text-xs font-semibold text-stone-500">
          {unit} · step {formatQuantity(normalizedStep)}
        </span>
      </label>
      <button
        type="button"
        aria-label="Increase quantity"
        onClick={() => onChange(upValue)}
        disabled={value >= max || upValue === value}
        className="grid size-10 place-items-center rounded-full bg-green-800 text-white disabled:cursor-not-allowed disabled:opacity-40"
      >
        <Plus size={16} />
      </button>
    </div>
  );
}
