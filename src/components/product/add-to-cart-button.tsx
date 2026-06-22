"use client";

import { useState } from "react";
import { ShoppingCart } from "lucide-react";
import { useCart } from "@/src/components/cart/cart-provider";
import type { Product } from "@/src/types";

export function AddToCartButton({
  product,
  quantity,
  className = "",
}: {
  product: Product;
  quantity?: number;
  className?: string;
}) {
  const [added, setAdded] = useState(false);
  const { addItem } = useCart();
  const unavailable =
    product.status === "coming_soon" ||
    product.status === "inactive" ||
    product.stockCount < product.minimumOrder;

  return (
    <button
      type="button"
      disabled={unavailable}
      onClick={() => {
        if (unavailable) return;
        addItem(product, quantity ?? product.minimumOrder);
        setAdded(true);
        window.setTimeout(() => setAdded(false), 1400);
      }}
      className={
        className ||
        "inline-flex h-11 flex-1 items-center justify-center gap-2 rounded-full bg-green-800 px-4 text-sm font-bold text-white transition hover:bg-green-900 disabled:cursor-not-allowed disabled:bg-stone-300"
      }
    >
      <ShoppingCart size={17} />
      {unavailable ? "Unavailable" : added ? "Added" : "Add to Cart"}
    </button>
  );
}
