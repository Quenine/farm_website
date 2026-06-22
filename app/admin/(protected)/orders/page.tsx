import { AdminOrdersClient } from "@/app/admin/(protected)/orders/orders-client";
import { getAdminOrders } from "@/src/lib/orders";

export const dynamic = "force-dynamic";

export default async function AdminOrdersPage() {
  const orders = await getAdminOrders();
  return <AdminOrdersClient initialOrders={orders} />;
}
