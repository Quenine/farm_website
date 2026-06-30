"use client";

import { useMemo, useState, useTransition } from "react";
import { confirmDeliveryFeeAction, updateOrderStatusAction } from "@/app/admin/(protected)/orders/actions";
import { AdminHeader, AdminTable, StatusBadge } from "@/src/components/admin";
import { formatNaira } from "@/src/lib/format";
import {
  formatOrderDate,
  formatOrderStatus,
  formatPaymentStatus,
} from "@/src/lib/order-format";
import type { Order } from "@/src/types";

const statuses = [
  "pending_delivery_quote",
  "pending_payment",
  "processing",
  "packed",
  "out_for_delivery",
  "delivered",
  "cancelled",
] as const;
type EditableStatus = (typeof statuses)[number];
type Filter = "all" | EditableStatus;

export function AdminOrdersClient({ initialOrders }: { initialOrders: Order[] }) {
  const [items, setItems] = useState(initialOrders);
  const [selected, setSelected] = useState<Order | null>(null);
  const [filter, setFilter] = useState<Filter>("all");
  const [message, setMessage] = useState<string | null>(null);
  const [deliveryFeeInput, setDeliveryFeeInput] = useState("");
  const [isPending, startTransition] = useTransition();

  const filtered = useMemo(
    () =>
      filter === "all"
        ? items
        : items.filter((order) => order.orderStatus === filter),
    [filter, items],
  );

  const updateStatus = (order: Order, status: EditableStatus) => {
    setMessage(null);
    startTransition(async () => {
      const result = await updateOrderStatusAction({
        orderId: order.id,
        status,
      });
      if (!result.success) {
        setMessage(result.message);
        return;
      }
      setItems((current) =>
        current.map((item) =>
          item.id === result.order.id ? result.order : item,
        ),
      );
      setSelected(result.order);
      setMessage("Order status updated.");
    });
  };

  const confirmDeliveryFee = (order: Order) => {
    setMessage(null);
    startTransition(async () => {
      const result = await confirmDeliveryFeeAction({
        orderId: order.id,
        deliveryFee: Number(deliveryFeeInput),
      });
      if (!result.success) {
        setMessage(result.message);
        return;
      }
      setItems((current) =>
        current.map((item) =>
          item.id === result.order.id ? result.order : item,
        ),
      );
      setSelected(result.order);
      setDeliveryFeeInput("");
      setMessage("Delivery fee confirmed. Customer can now pay from Track Order.");
    });
  };

  return (
    <>
      <AdminHeader
        title="Orders management"
        body="Review real customer orders, payment state, fulfilment status, and delivery details."
      />
      {message ? (
        <div className="mb-4 rounded-lg border border-green-200 bg-green-50 p-4 text-sm font-semibold text-green-800">
          {message}
        </div>
      ) : null}
      <div className="mb-4 flex justify-end">
        <label className="flex items-center gap-3 text-sm font-semibold text-stone-700">
          Filter status
          <select
            value={filter}
            onChange={(event) => setFilter(event.target.value as Filter)}
            className="h-10 rounded-lg border border-stone-200 bg-white px-3"
          >
            <option value="all">All</option>
            {statuses.map((status) => (
              <option key={status} value={status}>
                {formatOrderStatus(status)}
              </option>
            ))}
          </select>
        </label>
      </div>
      <AdminTable
        headers={[
          "Order",
          "Customer",
          "Phone",
          "Amount",
          "Payment",
          "Order status",
          "Delivery date",
          "Actions",
        ]}
        rows={filtered.map((order) => [
          <span key="id" className="font-bold text-green-950">
            {order.reference}
          </span>,
          order.customerName,
          order.customerPhone,
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
          <button
            key="view"
            type="button"
            onClick={() => {
              setMessage(null);
              setSelected(order);
              setDeliveryFeeInput(order.deliveryFee ? String(order.deliveryFee) : "");
            }}
            className="h-9 rounded-full bg-green-50 px-3 text-xs font-bold text-green-800"
          >
            View
          </button>,
        ])}
      />
      {selected ? (
        <div className="fixed inset-0 z-50 grid place-items-center bg-green-950/50 p-4">
          <div className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-lg bg-white p-6 shadow-xl">
            <h2 className="text-xl font-bold text-green-950">
              Order {selected.reference}
            </h2>
            <div className="mt-5 grid gap-3 text-sm text-stone-700 sm:grid-cols-2">
              <Detail label="Customer" value={selected.customerName} />
              <Detail label="Phone" value={selected.customerPhone} />
              <Detail label="Email" value={selected.customerEmail} />
              <Detail label="Delivery method" value={formatDeliveryMethod(selected.deliveryMethod)} />
              <Detail label="Area" value={selected.deliveryArea} />
              <Detail label="State" value={selected.deliveryState ?? "Not applicable"} />
              <Detail label="City/Town" value={selected.deliveryCity ?? "Not applicable"} />
              <Detail label="Delivery quote required" value={selected.deliveryQuoteRequired ? "Yes" : "No"} />
              <Detail label="Delivery fee confirmed" value={selected.deliveryFeeConfirmed ? "Yes" : "No"} />
              <Detail
                label="Delivery date"
                value={formatOrderDate(selected.deliveryDate)}
              />
              <Detail
                label="Payment"
                value={formatPaymentStatus(selected.paymentStatus)}
              />
              <Detail
                label="Payment provider"
                value={selected.paymentProvider ?? "Not paid"}
              />
              <Detail
                label="Paystack reference"
                value={selected.paystackReference ?? "Not initialized"}
              />
              <Detail
                label="Paid at"
                value={
                  selected.paidAt
                    ? new Date(selected.paidAt).toLocaleString("en-NG")
                    : "Not paid"
                }
              />
              <Detail
                label="Inventory status"
                value={
                  selected.inventoryDeducted
                    ? "Deducted"
                    : selected.paymentStatus === "paid"
                      ? "Not fully recorded"
                      : "Awaiting verified payment"
                }
              />
              <Detail
                label="Inventory movements"
                value={String(selected.inventoryMovementCount)}
              />
              <Detail label="Address" value={selected.deliveryAddress} />
              <Detail label="Delivery fee" value={formatNaira(selected.deliveryFee)} />
              <Detail label="Delivery pricing model" value={selected.deliveryPricingModel} />
              <Detail label="Delivery package count" value={String(selected.deliveryPackageCount)} />
              <Detail label="Legacy delivery units" value={String(selected.deliveryUnits)} />
              <Detail label="Legacy handling fee" value={formatNaira(selected.handlingFee)} />
              <Detail label="Estimated delivery" value={selected.estimatedDeliveryTime ?? "Not set"} />
              <Detail label="Total" value={formatNaira(selected.totalAmount)} />
            </div>
            {selected.deliveryRateBreakdown ? (
              <div className="mt-6 rounded-lg border border-stone-200 bg-stone-50 p-4 text-sm text-stone-800">
                <h3 className="font-bold text-green-950">Delivery rate breakdown</h3>
                <pre className="mt-3 max-h-60 overflow-auto whitespace-pre-wrap rounded bg-white p-3 text-xs">{JSON.stringify(selected.deliveryRateBreakdown, null, 2)}</pre>
              </div>
            ) : null}
            {selected.deliveryQuoteRequired && !selected.deliveryFeeConfirmed ? (
              <div className="mt-6 rounded-lg border border-green-200 bg-green-50 p-4 text-sm text-green-950">
                <h3 className="font-bold">Confirm manual delivery fee</h3>
                <p className="mt-2 text-green-900">Set the confirmed delivery fee for this manual arrangement. Once saved, this order becomes payable from Track Order.</p>
                <div className="mt-3 flex flex-col gap-2 sm:flex-row">
                  <input
                    type="number"
                    min={0}
                    step="any"
                    value={deliveryFeeInput}
                    onChange={(event) => setDeliveryFeeInput(event.target.value)}
                    className="h-11 flex-1 rounded-lg border border-green-200 px-3"
                    placeholder="Delivery fee"
                  />
                  <button
                    type="button"
                    disabled={isPending}
                    onClick={() => confirmDeliveryFee(selected)}
                    className="h-11 rounded-full bg-green-800 px-5 text-sm font-bold text-white disabled:opacity-60"
                  >
                    Confirm fee
                  </button>
                </div>
              </div>
            ) : null}
            {selected.paymentStatus === "pending" ||
            selected.paymentStatus === "failed" ? (
              <div className="mt-6 rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-950">
                <h3 className="font-bold">Payment debug</h3>
                <div className="mt-3 grid gap-2 sm:grid-cols-2">
                  <Detail
                    label="Customer email present"
                    value={selected.customerEmail.trim() ? "Yes" : "No"}
                  />
                  <Detail
                    label="Total amount"
                    value={formatNaira(selected.totalAmount)}
                  />
                  <Detail
                    label="Payment status"
                    value={formatPaymentStatus(selected.paymentStatus)}
                  />
                  <Detail
                    label="Latest Paystack reference"
                    value={selected.paystackReference ?? "Not initialized"}
                  />
                </div>
              </div>
            ) : null}
            <div className="mt-6">
              <h3 className="font-bold text-green-950">Order items</h3>
              <div className="mt-3 divide-y divide-stone-100 rounded-lg border border-stone-200">
                {selected.items.map((item) => {
                  const exceedsStock =
                    item.currentStock !== null &&
                    item.currentStock !== undefined &&
                    item.quantity > item.currentStock;
                  return (
                    <div key={item.id} className="p-4 text-sm">
                      <div className="flex justify-between gap-4">
                        <div>
                          <p className="font-bold text-stone-950">
                            {item.productName}
                          </p>
                          <p className="text-stone-500">
                            {item.quantity} {item.unit} ×{" "}
                            {formatNaira(item.unitPrice)}
                          </p>
                        </div>
                        <strong>{formatNaira(item.totalPrice)}</strong>
                      </div>
                      {exceedsStock ? (
                        <p className="mt-2 rounded bg-red-50 p-2 text-xs font-semibold text-red-700">
                          Ordered quantity exceeds current stock of{" "}
                          {item.currentStock}.
                        </p>
                      ) : null}
                      {selected.inventoryDeducted ? (
                        <p className="mt-2 text-xs font-semibold text-green-700">
                          Inventory impact: {item.quantity} {item.unit} deducted
                          after verified payment.
                        </p>
                      ) : null}
                    </div>
                  );
                })}
              </div>
            </div>
            <label className="mt-6 grid gap-2 text-sm font-semibold">
              Order status
              <select
                disabled={isPending}
                value={selected.orderStatus}
                onChange={(event) =>
                  updateStatus(
                    selected,
                    event.target.value as EditableStatus,
                  )
                }
                className="h-11 rounded-lg border border-stone-200 bg-white px-3 font-normal"
              >
                {selected.orderStatus === "payment_review" ? (
                  <option value="payment_review" disabled>
                    {formatOrderStatus("payment_review")}
                  </option>
                ) : null}
                {statuses.map((status) => (
                  <option key={status} value={status}>
                    {formatOrderStatus(status)}
                  </option>
                ))}
              </select>
            </label>
            <button
              type="button"
              onClick={() => setSelected(null)}
              className="mt-6 h-11 w-full rounded-full bg-green-800 px-5 text-sm font-bold text-white"
            >
              Close
            </button>
          </div>
        </div>
      ) : null}
    </>
  );
}

function formatDeliveryMethod(method: Order["deliveryMethod"]) {
  const labels = {
    home_delivery: "Home Delivery",
    pickup_point: "Pickup Point Delivery",
    farm_pickup: "Farm Pickup / Direct Arrangement",
  };
  return labels[method];
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <p>
      <strong>{label}:</strong> {value}
    </p>
  );
}


