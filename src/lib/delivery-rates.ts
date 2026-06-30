import "server-only";

import { requireAdmin } from "@/src/lib/admin-auth";
import { createAdminSupabaseClient } from "@/src/lib/supabase/admin";
import type { DeliveryMethod, DeliveryRate } from "@/src/types";

export type DeliveryRateRow = {
  id: string;
  state: string;
  city: string;
  delivery_method: DeliveryMethod;
  base_fee: number | string;
  base_delivery_units: number | string;
  extra_fee_per_unit: number | string;
  estimated_delivery_time: string | null;
  is_active: boolean;
  sort_order: number | string;
  created_at?: string;
};

export const deliveryMethods = ["home_delivery", "pickup_point", "farm_pickup"] as const;

export function mapDeliveryRateRow(row: DeliveryRateRow): DeliveryRate {
  return {
    id: row.id,
    state: row.state,
    city: row.city,
    deliveryMethod: row.delivery_method,
    baseFee: Number(row.base_fee),
    baseDeliveryUnits: Number(row.base_delivery_units),
    extraFeePerUnit: Number(row.extra_fee_per_unit),
    estimatedDeliveryTime: row.estimated_delivery_time,
    isActive: row.is_active,
    sortOrder: Number(row.sort_order),
  };
}

export async function getActiveDeliveryRates() {
  const supabase = createAdminSupabaseClient();
  const { data, error } = await supabase
    .from("delivery_rates")
    .select("id, state, city, delivery_method, base_fee, base_delivery_units, extra_fee_per_unit, estimated_delivery_time, is_active, sort_order")
    .eq("is_active", true)
    .order("sort_order", { ascending: true })
    .order("state", { ascending: true })
    .order("city", { ascending: true });

  if (error) throw new Error(`Unable to load legacy delivery rates: ${error.message}`);
  return ((data ?? []) as unknown as DeliveryRateRow[]).map(mapDeliveryRateRow);
}

export async function getAdminDeliveryRates() {
  await requireAdmin();
  const supabase = createAdminSupabaseClient();
  const { data, error } = await supabase
    .from("delivery_rates")
    .select("id, state, city, delivery_method, base_fee, base_delivery_units, extra_fee_per_unit, estimated_delivery_time, is_active, sort_order")
    .order("sort_order", { ascending: true })
    .order("state", { ascending: true })
    .order("city", { ascending: true });

  if (error) throw new Error(`Unable to load legacy delivery rates: ${error.message}`);
  return ((data ?? []) as unknown as DeliveryRateRow[]).map(mapDeliveryRateRow);
}

export async function saveAdminDeliveryRate(input: Omit<DeliveryRate, "id"> & { id?: string }) {
  await requireAdmin();
  const supabase = createAdminSupabaseClient();
  const payload = {
    state: input.state.trim(),
    city: input.city.trim(),
    delivery_method: input.deliveryMethod,
    base_fee: input.baseFee,
    base_delivery_units: input.baseDeliveryUnits,
    extra_fee_per_unit: input.extraFeePerUnit,
    estimated_delivery_time: input.estimatedDeliveryTime?.trim() || null,
    is_active: input.isActive,
    sort_order: input.sortOrder,
  };

  const query = input.id
    ? supabase.from("delivery_rates").update(payload).eq("id", input.id).select("id, state, city, delivery_method, base_fee, base_delivery_units, extra_fee_per_unit, estimated_delivery_time, is_active, sort_order").single()
    : supabase.from("delivery_rates").insert(payload).select("id, state, city, delivery_method, base_fee, base_delivery_units, extra_fee_per_unit, estimated_delivery_time, is_active, sort_order").single();

  const { data, error } = await query;
  if (error) throw new Error(`Unable to save legacy delivery rate: ${error.message}`);
  return mapDeliveryRateRow(data as unknown as DeliveryRateRow);
}
