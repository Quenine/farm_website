import { AdminHeader, AdminTable, StatCard, StatusBadge } from "@/src/components/admin";
import { formatNaira } from "@/src/lib/format";
import {  formatOrderStatus,
  formatPaymentStatus,
} from "@/src/lib/order-format";
import { getAdminOrders } from "@/src/lib/orders";
import { getAdminProductDeliveryRates } from "@/src/lib/product-delivery-rates";
import { getAdminProducts } from "@/src/lib/products";
import type { DeliveryMethod, Product, ProductDeliveryRate } from "@/src/types";

export const dynamic = "force-dynamic";

const commonDestinations: Array<{ state: string; city: string; method: DeliveryMethod }> = [
  { state: "Oyo", city: "Ibadan", method: "home_delivery" },
  { state: "Oyo", city: "Ibadan", method: "pickup_point" },
  { state: "Oyo", city: "Ibadan", method: "farm_pickup" },
  { state: "Lagos", city: "Lagos Mainland", method: "home_delivery" },
  { state: "Lagos", city: "Lagos Mainland", method: "pickup_point" },
];

function todayInLagos() {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Africa/Lagos",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());
  const value = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${value.year}-${value.month}-${value.day}`;
}

function supportsMethod(product: Product, method: DeliveryMethod) {
  if (product.requiresDeliveryConfirmation) return false;
  if (method === "home_delivery") return product.supportsHomeDelivery ?? true;
  if (method === "pickup_point") return product.supportsPickupPoint ?? true;
  return product.supportsFarmPickup ?? true;
}

function hasRate(rates: ProductDeliveryRate[], product: Product, destination: { state: string; city: string; method: DeliveryMethod }) {
  return rates.some(
    (rate) =>
      rate.isActive &&
      rate.productId === product.id &&
      rate.deliveryMethod === destination.method &&
      rate.state.trim().toLowerCase() === destination.state.toLowerCase() &&
      [destination.city.toLowerCase(), "all"].includes(rate.city.trim().toLowerCase()),
  );
}

function isOrderable(product: Product) {
  return product.id && product.status === "active" && product.isOrderableOnline !== false && product.pricingMode !== "quote_required" && product.price > 0;
}

export default async function AdminDashboardPage() {
  const [orders, productsResult, deliveryRates] = await Promise.all([
    getAdminOrders(),
    getAdminProducts(),
    getAdminProductDeliveryRates(),
  ]);
  const products = productsResult.products;
  const today = todayInLagos();
  const todayOrders = orders.filter((order) => order.createdAt.slice(0, 10) === today);
  const pendingPayment = orders.filter((order) => order.paymentStatus === "pending" || order.paymentStatus === "failed");
  const paidProcessing = orders.filter((order) => order.paymentStatus === "paid" && ["processing", "packed", "out_for_delivery"].includes(order.orderStatus));
  const fulfilmentQueue = orders.filter((order) => order.paymentStatus === "paid" && !["delivered", "cancelled", "refunded"].includes(order.orderStatus));
  const recentPaidOrders = orders.filter((order) => order.paymentStatus === "paid").slice(0, 5);
  const lowStockProducts = products
    .filter((product) => isOrderable(product) && product.stockCount <= Math.max(product.minimumOrder * 2, 5))
    .slice(0, 8);
  const orderableProducts = products.filter(isOrderable);
  const missingRateCount = orderableProducts.reduce((count, product) => {
    const missingForProduct = commonDestinations.filter(
      (destination) => supportsMethod(product, destination.method) && !hasRate(deliveryRates, product, destination),
    ).length;
    return count + missingForProduct;
  }, 0);
  const totalOrderValue = orders.reduce((sum, order) => sum + order.totalAmount, 0);

  return (
    <>
      <AdminHeader
        title="Dashboard"
        body="A live overview of Noble Farms orders, payments, fulfilment, stock, and delivery rate readiness."
      />
      <div className="mb-5 rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm leading-6 text-amber-900">
        Before accepting online orders for a destination, every orderable product must have an active Product Delivery Rate for that destination and delivery method, or an All-city fallback.
      </div>
      <div className="grid gap-4 md:grid-cols-3">
        <StatCard label="Today’s orders" value={String(todayOrders.length)} note="Orders created today" />
        <StatCard label="Pending payment" value={String(pendingPayment.length)} note="Awaiting successful Paystack payment" />
        <StatCard label="Paid / processing" value={String(paidProcessing.length)} note="Paid orders being prepared or delivered" />
        <StatCard label="Needs fulfilment" value={String(fulfilmentQueue.length)} note="Paid orders not yet delivered" />
        <StatCard label="Low stock products" value={String(lowStockProducts.length)} note="Orderable products near minimum stock" />
        <StatCard label="Delivery rate gaps" value={String(missingRateCount)} note="Common destination/method gaps to review" />
        <StatCard label="Total order value" value={formatNaira(totalOrderValue)} note="Includes unpaid pending orders" />
      </div>
      <div className="mt-6 grid gap-6 xl:grid-cols-2">
        <section>
          <h2 className="mb-3 text-lg font-bold text-green-950">Recent paid orders</h2>
          <AdminTable
            headers={["Order", "Customer", "Phone", "Total", "Payment", "Status", "Delivery"]}
            rows={recentPaidOrders.map((order) => [
              <span key="id" className="font-bold text-green-950">{order.reference}</span>,
              order.customerName,
              order.customerPhone,
              formatNaira(order.totalAmount),
              <StatusBadge key="payment" status={formatPaymentStatus(order.paymentStatus)} />,
              <StatusBadge key="status" status={formatOrderStatus(order.orderStatus)} />,
              `${order.deliveryCity ?? ""}${order.deliveryState ? `, ${order.deliveryState}` : ""}` || order.deliveryArea,
            ])}
          />
        </section>
        <section>
          <h2 className="mb-3 text-lg font-bold text-green-950">Low stock products</h2>
          <AdminTable
            headers={["Product", "Stock", "Minimum order", "Status"]}
            rows={lowStockProducts.map((product) => [
              <span key="product" className="font-bold text-green-950">{product.name}</span>,
              `${product.stockCount} ${product.unit}`,
              `${product.minimumOrder} ${product.unit}`,
              product.availability,
            ])}
          />
        </section>
      </div>
    </>
  );
}