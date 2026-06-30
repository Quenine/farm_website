import type { Product } from "@/src/types";

export type QuantityInputType = "whole" | "decimal";

const MAX_DECIMAL_PLACES = 6;

function decimalPlaces(value: number) {
  if (!Number.isFinite(value)) return 0;
  const text = value.toString().toLowerCase();
  if (text.includes("e-")) {
    const [, exponent] = text.split("e-");
    return Math.min(Number(exponent) || 0, MAX_DECIMAL_PLACES);
  }
  const decimals = text.split(".")[1]?.length ?? 0;
  return Math.min(decimals, MAX_DECIMAL_PLACES);
}

function scaleFor(...values: number[]) {
  const places = Math.max(0, ...values.map(decimalPlaces));
  return 10 ** places;
}

function toScaledInteger(value: number, scale: number) {
  return Math.round(value * scale);
}

function cleanNumber(value: number, decimals = MAX_DECIMAL_PLACES) {
  return Number(value.toFixed(decimals));
}

export function getQuantityStep(product: Pick<Product, "quantityStep" | "quantityInputType">) {
  const step = Number(product.quantityStep ?? 1);
  if (!Number.isFinite(step) || step <= 0) return 1;
  if ((product.quantityInputType ?? "whole") === "whole") {
    return Math.max(1, Math.round(step));
  }
  return step;
}

export function getQuantityInputType(
  product: Pick<Product, "quantityInputType">,
): QuantityInputType {
  return product.quantityInputType === "decimal" ? "decimal" : "whole";
}

export function normalizeQuantity({
  quantity,
  min,
  max,
  step,
  inputType,
}: {
  quantity: number;
  min: number;
  max: number;
  step: number;
  inputType: QuantityInputType;
}) {
  if (!Number.isFinite(quantity) || !Number.isFinite(min) || !Number.isFinite(max)) {
    return 0;
  }

  const normalizedStep = inputType === "whole" ? Math.max(1, Math.round(step)) : step;
  if (!Number.isFinite(normalizedStep) || normalizedStep <= 0 || max < min) {
    return 0;
  }

  const scale = scaleFor(quantity, min, max, normalizedStep);
  const minScaled = toScaledInteger(min, scale);
  const maxScaled = toScaledInteger(max, scale);
  const stepScaled = Math.max(1, toScaledInteger(normalizedStep, scale));
  let targetScaled = toScaledInteger(quantity, scale);

  targetScaled = Math.min(Math.max(targetScaled, minScaled), maxScaled);

  if (inputType === "whole") {
    targetScaled = Math.round(targetScaled / scale) * scale;
  }

  const offset = Math.max(0, targetScaled - minScaled);
  const steps = Math.round(offset / stepScaled);
  let normalizedScaled = minScaled + steps * stepScaled;

  if (normalizedScaled > maxScaled) {
    const maxSteps = Math.floor(Math.max(0, maxScaled - minScaled) / stepScaled);
    normalizedScaled = minScaled + maxSteps * stepScaled;
  }

  return cleanNumber(normalizedScaled / scale);
}

export function isValidQuantityStep({
  quantity,
  min,
  max,
  step,
  inputType,
}: {
  quantity: number;
  min: number;
  max?: number;
  step: number;
  inputType: QuantityInputType;
}) {
  if (!Number.isFinite(quantity) || !Number.isFinite(min) || !Number.isFinite(step) || step <= 0) {
    return false;
  }

  if (quantity < min) return false;
  if (typeof max === "number" && Number.isFinite(max) && quantity > max) return false;
  if (inputType === "whole" && !Number.isInteger(quantity)) return false;

  const normalizedStep = inputType === "whole" ? Math.max(1, Math.round(step)) : step;
  const scale = scaleFor(quantity, min, normalizedStep);
  const quantityScaled = toScaledInteger(quantity, scale);
  const minScaled = toScaledInteger(min, scale);
  const stepScaled = Math.max(1, toScaledInteger(normalizedStep, scale));

  return (quantityScaled - minScaled) % stepScaled === 0;
}

export function nextQuantityValue({
  value,
  direction,
  min,
  max,
  step,
  inputType,
}: {
  value: number;
  direction: "up" | "down";
  min: number;
  max: number;
  step: number;
  inputType: QuantityInputType;
}) {
  const next = direction === "up" ? value + step : value - step;
  return normalizeQuantity({ quantity: next, min, max, step, inputType });
}

export function formatQuantity(value: number) {
  if (!Number.isFinite(value)) return "0";
  return Number.isInteger(value)
    ? String(value)
    : value.toLocaleString("en-NG", { maximumFractionDigits: 2 });
}

export function quantityUnitLabel(unit: string, quantity: number) {
  const normalized = unit.replaceAll("_", " ");
  if (normalized === "kg") return "kg";
  if (quantity === 1) return normalized;
  if (normalized === "half crate") return "half crates";
  return normalized.endsWith("s") ? normalized : `${normalized}s`;
}

export function formatQuantityWithUnit(quantity: number, unit: string) {
  return `${formatQuantity(quantity)} ${quantityUnitLabel(unit, quantity)}`;
}
