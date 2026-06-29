import Link from "next/link";
import { CheckCircle2 } from "lucide-react";
import { notFound } from "next/navigation";
import { z } from "zod";
import { PayNowButton } from "@/src/components/payments/pay-now-button";
import { PageShell } from "@/src/components/ui";
import { formatNaira } from "@/src/lib/format";
import {
  formatOrderStatus,
  formatPaymentStatus,
} from "@/src/lib/order-format";
import { getOrderSuccess } from "@/src/lib/orders";

export const dynamic = "force-dynamic";

export default async function OrderSuccessPage({
  searchParams,
}: {
  searchParams: Promise<{ id?: string; payment?: string; paymentMessage?: string }>;
}) {
  const { id, payment, paymentMessage } = await searchParams;
  const parsedId = z.string().uuid().safeParse(id);
  if (!parsedId.success) notFound();

  const order = await getOrderSuccess(parsedId.data);
  if (!order) notFound();
  const isPaid = order.paymentStatus === "paid";
  const paymentAvailable = !order.deliveryQuoteRequired && order.deliveryFeeConfirmed;

  return (
    <PageShell>
      <section className="mx-auto grid min-h-[60vh] max-w-3xl place-items-center px-4 py-16 sm:px-6 lg:px-8">
        <div className="w-full rounded-lg bg-white p-8 shadow-sm">
          <div className="text-center">
            <CheckCircle2 className="mx-auto text-green-700" size={56} />
            <h1 className="mt-5 text-4xl font-bold text-green-950">
              {isPaid ? "Payment confirmed" : order.deliveryQuoteRequired ? "Order request created" : "Order created"}
            </h1>
            <p className="mt-4 text-stone-700">
              {isPaid
                ? "Your payment is confirmed and Noble Farms is processing your order."
                : order.deliveryQuoteRequired
                  ? "Your order request has been created. Noble Farms will confirm product availability and delivery cost before payment."
                  : "Your order is pending payment. Complete payment to move it into processing."}
            </p>
            {payment === "delivery_quote_pending" && !isPaid ? (
              <p className="mt-3 rounded-lg bg-green-50 p-3 text-sm font-semibold text-green-900">
                Your order request has been received. Noble Farms will confirm delivery cost and availability before payment.
              </p>
            ) : null}
            {payment === "initialization_failed" && !isPaid ? (
              <p className="mt-3 rounded-lg bg-amber-50 p-3 text-sm font-semibold text-amber-900">
                {paymentMessage ||
                  "The order was saved, but Paystack checkout could not open. Please retry below."}
              </p>
            ) : null}
          </div>
          <div className="mt-7 grid gap-3 rounded-lg bg-stone-50 p-5 text-sm text-stone-700 sm:grid-cols-2">
            <Summary label="Order reference" value={order.reference} />
            <Summary label="Customer" value={order.customerName} />
            <Summary label="Subtotal" value={formatNaira(order.subtotal)} />
            <Summary
              label="Delivery fee"
              value={formatNaira(order.deliveryFee)}
            />
            <Summary
              label="Total amount"
              value={formatNaira(order.totalAmount)}
            />
            <Summary
              label="Payment status"
              value={formatPaymentStatus(order.paymentStatus)}
            />
            <Summary
              label="Order status"
              value={formatOrderStatus(order.orderStatus)}
            />
            <Summary label="Delivery method" value={formatDeliveryMethod(order.deliveryMethod)} />
            {order.deliveryState ? <Summary label="State" value={order.deliveryState} /> : null}
            {order.deliveryCity ? <Summary label="City/Town" value={order.deliveryCity} /> : null}
            <Summary label="Delivery date" value={order.deliveryDate} />
          </div>
          <div className="mt-7 flex flex-col justify-center gap-3 sm:flex-row">
            {!isPaid && paymentAvailable ? <PayNowButton orderId={order.id} /> : null}
            <Link
              href="/track-order"
              className="inline-flex h-12 items-center justify-center rounded-full bg-green-800 px-6 text-sm font-bold text-white"
            >
              Track order
            </Link>
            <Link
              href="/shop"
              className="inline-flex h-12 items-center justify-center rounded-full border border-green-800 px-6 text-sm font-bold text-green-950"
            >
              Continue shopping
            </Link>
          </div>
        </div>
      </section>
    </PageShell>
  );
}

function formatDeliveryMethod(method: "local_delivery" | "pickup" | "wider_delivery") {
  const labels = {
    local_delivery: "Local Scheduled Delivery",
    pickup: "Farm Pickup / Direct Arrangement",
    wider_delivery: "Wider Produce Delivery",
  };
  return labels[method];
}

function Summary({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-4 border-b border-stone-200 pb-2">
      <span className="text-stone-500">{label}</span>
      <strong className="text-right text-stone-950">{value}</strong>
    </div>
  );
}
