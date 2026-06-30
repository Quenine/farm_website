import { AdminProductsClient } from "@/app/admin/(protected)/products/products-client";
import { getAdminProducts } from "@/src/lib/products";

export const dynamic = "force-dynamic";

type AdminProductsPageProps = {
  searchParams: Promise<{ product?: string | string[] | undefined }>;
};

export default async function AdminProductsPage({ searchParams }: AdminProductsPageProps) {
  const [{ products, usingFallback }, query] = await Promise.all([
    getAdminProducts(),
    searchParams,
  ]);
  const requestedProduct = Array.isArray(query.product)
    ? query.product[0]
    : query.product;

  return (
    <AdminProductsClient
      initialProducts={products}
      usingFallback={usingFallback}
      initialProductId={requestedProduct}
    />
  );
}