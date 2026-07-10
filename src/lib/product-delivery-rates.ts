import "server-only";

import { requireAdmin } from "@/src/lib/admin-auth";
import {
  calculateDeliveryFromProductRates,
  deliveryDebugLines,
  normalizeDeliveryLocation,
  type DeliveryCalculationResult,
  type DeliveryProductForCalculation,
} from "@/src/lib/delivery-calculator";
import { createAdminSupabaseClient } from "@/src/lib/supabase/admin";
import type { DeliveryMethod, ProductDeliveryRate } from "@/src/types";

export type ProductDeliveryRateRow = {
  id: string;
  product_id: string;
  state: string;
  city: string;
  delivery_method: DeliveryMethod;
  package_size: number | string;
  first_package_fee: number | string;
  extra_package_fee: number | string;
  estimated_delivery_time: string | null;
  is_active: boolean;
  sort_order: number | string;
  created_at?: string;
  products?: { name: string; slug: string } | { name: string; slug: string }[] | null;
};

const PRODUCT_DELIVERY_RATE_PAGE_SIZE = 1000;

const productDeliveryRateColumns = `
  id,
  product_id,
  state,
  city,
  delivery_method,
  package_size,
  first_package_fee,
  extra_package_fee,
  estimated_delivery_time,
  is_active,
  sort_order,
  created_at,
  products ( name, slug )
`;

function relationRow<T>(relation: T | T[] | null | undefined): T | null {
  return Array.isArray(relation) ? relation[0] ?? null : relation ?? null;
}

export function mapProductDeliveryRateRow(row: ProductDeliveryRateRow): ProductDeliveryRate {
  const product = relationRow(row.products);
  return {
    id: row.id,
    productId: row.product_id,
    productName: product?.name,
    productSlug: product?.slug,
    state: row.state,
    city: row.city,
    deliveryMethod: row.delivery_method,
    packageSize: Number(row.package_size),
    firstPackageFee: Number(row.first_package_fee),
    extraPackageFee: Number(row.extra_package_fee),
    estimatedDeliveryTime: row.estimated_delivery_time,
    isActive: row.is_active,
    sortOrder: Number(row.sort_order),
  };
}

type ProductDeliveryRateFetchOptions = {
  activeOnly?: boolean;
  productIds?: string[];
  deliveryMethod?: DeliveryMethod;
};

async function fetchProductDeliveryRatePages(options: ProductDeliveryRateFetchOptions = {}) {
  const supabase = createAdminSupabaseClient();
  const rows: ProductDeliveryRateRow[] = [];
  let from = 0;

  while (true) {
    let query = supabase
      .from("product_delivery_rates")
      .select(productDeliveryRateColumns)
      .order("state", { ascending: true })
      .order("city", { ascending: true })
      .order("sort_order", { ascending: true })
      .order("delivery_method", { ascending: true })
      .range(from, from + PRODUCT_DELIVERY_RATE_PAGE_SIZE - 1);

    if (options.activeOnly) query = query.eq("is_active", true);
    if (options.deliveryMethod) query = query.eq("delivery_method", options.deliveryMethod);
    if (options.productIds && options.productIds.length > 0) {
      query = query.in("product_id", [...new Set(options.productIds)]);
    }

    const { data, error } = await query;
    if (error) throw new Error(`Unable to load product delivery rates: ${error.message}`);

    const page = (data ?? []) as unknown as ProductDeliveryRateRow[];
    rows.push(...page);
    if (page.length < PRODUCT_DELIVERY_RATE_PAGE_SIZE) break;
    from += PRODUCT_DELIVERY_RATE_PAGE_SIZE;
  }

  return rows.map(mapProductDeliveryRateRow);
}

export async function getActiveProductDeliveryRates(productIds?: string[]) {
  return fetchProductDeliveryRatePages({ activeOnly: true, productIds });
}

export async function getAdminProductDeliveryRates() {
  await requireAdmin();
  return fetchProductDeliveryRatePages();
}

function targetCheckoutRates({
  rates,
  state,
  city,
}: {
  rates: ProductDeliveryRate[];
  state: string;
  city: string;
}) {
  const normalizedState = normalizeDeliveryLocation(state);
  const normalizedCity = normalizeDeliveryLocation(city);

  return rates.filter((rate) => {
    if (!rate.isActive) return false;
    if (normalizeDeliveryLocation(rate.state) !== normalizedState) return false;
    const rateCity = normalizeDeliveryLocation(rate.city);
    return rateCity === normalizedCity || rateCity === "all";
  });
}

function logDeliveryDiagnostics(result: DeliveryCalculationResult, rates: ProductDeliveryRate[]) {
  if (process.env.NODE_ENV === "production" || result.supported) return;

  console.info("[Delivery Lookup Diagnostics]", {
    debug: deliveryDebugLines(result),
    candidateRatesLoaded: rates.length,
  });
}

export async function calculateCheckoutDelivery(input: {
  products: DeliveryProductForCalculation[];
  state: string;
  city: string;
  deliveryMethod: DeliveryMethod;
}) {
  const productIds = input.products.map((product) => product.productId);
  const candidateRates = await fetchProductDeliveryRatePages({
    activeOnly: true,
    productIds,
    deliveryMethod: input.deliveryMethod,
  });
  const rates = targetCheckoutRates({
    rates: candidateRates,
    state: input.state,
    city: input.city,
  });
  const result = calculateDeliveryFromProductRates({ rates, ...input });
  logDeliveryDiagnostics(result, rates);
  return result;
}

export async function saveAdminProductDeliveryRate(input: ProductDeliveryRate) {
  await requireAdmin();
  const supabase = createAdminSupabaseClient();
  const payload = {
    product_id: input.productId,
    state: input.state.trim(),
    city: input.city.trim(),
    delivery_method: input.deliveryMethod,
    package_size: input.packageSize,
    first_package_fee: input.firstPackageFee,
    extra_package_fee: input.extraPackageFee,
    estimated_delivery_time: input.estimatedDeliveryTime?.trim() || null,
    is_active: input.isActive,
    sort_order: input.sortOrder,
  };

  const query = input.id
    ? supabase
        .from("product_delivery_rates")
        .update(payload)
        .eq("id", input.id)
        .select(productDeliveryRateColumns)
        .single()
    : supabase
        .from("product_delivery_rates")
        .insert(payload)
        .select(productDeliveryRateColumns)
        .single();

  const { data, error } = await query;
  if (error) throw new Error(`Unable to save product delivery rate: ${error.message}`);
  return mapProductDeliveryRateRow(data as unknown as ProductDeliveryRateRow);
}
