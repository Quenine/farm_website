import { AdminDeliveryRatesClient } from "@/app/admin/(protected)/delivery-zones/delivery-rates-client";
import { getAdminDeliveryRates } from "@/src/lib/delivery-rates";

export const dynamic = "force-dynamic";

export default async function AdminDeliveryZonesPage() {
  const rates = await getAdminDeliveryRates();
  return <AdminDeliveryRatesClient initialRates={rates} />;
}