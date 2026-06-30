import { AdminProductDeliveryRatesClient } from "@/app/admin/(protected)/delivery-rates/product-delivery-rates-client";
import { getAdminProductDeliveryRates } from "@/src/lib/product-delivery-rates";
import { getAdminProducts } from "@/src/lib/products";

export const dynamic = "force-dynamic";

type DeliveryRatesPageProps = {
  searchParams: Promise<{ product?: string | string[] | undefined }>;
};

export default async function AdminProductDeliveryRatesPage({
  searchParams,
}: DeliveryRatesPageProps) {
  const [rates, productsResult, query] = await Promise.all([
    getAdminProductDeliveryRates(),
    getAdminProducts(),
    searchParams,
  ]);
  const requestedProduct = Array.isArray(query.product)
    ? query.product[0]
    : query.product;

  return (
    <AdminProductDeliveryRatesClient
      initialRates={rates}
      products={productsResult.products.filter((product) => product.id)}
      initialProductId={requestedProduct}
    />
  );
}