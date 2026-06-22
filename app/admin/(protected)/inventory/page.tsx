import { AdminHeader, AdminTable, StatCard, StatusBadge } from "@/src/components/admin";
import { getAdminInventory } from "@/src/lib/inventory";

export const dynamic = "force-dynamic";

export default async function AdminInventoryPage() {
  const { products, movements } = await getAdminInventory();
  const lowStockProducts = products.filter(
    (product) =>
      product.stockCount <= Math.max(product.minimumOrder * 2, 10),
  );
  const stockOutMovements = movements.filter(
    (movement) => movement.movementType === "stock_out",
  );

  return (
    <>
      <AdminHeader
        title="Inventory management"
        body="Current Supabase stock balances and the audit history of every inventory change."
      />
      <div className="grid gap-4 md:grid-cols-3">
        <StatCard
          label="Tracked products"
          value={String(products.length)}
          note="Current products in the catalogue"
        />
        <StatCard
          label="Low-stock products"
          value={String(lowStockProducts.length)}
          note="At or below the reorder threshold"
        />
        <StatCard
          label="Recent paid deductions"
          value={String(stockOutMovements.length)}
          note="Shown in the latest movement history"
        />
      </div>

      {lowStockProducts.length > 0 ? (
        <div className="mt-6 rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
          <p className="font-bold">Low-stock alert</p>
          <p className="mt-1">
            {lowStockProducts
              .map(
                (product) =>
                  `${product.name}: ${product.stockCount} ${product.unit}`,
              )
              .join(" • ")}
          </p>
        </div>
      ) : null}

      <section className="mt-6">
        <h2 className="mb-4 text-xl font-bold text-green-950">
          Current stock
        </h2>
        <AdminTable
          headers={[
            "Product",
            "Category",
            "Current stock",
            "Minimum order",
            "Availability",
          ]}
          rows={products.map((product) => [
            <span key="name" className="font-bold text-green-950">
              {product.name}
            </span>,
            product.category,
            `${product.stockCount} ${product.unit}`,
            `${product.minimumOrder} ${product.minimumUnit}`,
            <StatusBadge key="availability" status={product.availability} />,
          ])}
        />
      </section>

      <section className="mt-8">
        <h2 className="mb-4 text-xl font-bold text-green-950">
          Recent inventory movements
        </h2>
        <AdminTable
          headers={[
            "Date",
            "Product",
            "Type",
            "Quantity",
            "Previous",
            "New",
            "Order",
            "Reason",
          ]}
          rows={movements.map((movement) => [
            new Date(movement.createdAt).toLocaleString("en-NG"),
            <span key="product" className="font-bold text-green-950">
              {movement.productName}
            </span>,
            movement.movementType.replaceAll("_", " "),
            movement.quantity,
            movement.previousQuantity,
            movement.newQuantity,
            movement.orderReference ?? "—",
            movement.reason ?? "—",
          ])}
        />
      </section>
    </>
  );
}
