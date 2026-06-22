"use client";

import { useState, useTransition } from "react";
import { Search } from "lucide-react";
import { trackOrderAction } from "@/app/track-order/actions";
import { PayNowButton } from "@/src/components/payments/pay-now-button";
import { formatNaira } from "@/src/lib/format";
import {
  formatOrderDate,
  formatOrderStatus,
  formatPaymentStatus,
} from "@/src/lib/order-format";
import type { Order } from "@/src/types";

export function TrackOrderForm() {
  const [reference, setReference] = useState("");
  const [phone, setPhone] = useState("");
  const [order, setOrder] = useState<Order | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const submit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setMessage(null);
    setOrder(null);
    startTransition(async () => {
      const result = await trackOrderAction({ reference, phone });
      if (!result.success) {
        setMessage(result.message);
        return;
      }
      setOrder(result.order);
    });
  };

  return (
    <div className="mt-8 rounded-lg bg-white p-6 shadow-sm">
      <form
        onSubmit={submit}
        className="grid gap-4 md:grid-cols-[1fr_1fr_auto] md:items-end"
      >
        <TrackingInput
          label="Order reference"
          value={reference}
          placeholder="NF-20260620-AB12"
          onChange={setReference}
        />
        <TrackingInput
          label="Phone number"
          value={phone}
          placeholder="0803 000 0000"
          onChange={setPhone}
        />
        <button
          type="submit"
          disabled={isPending}
          className="inline-flex h-12 items-center justify-center gap-2 rounded-full bg-green-800 px-6 text-sm font-bold text-white disabled:cursor-wait disabled:opacity-60"
        >
          <Search size={17} />
          {isPending ? "Checking…" : "Track"}
        </button>
      </form>
      {message ? (
        <div
          role="alert"
          className="mt-6 rounded-lg border border-red-200 bg-red-50 p-4 text-sm font-semibold text-red-700"
        >
          {message}
        </div>
      ) : null}
      {order ? <TrackedOrder order={order} /> : null}
    </div>
  );
}

function TrackedOrder({ order }: { order: Order }) {
  return (
    <div className="mt-8 grid gap-6">
      <div className="grid gap-3 rounded-lg bg-green-50 p-5 text-sm text-green-950 md:grid-cols-2">
        <Detail label="Order reference" value={order.reference} />
        <Detail label="Order status" value={formatOrderStatus(order.orderStatus)} />
        <Detail
          label="Payment status"
          value={formatPaymentStatus(order.paymentStatus)}
        />
        <Detail label="Delivery date" value={formatOrderDate(order.deliveryDate)} />
        <Detail label="Delivery area" value={order.deliveryArea} />
        <Detail label="Delivery address" value={order.deliveryAddress} />
        <Detail label="Subtotal" value={formatNaira(order.subtotal)} />
        <Detail label="Delivery fee" value={formatNaira(order.deliveryFee)} />
        <Detail label="Total amount" value={formatNaira(order.totalAmount)} />
      </div>
      {order.paymentStatus === "paid" ? (
        <div className="rounded-lg border border-green-200 bg-green-50 p-4 text-sm font-semibold text-green-800">
          Payment confirmed. Your order is in the Noble Farms fulfilment queue.
        </div>
      ) : order.paymentStatus === "pending" ||
        order.paymentStatus === "failed" ? (
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-4">
          <p className="mb-3 text-sm font-semibold text-amber-900">
            {order.paymentStatus === "failed"
              ? "The last payment attempt failed. You can retry safely without creating another order."
              : "This order is awaiting payment."}
          </p>
          <PayNowButton
            reference={order.reference}
            phone={order.customerPhone}
            label={order.paymentStatus === "failed" ? "Retry Payment" : "Pay Now"}
          />
        </div>
      ) : null}
      <div>
        <h2 className="text-lg font-bold text-green-950">Order items</h2>
        <div className="mt-3 divide-y divide-stone-100 rounded-lg border border-stone-200">
          {order.items.map((item) => (
            <div
              key={item.id}
              className="flex flex-wrap justify-between gap-3 p-4 text-sm"
            >
              <div>
                <p className="font-bold text-stone-950">{item.productName}</p>
                <p className="text-stone-500">
                  {item.quantity} {item.unit} × {formatNaira(item.unitPrice)}
                </p>
              </div>
              <p className="font-bold text-green-950">
                {formatNaira(item.totalPrice)}
              </p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function TrackingInput({
  label,
  value,
  placeholder,
  onChange,
}: {
  label: string;
  value: string;
  placeholder: string;
  onChange: (value: string) => void;
}) {
  return (
    <label className="grid gap-2 text-sm font-semibold text-stone-800">
      {label}
      <input
        required
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        className="h-12 rounded-lg border border-stone-200 bg-white px-4 font-normal shadow-sm"
      />
    </label>
  );
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-4 border-b border-green-200 pb-2">
      <span className="text-green-800">{label}</span>
      <strong className="text-right">{value}</strong>
    </div>
  );
}
