import "server-only";

import { createAdminSupabaseClient } from "@/src/lib/supabase/admin";
import type { DeliverySettings, DeliveryZone } from "@/src/types";

type SettingRow = {
  key: string;
  value: unknown;
};

function numberSetting(rows: SettingRow[], key: string) {
  const value = rows.find((row) => row.key === key)?.value;
  const number = Number(value);
  if (!Number.isFinite(number) || number <= 0) {
    throw new Error(`Delivery setting "${key}" is missing or invalid.`);
  }
  return number;
}

function booleanSetting(rows: SettingRow[], key: string) {
  const value = rows.find((row) => row.key === key)?.value;
  if (typeof value === "boolean") return value;
  if (value === "true") return true;
  if (value === "false") return false;
  throw new Error(`Delivery setting "${key}" is missing or invalid.`);
}

export async function getCheckoutDeliveryData() {
  const supabase = createAdminSupabaseClient();
  const [zonesResult, settingsResult] = await Promise.all([
    supabase
      .from("delivery_zones")
      .select("id, name, distance_km, is_active")
      .eq("is_active", true)
      .order("name"),
    supabase
      .from("app_settings")
      .select("key, value")
      .in("key", [
        "fuel_price_per_litre",
        "vehicle_km_per_litre",
        "driver_flat_fee",
        "use_round_trip",
        "delivery_fee_rounding",
      ]),
  ]);

  if (zonesResult.error) {
    throw new Error(`Unable to load delivery zones: ${zonesResult.error.message}`);
  }
  if (settingsResult.error) {
    throw new Error(
      `Unable to load delivery settings: ${settingsResult.error.message}`,
    );
  }

  const zones: DeliveryZone[] = (zonesResult.data ?? []).map((zone) => ({
    id: zone.id,
    area: zone.name,
    distanceKm: Number(zone.distance_km),
    isActive: zone.is_active,
  }));
  const rows = (settingsResult.data ?? []) as SettingRow[];
  const settings: DeliverySettings = {
    fuelPricePerLitre: numberSetting(rows, "fuel_price_per_litre"),
    vehicleKmPerLitre: numberSetting(rows, "vehicle_km_per_litre"),
    driverFlatFee: numberSetting(rows, "driver_flat_fee"),
    roundTripEnabled: booleanSetting(rows, "use_round_trip"),
    rounding: numberSetting(rows, "delivery_fee_rounding"),
  };

  return { zones, settings };
}
