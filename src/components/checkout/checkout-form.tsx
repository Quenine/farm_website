"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { siteConfig, siteContact } from "@/src/config/site";
import { createOrderAction } from "@/app/checkout/actions";
import { useCart } from "@/src/components/cart/cart-provider";
import { CartSummary } from "@/src/components/cart/cart-summary";
import { EmptyState } from "@/src/components/ui/empty-state";
import { getProductBySlug } from "@/src/lib/cart-store";
import {
  calculateDeliveryFromProductRates,
  deliveryDebugLines,
  supportsDeliveryMethod,
  type DeliveryCalculationResult,
  type DeliveryProductForCalculation,
} from "@/src/lib/delivery-calculator";
import { getQuantityInputType, getQuantityStep } from "@/src/lib/quantity";
import type { DeliveryMethod, Product, ProductDeliveryRate } from "@/src/types";

const whatsappHref = siteContact.whatsappHref;

const deliveryMethods: Array<{
  value: DeliveryMethod;
  label: string;
  description: string;
}> = [
  {
    value: "home_delivery",
    label: "Home Delivery",
    description: "Delivered to your address where available.",
  },
  {
    value: "pickup_point",
    label: "Pickup Point Delivery",
    description: "Delivered to a nearby agreed pickup point or logistics terminal.",
  },
  {
    value: "farm_pickup",
    label: "Farm Pickup / Direct Arrangement",
    description: "Pick up from the farm or arrange fulfilment directly with our team.",
  },
];

type FormFields = {
  customerName: string;
  customerEmail: string;
  customerPhone: string;
  deliveryMethod: DeliveryMethod;
  deliveryAddress: string;
  deliveryState: string;
  deliveryCity: string;
  deliveryDate: string;
  deliveryNote: string;
};

function uniqueSorted(values: string[]) {
  return [...new Set(values.filter(Boolean))].sort((a, b) => a.localeCompare(b));
}

function deliveryProduct(product: Product, quantity: number): DeliveryProductForCalculation {
  return {
    productId: product.id ?? "",
    name: product.name,
    quantity,
    minimumOrder: product.minimumOrder,
    stockCount: product.stockCount,
    quantityStep: getQuantityStep(product),
    quantityInputType: getQuantityInputType(product),
    supportsHomeDelivery: product.supportsHomeDelivery ?? true,
    supportsPickupPoint: product.supportsPickupPoint ?? true,
    supportsFarmPickup: product.supportsFarmPickup ?? true,
    requiresDeliveryConfirmation: product.requiresDeliveryConfirmation ?? false,
  };
}

function isKnownProduct(item: { line: { quantity: number }; product: Product | undefined }):
  item is { line: { quantity: number }; product: Product } {
  return Boolean(item.product);
}

