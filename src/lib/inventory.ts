import "server-only";

import { requireAdmin } from "@/src/lib/admin-auth";
import { createAdminSupabaseClient } from "@/src/lib/supabase/admin";
import type { InventoryMovement, Product } from "@/src/types";

type ProductInventoryRow = {
  id: string;
  slug: string;
  name: string;
  price: number | string;
  unit: string;
  stock_quantity: number | string;
  minimum_order_quantity: number | string;
  status: Product["status"];
  categories: { name: string } | { name: string }[] | null;
};

type MovementRow = {
  id: string;
  product_id: string;
  order_id: string | null;
  order_item_id: string | null;
  movement_type: InventoryMovement["movementType"];
  quantity: number | string;
  previous_quantity: number | string;
  new_quantity: number | string;
  reason: string | null;
  created_at: string;
  products: { name: string } | { name: string }[] | null;
  orders:
    | { order_reference: string }
    | { order_reference: string }[]
    | null;
};

function first<T>(value: T | T[] | null) {
  return Array.isArray(value) ? value[0] ?? null : value;
}

function unitLabel(unit: string, quantity: number) {
  if (unit === "kg") return "kg";
  const label = unit.replaceAll("_", "-");
  return quantity === 1 ? label : `${label}s`;
}

export async function getAdminInventory() {
  await requireAdmin();
  const supabase = createAdminSupabaseClient();

  const [productsResult, movementsResult] = await Promise.all([
    supabase
      .from("products")
      .select(
        "id, slug, name, price, unit, stock_quantity, minimum_order_quantity, status, categories(name)",
      )
      .order("name"),
    supabase
      .from("inventory_movements")
      .select(
        "id, product_id, order_id, order_item_id, movement_type, quantity, previous_quantity, new_quantity, reason, created_at, products(name), orders(order_reference)",
      )
      .order("created_at", { ascending: false })
      .limit(30),
  ]);

  if (productsResult.error) {
    throw new Error(
      `Unable to load inventory products: ${productsResult.error.message}`,
    );
  }
  if (movementsResult.error) {
    throw new Error(
      movementsResult.error.code === "42703"
        ? "Run the updated database/step5-paystack.sql to enable linked inventory history."
        : `Unable to load inventory movements: ${movementsResult.error.message}`,
    );
  }

  const products: Product[] = (
    (productsResult.data ?? []) as unknown as ProductInventoryRow[]
  ).map((row) => {
    const stockCount = Number(row.stock_quantity);
    const minimumOrder = Number(row.minimum_order_quantity);
    const category = first(row.categories)?.name ?? "Uncategorized";
    return {
      id: row.id,
      slug: row.slug,
      name: row.name,
      price: Number(row.price),
      unit: row.unit.replaceAll("_", "-"),
      stock: `${stockCount} ${unitLabel(row.unit, stockCount)} available`,
      stockCount,
      minimumOrder,
      minimumUnit: unitLabel(row.unit, minimumOrder),
      category,
      availability:
        row.status === "active"
          ? "Available now"
          : row.status === "coming_soon"
            ? "Coming soon"
            : "Inactive",
      description: "",
      badge: "Farm produce",
      status: row.status,
    };
  });

  const movements: InventoryMovement[] = (
    (movementsResult.data ?? []) as unknown as MovementRow[]
  ).map((row) => ({
    id: row.id,
    productId: row.product_id,
    productName: first(row.products)?.name ?? "Deleted product",
    orderId: row.order_id,
    orderItemId: row.order_item_id,
    orderReference: first(row.orders)?.order_reference ?? null,
    movementType: row.movement_type,
    quantity: Math.abs(Number(row.quantity)),
    previousQuantity: Number(row.previous_quantity),
    newQuantity: Number(row.new_quantity),
    reason: row.reason,
    createdAt: row.created_at,
  }));

  return { products, movements };
}
