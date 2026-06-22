import Link from "next/link";
import { AlertTriangle, CheckCircle2, Clock3 } from "lucide-react";
import { z } from "zod";
import { PayNowButton } from "@/src/components/payments/pay-now-button";
import { PageShell } from "@/src/components/ui";
import { formatNaira } from "@/src/lib/format";
import {
  formatOrderDate,
  formatOrderStatus,
  formatPaymentStatus,
} from "@/src/lib/order-format";
import { getOrderSuccess } from "@/src/lib/orders";

export const dynamic = "force-dynamic";

const resultSchema = z.enum([
  "paid",
  "already_confirmed",
  "review",
  "failed",
  "pending",
  "invalid",
  "error",
]);

export default async function PaymentStatusPage({
  searchParams,
}: {
  searchParams: Promise<{ id?: string; result?: string }>;
}) {
  const { id, result: rawResult } = await searchParams;
  const result = resultSchema.safeParse(rawResult).success
    ? (rawResult as z.infer<typeof resultSchema>)
    : "error";
  const parsedId = z.string().uuid().safeParse(id);
  const order = parsedId.success ? await getOrderSuccess(parsedId.data) : null;
  const presentation = getPresentation(result, order?.paymentStatus === "paid");
  const Icon = presentation.icon;

  return (
    <PageShell>
      <section className="mx-auto grid min-h-[60vh] max-w-3xl place-items-center px-4 py-16 sm:px-6 lg:px-8">
        <div className="w-full rounded-lg bg-white p-8 shadow-sm">
          <div className="text-center">
            <Icon
              className={`mx-auto ${presentation.iconClass}`}
              size={56}
            />
            <h1 className="mt-5 text-4xl font-bold text-green-950">
              {presentation.title}
            </h1>
            <p className="mt-4 text-stone-700">{presentation.message}</p>
          </div>

          {order ? (
            <div className="mt-7 grid gap-3 rounded-lg bg-stone-50 p-5 text-sm text-stone-700 sm:grid-cols-2">
              <Summary label="Order reference" value={order.reference} />
              <Summary
                label="Payment status"
                value={formatPaymentStatus(order.paymentStatus)}
              />
              <Summary
                label="Order status"
                value={formatOrderStatus(order.orderStatus)}
              />
              <Summary
                label="Total amount"
                value={formatNaira(order.totalAmount)}
              />
              <Summary
                label="Delivery date"
                value={formatOrderDate(order.deliveryDate)}
              />
            </div>
          ) : null}

          <div className="mt-7 flex flex-col items-center justify-center gap-3 sm:flex-row">
            {order && order.paymentStatus !== "paid" ? (
              <PayNowButton orderId={order.id} label="Retry Payment" />
            ) : null}
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
            {order ? (
              <Link
                href={`/order-success?id=${encodeURIComponent(order.id)}`}
                className="inline-flex h-12 items-center justify-center rounded-full border border-green-800 px-6 text-sm font-bold text-green-950"
              >
                View order
              </Link>
            ) : null}
          </div>
        </div>
      </section>
    </PageShell>
  );
}

function getPresentation(result: string, orderIsPaid: boolean) {
  if (orderIsPaid || result === "paid" || result === "already_confirmed") {
    return {
      icon: CheckCircle2,
      iconClass: "text-green-700",
      title:
        result === "already_confirmed"
          ? "Payment already confirmed"
          : "Payment successful",
      message:
        "Your payment is confirmed and Noble Farms is processing your order.",
    };
  }
  if (result === "review") {
    return {
      icon: AlertTriangle,
      iconClass: "text-amber-700",
      title: "Payment received — order under review",
      message:
        "Payment was received, but stock changed before confirmation. The owner will review this order.",
    };
  }
  if (result === "pending") {
    return {
      icon: Clock3,
      iconClass: "text-amber-700",
      title: "Payment pending",
      message:
        "Paystack has not confirmed this transaction yet. You may retry or track the order.",
    };
  }
  if (result === "invalid") {
    return {
      icon: AlertTriangle,
      iconClass: "text-red-700",
      title: "Invalid payment reference",
      message:
        "The payment callback did not include a valid reference. Track your order to retry payment.",
    };
  }
  return {
    icon: AlertTriangle,
    iconClass: "text-red-700",
    title: result === "failed" ? "Payment failed" : "Payment not confirmed",
    message:
      "We could not confirm this payment. No duplicate stock change was made. You can retry safely.",
  };
}

function Summary({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-4 border-b border-stone-200 pb-2">
      <span className="text-stone-500">{label}</span>
      <strong className="text-right text-stone-950">{value}</strong>
    </div>
  );
}