export function CheckoutForm({ rates }: { rates: ProductDeliveryRate[] }) {
  const router = useRouter();
  const { lines, hydrated, clearCart } = useCart();
  const [fields, setFields] = useState<FormFields>({
    customerName: "",
    customerEmail: "",
    customerPhone: "",
    deliveryMethod: "home_delivery",
    deliveryAddress: "",
    deliveryState: rates[0]?.state ?? "",
    deliveryCity: rates[0]?.city ?? "",
    deliveryDate: "",
    deliveryNote: "",
  });
  const [message, setMessage] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string[]>>({});
  const [isPending, startTransition] = useTransition();

  const cartProducts = useMemo(
    () =>
      lines
        .map((line) => ({ line, product: line.product ?? getProductBySlug(line.slug) }))
        .filter(isKnownProduct),
    [lines],
  );

  const deliveryProducts = useMemo(
    () => cartProducts.map((item) => deliveryProduct(item.product as Product, item.line.quantity)),
    [cartProducts],
  );

  const subtotal = useMemo(
    () => cartProducts.reduce((sum, item) => sum + (item.product as Product).price * item.line.quantity, 0),
    [cartProducts],
  );

  const states = uniqueSorted(rates.filter((rate) => rate.isActive).map((rate) => rate.state));
  const cities = uniqueSorted(
    rates
      .filter((rate) => rate.isActive && rate.state === fields.deliveryState)
      .map((rate) => rate.city),
  );

  const availableDeliveryMethods = deliveryMethods.filter((method) =>
    deliveryProducts.every((product) => supportsDeliveryMethod(product, method.value)),
  );
  const selectedDeliveryMethod = availableDeliveryMethods.some(
    (method) => method.value === fields.deliveryMethod,
  )
    ? fields.deliveryMethod
    : availableDeliveryMethods[0]?.value;

  const calculation: DeliveryCalculationResult = selectedDeliveryMethod
    ? calculateDeliveryFromProductRates({
        rates,
        products: deliveryProducts,
        state: fields.deliveryState,
        city: fields.deliveryCity,
        deliveryMethod: selectedDeliveryMethod,
      })
    : {
        supported: false,
        code: "UNSUPPORTED_PRODUCT_DELIVERY_METHOD",
        reason: `Some items in your cart require direct fulfilment. Please contact {siteConfig.name} to complete this order.`,
        unsupportedProducts: deliveryProducts.map((product) => ({
          productId: product.productId,
          productName: product.name,
          deliveryMethod: fields.deliveryMethod,
        })),
      };
  const deliveryFee = calculation.supported ? calculation.deliveryFee : undefined;
  const debugLines = process.env.NODE_ENV !== "production" && !calculation.supported
    ? deliveryDebugLines(calculation)
    : [];

  const updateField = (key: keyof FormFields, value: string) => {
    setFields((current) => {
      const next = { ...current, [key]: value };
      if (key === "deliveryState") {
        const nextCity = rates.find((rate) => rate.state === value)?.city ?? "";
        next.deliveryCity = nextCity;
      }
      return next;
    });
    setFieldErrors((current) => ({ ...current, [key]: [] }));
    setMessage(null);
  };

  const submit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setMessage(null);
    setFieldErrors({});

    if (!selectedDeliveryMethod) {
      setMessage(`Some items in your cart require direct fulfilment. Please contact {siteConfig.name} to complete this order.`);
      return;
    }

    if (!calculation.supported) {
      setMessage(calculation.reason);
      return;
    }

    const items = lines.map((line) => ({
      productId: line.product?.id ?? "",
      quantity: line.quantity,
    }));

    if (items.some((item) => !item.productId)) {
      setMessage("One cart item is outdated. Remove it and add it again from the shop.");
      return;
    }

    startTransition(async () => {
      const result = await createOrderAction({
        ...fields,
        deliveryMethod: selectedDeliveryMethod,
        items,
      });
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
      const paymentMessage = result.paymentError
        ? `&paymentMessage=${encodeURIComponent(result.paymentError)}`
        : "";
      router.push(
        `/order-success?id=${encodeURIComponent(result.orderId)}&payment=initialization_failed${paymentMessage}`,
      );
    });
  };

  if (!hydrated) {
    return <div className="rounded-lg bg-white p-8 text-center text-sm text-stone-600 shadow-sm">Loading checkout...</div>;
  }

  if (lines.length === 0) {
    return <EmptyState title="No checkout items yet" body="Add products to your cart before creating an order." actionHref="/shop" actionLabel="Shop products" />;
  }

  if (rates.length === 0) {
    return <EmptyState title="Delivery rates are temporarily unavailable" body={`Online delivery is not currently available for this location. Please contact ${siteConfig.name} to arrange this order.`} actionHref="/contact" actionLabel="Contact us" />;
  }

  return (
    <div className="grid gap-8 lg:grid-cols-[1fr_380px]">
      <form onSubmit={submit} className="grid gap-5 rounded-lg bg-white p-6 shadow-sm">
        {message ? (
          <div role="alert" className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm font-semibold text-red-700">
            <p>{message}</p>
            <p className="mt-2 text-xs font-medium text-red-800">Try another delivery method or contact {siteConfig.name} for direct fulfilment.</p>
          </div>
        ) : null}
        <section className="grid gap-3 rounded-lg bg-green-50 p-4">
          <div>
            <h2 className="font-bold text-green-950">Delivery details</h2>
            <p className="mt-1 text-sm leading-6 text-green-900">
              Delivery options are based on the items in your cart.
            </p>
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            <label className="grid gap-2 text-sm font-semibold text-stone-800">
              State
              <select required value={fields.deliveryState} onChange={(event) => updateField("deliveryState", event.target.value)} className="h-12 rounded-lg border border-stone-200 bg-white px-4 text-sm font-normal text-stone-900 shadow-sm">
                {states.map((state) => <option key={state} value={state}>{state}</option>)}
              </select>
            </label>
            <label className="grid gap-2 text-sm font-semibold text-stone-800">
              City / Area
              <select required value={fields.deliveryCity} onChange={(event) => updateField("deliveryCity", event.target.value)} className="h-12 rounded-lg border border-stone-200 bg-white px-4 text-sm font-normal text-stone-900 shadow-sm">
                {cities.map((city) => <option key={city} value={city}>{city}</option>)}
              </select>
            </label>
          </div>
          {availableDeliveryMethods.length > 0 ? (
            <div className="grid gap-3">
              {availableDeliveryMethods.map((method) => (
                <label key={method.value} className={`grid cursor-pointer gap-1 rounded-lg border p-4 ${selectedDeliveryMethod === method.value ? "border-green-800 bg-white" : "border-green-100 bg-green-50"}`}>
                  <span className="flex items-center gap-3 text-sm font-bold text-green-950">
                    <input type="radio" checked={selectedDeliveryMethod === method.value} onChange={() => updateField("deliveryMethod", method.value)} />
                    {method.label}
                  </span>
                  <span className="pl-6 text-sm leading-6 text-stone-600">{method.description}</span>
                </label>
              ))}
            </div>
          ) : (
            <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm leading-6 text-amber-900">
              <p className="font-bold">Some items in your cart require direct fulfilment.</p>
              <p>Please contact {siteConfig.name} to complete this order.</p>
              <a href={whatsappHref} target="_blank" rel="noreferrer" className="mt-3 inline-flex rounded-full bg-green-800 px-4 py-2 text-xs font-bold text-white">
                Chat with {siteConfig.name} on WhatsApp
              </a>
            </div>
          )}
        </section>
        <div className="grid gap-5 md:grid-cols-2">
          <CheckoutInput name="customerName" label="Full name" placeholder="Adebayo Noble" value={fields.customerName} error={fieldErrors.customerName?.[0]} onChange={(value) => updateField("customerName", value)} />
          <CheckoutInput name="customerPhone" label="Phone number" placeholder="0803 000 0000" value={fields.customerPhone} error={fieldErrors.customerPhone?.[0]} onChange={(value) => updateField("customerPhone", value)} />
          <CheckoutInput name="customerEmail" label="Email" placeholder="orders@example.com" type="email" value={fields.customerEmail} error={fieldErrors.customerEmail?.[0]} onChange={(value) => updateField("customerEmail", value)} />
          <CheckoutInput name="deliveryDate" label={selectedDeliveryMethod === "farm_pickup" ? "Pickup date" : "Delivery date"} type="date" min={new Date().toISOString().slice(0, 10)} value={fields.deliveryDate} error={fieldErrors.deliveryDate?.[0]} onChange={(value) => updateField("deliveryDate", value)} />
        </div>
        <CheckoutInput name="deliveryAddress" label={selectedDeliveryMethod === "farm_pickup" ? "Pickup note/address (optional)" : "Delivery address"} placeholder={selectedDeliveryMethod === "farm_pickup" ? "Pickup arrangement or fulfilment detail" : "House number, street, landmark"} value={fields.deliveryAddress} required={selectedDeliveryMethod !== "farm_pickup"} error={fieldErrors.deliveryAddress?.[0]} onChange={(value) => updateField("deliveryAddress", value)} />
        <label className="grid gap-2 text-sm font-semibold text-stone-800">
          Delivery note
          <textarea name="deliveryNote" value={fields.deliveryNote} onChange={(event) => updateField("deliveryNote", event.target.value)} placeholder="Gate color, preferred call time, pickup detail, or handling instruction" rows={4} className="rounded-lg border border-stone-200 bg-white px-4 py-3 text-sm font-normal text-stone-900 shadow-sm" />
          {fieldErrors.deliveryNote?.[0] ? <span className="text-xs text-red-700">{fieldErrors.deliveryNote[0]}</span> : null}
        </label>
        <button type="submit" disabled={isPending || !calculation.supported || !selectedDeliveryMethod} className="inline-flex h-12 items-center justify-center rounded-full bg-green-800 px-6 text-sm font-bold text-white disabled:cursor-not-allowed disabled:opacity-60">
          {isPending ? "Starting secure payment..." : calculation.supported ? "Pay securely" : "Delivery unavailable"}
        </button>
      </form>
      <aside className="grid h-fit gap-4">
        <CartSummary subtotal={subtotal} deliveryFee={deliveryFee} deliveryFeeLabel={calculation.supported ? undefined : "Unavailable"} />
        <div className="rounded-lg bg-white p-4 text-sm leading-6 text-stone-700 shadow-sm">
          <p className="font-bold text-green-950">Delivery summary</p>
          {calculation.supported ? (
            <p>
              Delivery fee: <strong>{new Intl.NumberFormat("en-NG", { style: "currency", currency: "NGN", maximumFractionDigits: 0 }).format(calculation.deliveryFee)}</strong>
              {calculation.estimatedDeliveryTime ? <> · Estimated time: {calculation.estimatedDeliveryTime}</> : null}
            </p>
          ) : (
            <div className="grid gap-3">
              <p>{calculation.reason}</p>
              <p className="text-xs font-semibold text-stone-500">Try another delivery method or contact {siteConfig.name} for direct fulfilment.</p>
              {debugLines.length > 0 ? (
                <div className="rounded-lg bg-amber-50 p-3 text-xs font-semibold leading-5 text-amber-900">
                  {debugLines.map((line) => <p key={line}>{line}</p>)}
                </div>
              ) : null}
              <a href={whatsappHref} target="_blank" rel="noreferrer" className="inline-flex w-fit rounded-full bg-green-800 px-4 py-2 text-xs font-bold text-white">
                Chat with {siteConfig.name} on WhatsApp
              </a>
            </div>
          )}
        </div>
        <p className="text-xs leading-5 text-stone-500">Delivery is calculated based on location, order size, and handling requirements. Product prices, stock, delivery method support, and delivery fee are checked again securely before payment starts.</p>
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
  required = true,
  onChange,
}: {
  name: string;
  label: string;
  placeholder?: string;
  type?: string;
  value: string;
  error?: string;
  min?: string;
  required?: boolean;
  onChange: (value: string) => void;
}) {
  return (
    <label className="grid gap-2 text-sm font-semibold text-stone-800">
      {label}
      <input required={required} name={name} type={type} min={min} value={value} onChange={(event) => onChange(event.target.value)} placeholder={placeholder} className="h-12 rounded-lg border border-stone-200 bg-white px-4 text-sm font-normal text-stone-900 shadow-sm" />
      {error ? <span className="text-xs text-red-700">{error}</span> : null}
    </label>
  );
}






