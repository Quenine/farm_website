import { isValidQuantityStep, type QuantityInputType } from "@/src/lib/quantity";
import type {
  DeliveryMethod,
  DeliveryRateBreakdown,
  ProductDeliveryRate,
} from "@/src/types";

export const DELIVERY_METHOD_UNAVAILABLE_MESSAGE =
  "Selected delivery method is not available for one or more items in your cart.";

export const PRODUCT_DELIVERY_UNAVAILABLE_MESSAGE =
  "Online delivery is not currently available for one or more items in your cart at this location. Please contact Noble Farms to arrange this order.";

export const PRODUCT_DELIVERY_UNAVAILABLE_SHORT_MESSAGE =
  "Online delivery is not currently available for one or more items in your cart at this location.";

export type DeliveryProductForCalculation = {
  productId: string;
  name: string;
  quantity: number;
  minimumOrder?: number;
  stockCount?: number;
  quantityStep?: number;
  quantityInputType?: QuantityInputType;
  supportsHomeDelivery: boolean;
  supportsPickupPoint: boolean;
  supportsFarmPickup: boolean;
  requiresDeliveryConfirmation: boolean;
};

export type ProductDeliveryCalculation = {
  supported: true;
  deliveryFee: number;
  deliveryUnits: number;
  handlingFee: number;
  extraUnits: number;
  extraFee: number;
  deliveryRateId: string | null;
  deliveryPricingModel: "product_rate";
  deliveryPackageCount: number;
  deliveryRateBreakdown: DeliveryRateBreakdown;
  estimatedDeliveryTime: string | null;
};

export type MissingProductDeliveryRate = {
  productId: string;
  productName: string;
  state: string;
  city: string;
  deliveryMethod: DeliveryMethod;
  reason: "No active product delivery rate found";
};

export type UnsupportedProductDeliveryMethod = {
  productId: string;
  productName: string;
  deliveryMethod: DeliveryMethod;
};

export type DeliveryUnsupported = {
  supported: false;
  code:
    | "INVALID_PRODUCT_QUANTITY"
    | "UNSUPPORTED_PRODUCT_DELIVERY_METHOD"
    | "MISSING_PRODUCT_DELIVERY_RATE";
  reason: string;
  missingRates?: MissingProductDeliveryRate[];
  unsupportedProducts?: UnsupportedProductDeliveryMethod[];
};

export type DeliveryCalculationResult = ProductDeliveryCalculation | DeliveryUnsupported;
export type MatchingRateSource = "exact" | "all_city_fallback" | "missing";

export function normalizeDeliveryLocation(value: string) {
  return value.trim().toLowerCase();
}

export function formatDeliveryMethod(method: DeliveryMethod) {
  return {
    home_delivery: "Home Delivery",
    pickup_point: "Pickup Point Delivery",
    farm_pickup: "Farm Pickup / Direct Arrangement",
  }[method];
}

export function supportsDeliveryMethod(product: DeliveryProductForCalculation, method: DeliveryMethod) {
  if (product.requiresDeliveryConfirmation) return false;
  if (method === "home_delivery") return product.supportsHomeDelivery;
  if (method === "pickup_point") return product.supportsPickupPoint;
  return product.supportsFarmPickup;
}

export function productQuantityValidationMessage(product: DeliveryProductForCalculation) {
  const quantity = product.quantity;
  const minimumOrder = product.minimumOrder ?? 0;
  const quantityStep = product.quantityStep ?? 1;
  const quantityInputType = product.quantityInputType ?? "whole";

  if (!Number.isFinite(quantity) || quantity <= 0) {
    return `${product.name} has an invalid quantity.`;
  }
  if (minimumOrder > 0 && quantity < minimumOrder) {
    return `${product.name} requires a minimum order of ${minimumOrder}.`;
  }
  if (typeof product.stockCount === "number" && Number.isFinite(product.stockCount) && quantity > product.stockCount) {
    return `${product.name} only has ${product.stockCount} available.`;
  }
  if (
    !isValidQuantityStep({
      quantity,
      min: minimumOrder || quantityStep,
      max: product.stockCount,
      step: quantityStep,
      inputType: quantityInputType,
    })
  ) {
    return `${product.name} quantity must follow the allowed order step.`;
  }
  return null;
}

export function findMatchingProductDeliveryRate({
  rates,
  productId,
  state,
  city,
  deliveryMethod,
}: {
  rates: ProductDeliveryRate[];
  productId: string;
  state: string;
  city: string;
  deliveryMethod: DeliveryMethod;
}): { rate: ProductDeliveryRate | null; source: MatchingRateSource } {
  const normalizedState = normalizeDeliveryLocation(state);
  const normalizedCity = normalizeDeliveryLocation(city);
  const productRates = rates.filter(
    (rate) =>
      rate.isActive &&
      rate.productId === productId &&
      rate.deliveryMethod === deliveryMethod &&
      normalizeDeliveryLocation(rate.state) === normalizedState,
  );

  const exact = productRates.find((rate) => normalizeDeliveryLocation(rate.city) === normalizedCity);
  if (exact) return { rate: exact, source: "exact" };

  const fallback = productRates.find((rate) => normalizeDeliveryLocation(rate.city) === "all");
  if (fallback) return { rate: fallback, source: "all_city_fallback" };

  return { rate: null, source: "missing" };
}

