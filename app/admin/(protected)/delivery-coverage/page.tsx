import { DeliveryCoverageClient } from "@/app/admin/(protected)/delivery-coverage/delivery-coverage-client";
import { getAdminProductDeliveryRates } from "@/src/lib/product-delivery-rates";
import { getAdminProducts } from "@/src/lib/products";

export const dynamic = "force-dynamic";

export default async function AdminDeliveryCoveragePage() {
  const [rates, productsResult] = await Promise.all([
    getAdminProductDeliveryRates(),
    getAdminProducts(),
  ]);

  return (
    <DeliveryCoverageClient
      initialRates={rates}
      products={productsResult.products.filter((product) => product.id)}
    />
  );
}
