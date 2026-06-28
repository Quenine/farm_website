import { deliverySettings } from "@/src/lib/business-data";
import type { DeliverySettings, DeliveryZone } from "@/src/types";

export function roundUpToNearest(amount: number, nearest: number) {
  return Math.ceil(amount / nearest) * nearest;
}

export function calculateDeliveryFee(
  zone: DeliveryZone,
  settings: DeliverySettings = deliverySettings,
) {
  const tripDistance = settings.roundTripEnabled
    ? zone.distanceKm * 2
    : zone.distanceKm;
  const litresNeeded = tripDistance / settings.vehicleKmPerLitre;
  const fuelCost = litresNeeded * settings.fuelPricePerLitre;
  return roundUpToNearest(
    fuelCost + settings.driverFlatFee,
    settings.rounding ?? 500,
  );
}
