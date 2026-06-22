import { AdminHeader, AdminTable, StatCard, StatusBadge } from "@/src/components/admin";
import { formatNaira } from "@/src/lib/format";
import {
  formatOrderDate,
  formatOrderStatus,
  formatPaymentStatus,
} from "@/src/lib/order-format";
import { getAdminOrders } from "@/src/lib/orders";

export const dynamic = "force-dynamic";

export default async function AdminDashboardPage() {
  const orders = await getAdminOrders();
  const totalOrderValue = orders.reduce(
    (sum, order) => sum + order.totalAmount,
    0,
  );
  const count = (status: string) =>
    orders.filter((order) => order.orderStatus === status).length;
  const recentOrders = orders.slice(0, 5);

  return (
    <>
      <AdminHeader
        title="Dashboard"
        body="A live overview of Noble Farms orders and fulfilment status."
      />
      <div className="grid gap-4 md:grid-cols-3">
        <StatCard
          label="Total orders"
          value={String(orders.length)}
          note="All created customer orders"
        />
        <StatCard
          label="Pending payment"
          value={String(count("pending_payment"))}
          note="Awaiting Step 5 payment"
        />
        <StatCard
          label="Processing"
          value={String(count("processing"))}
          note="Currently being prepared"
        />
        <StatCard
          label="Delivered"
          value={String(count("delivered"))}
          note="Completed deliveries"
        />
        <StatCard
          label="Total order value"
          value={formatNaira(totalOrderValue)}
          note="Includes unpaid pending orders"
        />
      </div>
      <div className="mt-6">
        <AdminTable
          headers={[
            "Order",
            "Customer",
            "Amount",
            "Payment",
            "Status",
            "Delivery date",
          ]}
          rows={recentOrders.map((order) => [
            <span key="id" className="font-bold text-green-950">
              {order.reference}
            </span>,
            order.customerName,
            formatNaira(order.totalAmount),
            <StatusBadge
              key="payment"
              status={formatPaymentStatus(order.paymentStatus)}
            />,
            <StatusBadge
              key="status"
              status={formatOrderStatus(order.orderStatus)}
            />,
            formatOrderDate(order.deliveryDate),
          ])}
        />
      </div>
    </>
  );
}
