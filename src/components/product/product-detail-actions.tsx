"use client";

import { useState } from "react";
import type { Product } from "@/src/types";
import { AddToCartButton } from "@/src/components/product/add-to-cart-button";
import { QuantitySelector } from "@/src/components/product/quantity-selector";
import { isProductOrderable } from "@/src/lib/product-pricing";

export function ProductDetailActions({ product }: { product: Product }) {
  const [quantity, setQuantity] = useState(product.minimumOrder);

  if (!isProductOrderable(product)) {
    return null;
  }

  return (
    <div className="mt-8 grid gap-4">
      <QuantitySelector
        value={quantity}
        min={product.minimumOrder}
        max={product.stockCount}
        unit={product.minimumUnit}
        onChange={setQuantity}
      />
      <AddToCartButton
        product={product}
        quantity={quantity}
        className="inline-flex h-12 w-full items-center justify-center gap-2 rounded-full bg-green-800 px-5 text-sm font-bold text-white transition hover:bg-green-900"
      />
    </div>
  );
}
