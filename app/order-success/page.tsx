import Link from "next/link";
import { CheckCircle2 } from "lucide-react";
import { notFound } from "next/navigation";
import { z } from "zod";
import { PayNowButton } from "@/src/components/payments/pay-now-button";
import { PurchaseTracker } from "@/src/components/marketing-purchase-tracker";
import { siteConfig } from "@/src/config/site";
import { PageShell } from "@/src/components/ui";
import { formatNaira } from "@/src/lib/format";
import {
  formatOrderStatus,
  formatPaymentStatus,
} from "@/src/lib/order-format";
import { getOrderSuccess } from "@/src/lib/orders";
import type { DeliveryMethod } from "@/src/types";
import { PushOptIn } from "@/src/components/push-opt-in";

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
      <PurchaseTracker
        paid={isPaid}
        reference={order.reference}
        total={order.totalAmount}
        shipping={order.deliveryFee}
        items={order.items.map((item) => ({ item_id: item.productId ?? item.productName, item_name: item.productName, item_variant: item.unit, price: item.unitPrice, quantity: item.quantity }))}
      />
      <section className="mx-auto grid min-h-[60vh] max-w-3xl place-items-center px-4 py-16 sm:px-6 lg:px-8">
        <div className="min-w-0 w-full overflow-hidden rounded-lg bg-white p-4 shadow-sm sm:p-8">
          <div className="text-center">
            <CheckCircle2 className="mx-auto text-green-700" size={56} />
            <h1 className="mt-5 text-4xl font-bold text-green-950">
              {isPaid ? "Payment confirmed" : "Order created"}
            </h1>
            <p className="mt-4 text-stone-700">
              {isPaid ? `Your payment is confirmed and ${siteConfig.name} is processing your order.` : "Your order is pending payment. Complete payment to move it into processing."}
            </p>
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
          <div className="mt-6"><PushOptIn context="customer" order={{ reference: order.reference, phone: order.customerPhone }} /></div>
        </div>
      </section>
    </PageShell>
  );
}

function formatDeliveryMethod(method: DeliveryMethod) {
  const labels = {
    home_delivery: "Home Delivery",
    pickup_point: "Pickup Point Delivery",
    farm_pickup: "Farm Pickup / Direct Arrangement",
  };
  return labels[method] ?? method;
}

function Summary({ label, value }: { label: string; value: string }) {
  return (
    <div className="grid min-w-0 gap-1 border-b border-stone-200 pb-2 min-[390px]:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)]">
      <span className="text-stone-500">{label}</span>
      <strong className="break-words text-left text-stone-950 min-[390px]:text-right [overflow-wrap:anywhere]">{value}</strong>
    </div>
  );
}



