"use client";

import Link from "next/link";
import { useMemo } from "react";
import { Trash2 } from "lucide-react";
import { useCart } from "@/src/components/cart/cart-provider";
import { CartSummary } from "@/src/components/cart/cart-summary";
import { QuantitySelector } from "@/src/components/product/quantity-selector";
import { EmptyState } from "@/src/components/ui/empty-state";
import {
  getProductBySlug,
} from "@/src/lib/cart-store";
import { formatNaira } from "@/src/lib/format";

export function CartPageClient() {
  const {
    lines,
    hydrated,
    updateQuantity,
    removeItem,
    clearCart,
  } = useCart();

  const items = useMemo(
    () =>
      lines
        .map((line) => {
          const product = line.product ?? getProductBySlug(line.slug);
          return product ? { product, quantity: line.quantity } : null;
        })
        .filter((item): item is NonNullable<typeof item> => Boolean(item)),
    [lines],
  );

  const subtotal = items.reduce(
    (sum, item) => sum + item.product.price * item.quantity,
    0,
  );

  if (!hydrated) {
    return (
      <div className="rounded-lg bg-white p-8 text-center text-sm text-stone-600 shadow-sm">
        Loading cart…
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <EmptyState
        title="Your cart is empty"
        body="Add poultry, eggs, or farm supplies from the shop and they will stay here in localStorage for now."
        actionHref="/shop"
        actionLabel="Go to shop"
      />
    );
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_340px]">
      <div>
        <div className="mb-3 flex justify-end">
          <button
            type="button"
            onClick={clearCart}
            className="h-10 rounded-full bg-red-50 px-4 text-sm font-bold text-red-700"
          >
            Clear cart
          </button>
        </div>
        <div className="overflow-hidden rounded-lg bg-white shadow-sm">
        {items.map((item) => (
          <div
            key={item.product.slug}
            className="grid gap-4 border-b border-stone-100 p-5 md:grid-cols-[1fr_220px_auto_auto] md:items-center"
          >
            <div>
              <p className="font-bold text-green-950">{item.product.name}</p>
              <p className="mt-1 text-sm text-stone-600">
                {formatNaira(item.product.price)} per {item.product.unit}
              </p>
              <p className="mt-1 text-xs font-semibold text-amber-800">
                Minimum: {item.product.minimumOrder} {item.product.minimumUnit}
              </p>
            </div>
            <QuantitySelector
              value={item.quantity}
              min={item.product.minimumOrder}
              max={item.product.stockCount}
              unit={item.product.minimumUnit}
              onChange={(quantity) => updateQuantity(item.product.slug, quantity)}
            />
            <p className="font-bold text-stone-950">
              {formatNaira(item.product.price * item.quantity)}
            </p>
            <button
              type="button"
              aria-label={`Remove ${item.product.name}`}
              onClick={() => removeItem(item.product.slug)}
              className="grid size-10 place-items-center rounded-full bg-red-50 text-red-700"
            >
              <Trash2 size={17} />
            </button>
          </div>
        ))}
        </div>
      </div>
      <div className="grid h-fit gap-4">
        <CartSummary subtotal={subtotal} />
        <Link
          href="/checkout"
          className="inline-flex h-12 items-center justify-center rounded-full bg-green-800 px-6 text-sm font-bold text-white"
        >
          Checkout
        </Link>
        <Link
          href="/shop"
          className="inline-flex h-12 items-center justify-center rounded-full border border-green-800 px-6 text-sm font-bold text-green-950"
        >
          Continue shopping
        </Link>
      </div>
    </div>
  );
}
