"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createOrderAction } from "@/app/checkout/actions";
import { useCart } from "@/src/components/cart/cart-provider";
import { CartSummary } from "@/src/components/cart/cart-summary";
import { EmptyState } from "@/src/components/ui/empty-state";
import { calculateDeliveryFee } from "@/src/lib/delivery";
import { getProductBySlug } from "@/src/lib/cart-store";
import type { DeliverySettings, DeliveryZone } from "@/src/types";

type FormFields = {
  customerName: string;
  customerEmail: string;
  customerPhone: string;
  deliveryAddress: string;
  deliveryZoneId: string;
  deliveryDate: string;
  deliveryNote: string;
};

const initialFields: FormFields = {
  customerName: "",
  customerEmail: "",
  customerPhone: "",
  deliveryAddress: "",
  deliveryZoneId: "",
  deliveryDate: "",
  deliveryNote: "",
};

export function CheckoutForm({
  zones,
  settings,
}: {
  zones: DeliveryZone[];
  settings: DeliverySettings;
}) {
  const router = useRouter();
  const { lines, hydrated, clearCart } = useCart();
  const [fields, setFields] = useState({
    ...initialFields,
    deliveryZoneId: zones[0]?.id ?? "",
  });
  const [message, setMessage] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string[]>>({});
  const [isPending, startTransition] = useTransition();

  const subtotal = useMemo(
    () =>
      lines.reduce((sum, line) => {
        const product = line.product ?? getProductBySlug(line.slug);
        return product ? sum + product.price * line.quantity : sum;
      }, 0),
    [lines],
  );

  const selectedZone =
    zones.find((zone) => zone.id === fields.deliveryZoneId) ?? zones[0];
  const deliveryFee = selectedZone
    ? calculateDeliveryFee(selectedZone, settings)
    : 0;

  const updateField = (key: keyof FormFields, value: string) => {
    setFields((current) => ({ ...current, [key]: value }));
    setFieldErrors((current) => ({ ...current, [key]: [] }));
    setMessage(null);
  };

  const submit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setMessage(null);
    setFieldErrors({});

    const items = lines.map((line) => ({
      productId: line.product?.id ?? "",
      quantity: line.quantity,
    }));

    if (items.some((item) => !item.productId)) {
      setMessage(
        "One cart item is outdated. Remove it and add it again from the shop.",
      );
      return;
    }

    startTransition(async () => {
      const result = await createOrderAction({ ...fields, items });
      if (!result.success) {
        setMessage(result.message);
        setFieldErrors(result.fieldErrors ?? {});
        return;
      }

      clearCart();
      if (result.authorizationUrl) {
        window.location.assign(result.authorizationUrl);
        return;
      }
      router.push(
        `/order-success?id=${encodeURIComponent(result.orderId)}&payment=initialization_failed`,
      );
    });
  };

  if (!hydrated) {
    return (
      <div className="rounded-lg bg-white p-8 text-center text-sm text-stone-600 shadow-sm">
        Loading checkout…
      </div>
    );
  }

  if (lines.length === 0) {
    return (
      <EmptyState
        title="No checkout items yet"
        body="Add products to your cart before creating an order."
        actionHref="/shop"
        actionLabel="Shop products"
      />
    );
  }

  if (zones.length === 0) {
    return (
      <EmptyState
        title="Delivery is temporarily unavailable"
        body="No active delivery zones are configured. Please contact Noble Farms."
        actionHref="/contact"
        actionLabel="Contact us"
      />
    );
  }

  return (
    <div className="grid gap-8 lg:grid-cols-[1fr_380px]">
      <form
        onSubmit={submit}
        className="grid gap-5 rounded-lg bg-white p-6 shadow-sm"
      >
        {message ? (
          <div
            role="alert"
            className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm font-semibold text-red-700"
          >
            {message}
          </div>
        ) : null}
        <div className="grid gap-5 md:grid-cols-2">
          <CheckoutInput
            name="customerName"
            label="Full name"
            placeholder="Adebayo Noble"
            value={fields.customerName}
            error={fieldErrors.customerName?.[0]}
            onChange={(value) => updateField("customerName", value)}
          />
          <CheckoutInput
            name="customerPhone"
            label="Phone number"
            placeholder="0803 000 0000"
            value={fields.customerPhone}
            error={fieldErrors.customerPhone?.[0]}
            onChange={(value) => updateField("customerPhone", value)}
          />
          <CheckoutInput
            name="customerEmail"
            label="Email"
            placeholder="orders@example.com"
            type="email"
            value={fields.customerEmail}
            error={fieldErrors.customerEmail?.[0]}
            onChange={(value) => updateField("customerEmail", value)}
          />
          <label className="grid gap-2 text-sm font-semibold text-stone-800">
            Delivery area
            <select
              required
              value={fields.deliveryZoneId}
              onChange={(event) =>
                updateField("deliveryZoneId", event.target.value)
              }
              className="h-12 rounded-lg border border-stone-200 bg-white px-4 text-sm font-normal text-stone-900 shadow-sm"
            >
              {zones.map((zone) => (
                <option key={zone.id} value={zone.id}>
                  {zone.area}
                </option>
              ))}
            </select>
            {fieldErrors.deliveryZoneId?.[0] ? (
              <span className="text-xs text-red-700">
                {fieldErrors.deliveryZoneId[0]}
              </span>
            ) : null}
          </label>
          <CheckoutInput
            name="deliveryDate"
            label="Delivery date"
            type="date"
            min={new Date().toISOString().slice(0, 10)}
            value={fields.deliveryDate}
            error={fieldErrors.deliveryDate?.[0]}
            onChange={(value) => updateField("deliveryDate", value)}
          />
        </div>
        <CheckoutInput
          name="deliveryAddress"
          label="Delivery address"
          placeholder="House number, street, landmark"
          value={fields.deliveryAddress}
          error={fieldErrors.deliveryAddress?.[0]}
          onChange={(value) => updateField("deliveryAddress", value)}
        />
        <label className="grid gap-2 text-sm font-semibold text-stone-800">
          Delivery note
          <textarea
            name="deliveryNote"
            value={fields.deliveryNote}
            onChange={(event) => updateField("deliveryNote", event.target.value)}
            placeholder="Gate color, preferred call time, or handling instructions"
            rows={4}
            className="rounded-lg border border-stone-200 bg-white px-4 py-3 text-sm font-normal text-stone-900 shadow-sm"
          />
        </label>
        <button
          type="submit"
          disabled={isPending}
          className="inline-flex h-12 items-center justify-center rounded-full bg-green-800 px-6 text-sm font-bold text-white disabled:cursor-wait disabled:opacity-60"
        >
          {isPending ? "Creating order…" : "Create order"}
        </button>
      </form>
      <aside className="grid h-fit gap-4">
        <CartSummary subtotal={subtotal} deliveryFee={deliveryFee} />
        <div className="rounded-lg bg-white p-4 text-sm leading-6 text-stone-700 shadow-sm">
          <p className="font-bold text-green-950">Delivery calculation</p>
          <p>
            {selectedZone?.area}: {selectedZone?.distanceKm} km one-way. The
            final fee is recalculated securely when the order is created.
          </p>
        </div>
        <p className="text-xs leading-5 text-stone-500">
          Product prices and stock are checked again on the server. If a price
          changed after adding an item, the order uses the current price.
        </p>
      </aside>
    </div>
  );
}

function CheckoutInput({
  name,
  label,
  placeholder = "",
  type = "text",
  value,
  error,
  min,
  onChange,
}: {
  name: string;
  label: string;
  placeholder?: string;
  type?: string;
  value: string;
  error?: string;
  min?: string;
  onChange: (value: string) => void;
}) {
  return (
    <label className="grid gap-2 text-sm font-semibold text-stone-800">
      {label}
      <input
        required
        name={name}
        type={type}
        min={min}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        className="h-12 rounded-lg border border-stone-200 bg-white px-4 text-sm font-normal text-stone-900 shadow-sm"
      />
      {error ? <span className="text-xs text-red-700">{error}</span> : null}
    </label>
  );
}
