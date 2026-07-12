import { AdminProductDeliveryRatesClient } from "@/app/admin/(protected)/delivery-rates/product-delivery-rates-client";
import { getAdminProductDeliveryRates } from "@/src/lib/product-delivery-rates";
import { getAdminProducts } from "@/src/lib/products";

export const dynamic = "force-dynamic";

type DeliveryRatesPageProps = {
  searchParams: Promise<{ product?: string | string[] | undefined; state?: string | string[] | undefined; city?: string | string[] | undefined; method?: string | string[] | undefined; }>;
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
  const requestedState = Array.isArray(query.state) ? query.state[0] : query.state;
  const requestedCity = Array.isArray(query.city) ? query.city[0] : query.city;
  const requestedMethod = Array.isArray(query.method) ? query.method[0] : query.method;

  return (
    <AdminProductDeliveryRatesClient
      initialRates={rates}
      products={productsResult.products.filter((product) => product.id)}
      initialProductId={requestedProduct}
      initialState={requestedState}
      initialCity={requestedCity}
      initialDeliveryMethod={requestedMethod}
    />
  );
}

