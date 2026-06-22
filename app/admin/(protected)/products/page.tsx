import { AdminProductsClient } from "@/app/admin/(protected)/products/products-client";
import { getAdminProducts } from "@/src/lib/products";

export const dynamic = "force-dynamic";

export default async function AdminProductsPage() {
  const { products, usingFallback } = await getAdminProducts();
  return (
    <AdminProductsClient
      initialProducts={products}
      usingFallback={usingFallback}
    />
  );
}