function estimatedTimeFromLines(lines: Array<{ rate: ProductDeliveryRate }>) {
  const times = [...new Set(lines.map((line) => line.rate.estimatedDeliveryTime).filter(Boolean))];
  if (times.length === 0) return null;
  if (times.length === 1) return times[0] ?? null;
  return times.join(" / ");
}

export function deliveryDebugLines(result: DeliveryCalculationResult) {
  if (result.supported) return [];

  if (result.code === "MISSING_PRODUCT_DELIVERY_RATE") {
    return (result.missingRates ?? []).map(
      (item) =>
        `Missing delivery rate for: ${item.productName} -> ${item.state} / ${item.city} / ${formatDeliveryMethod(item.deliveryMethod)}`,
    );
  }

  if (result.code === "UNSUPPORTED_PRODUCT_DELIVERY_METHOD") {
    return (result.unsupportedProducts ?? []).map(
      (item) =>
        `Unsupported delivery method for: ${item.productName} -> ${formatDeliveryMethod(item.deliveryMethod)}`,
    );
  }

  return [result.reason];
}

export function calculateDeliveryFromProductRates({
  rates,
  products,
  state,
  city,
  deliveryMethod,
}: {
  rates: ProductDeliveryRate[];
  products: DeliveryProductForCalculation[];
  state: string;
  city: string;
  deliveryMethod: DeliveryMethod;
}): DeliveryCalculationResult {
  const invalidQuantity = products.map(productQuantityValidationMessage).find(Boolean);
  if (invalidQuantity) {
    return {
      supported: false,
      code: "INVALID_PRODUCT_QUANTITY",
      reason: invalidQuantity,
    };
  }

  const unsupportedProducts = products
    .filter((product) => !supportsDeliveryMethod(product, deliveryMethod))
    .map((product) => ({
      productId: product.productId,
      productName: product.name,
      deliveryMethod,
    }));

  if (unsupportedProducts.length > 0) {
    return {
      supported: false,
      code: "UNSUPPORTED_PRODUCT_DELIVERY_METHOD",
      reason: DELIVERY_METHOD_UNAVAILABLE_MESSAGE,
      unsupportedProducts,
    };
  }

  const ratedLines = products.map((product) => {
    const { rate, source } = findMatchingProductDeliveryRate({
      rates,
      productId: product.productId,
      state,
      city,
      deliveryMethod,
    });
    if (!rate) return { product, rate: null, source };
    const packageSize = Number(rate.packageSize || 1);
    const packageCount = Math.max(1, Math.ceil(product.quantity / packageSize));
    return { product, rate, source, packageSize, packageCount };
  });

  const missingRates = ratedLines
    .filter((line) => !line.rate)
    .map((line) => ({
      productId: line.product.productId,
      productName: line.product.name,
      state,
      city,
      deliveryMethod,
      reason: "No active product delivery rate found" as const,
    }));

  if (missingRates.length > 0) {
    return {
      supported: false,
      code: "MISSING_PRODUCT_DELIVERY_RATE",
      reason: PRODUCT_DELIVERY_UNAVAILABLE_MESSAGE,
      missingRates,
    };
  }

  const lines = ratedLines as Array<{
    product: DeliveryProductForCalculation;
    rate: ProductDeliveryRate;
    source: Exclude<MatchingRateSource, "missing">;
    packageSize: number;
    packageCount: number;
  }>;

  const baseLine = [...lines].sort((a, b) => {
    const firstDifference = b.rate.firstPackageFee - a.rate.firstPackageFee;
    if (firstDifference !== 0) return firstDifference;
    return b.rate.extraPackageFee - a.rate.extraPackageFee;
  })[0];

  if (!baseLine) {
    return {
      supported: false,
      code: "MISSING_PRODUCT_DELIVERY_RATE",
      reason: PRODUCT_DELIVERY_UNAVAILABLE_MESSAGE,
      missingRates: [],
    };
  }

  let deliveryFee = 0;
  const breakdownLines = lines.map((line) => {
    const isBaseLine = line === baseLine;
    const lineDeliveryCharge = isBaseLine
      ? line.rate.firstPackageFee + Math.max(0, line.packageCount - 1) * line.rate.extraPackageFee
      : line.packageCount * line.rate.extraPackageFee;
    deliveryFee += lineDeliveryCharge;
    return {
      productName: line.product.name,
      quantity: line.product.quantity,
      packageSize: line.packageSize,
      packageCount: line.packageCount,
      firstPackageFee: line.rate.firstPackageFee,
      extraPackageFee: line.rate.extraPackageFee,
      isBaseLine,
      lineDeliveryCharge,
      matchingRateSource: line.source,
    };
  });

  const deliveryPackageCount = breakdownLines.reduce(
    (sum, line) => sum + line.packageCount,
    0,
  );
  const estimatedDeliveryTime = estimatedTimeFromLines(lines);

  return {
    supported: true,
    deliveryFee,
    deliveryUnits: 0,
    handlingFee: 0,
    extraUnits: 0,
    extraFee: Math.max(0, deliveryFee - baseLine.rate.firstPackageFee),
    deliveryRateId: baseLine.rate.id ?? null,
    deliveryPricingModel: "product_rate",
    deliveryPackageCount,
    deliveryRateBreakdown: {
      model: "product_rate",
      state,
      city,
      deliveryMethod,
      estimatedDeliveryTime,
      lines: breakdownLines,
    },
    estimatedDeliveryTime,
  };
}