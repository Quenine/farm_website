"use client";

import Link from "next/link";
import { ShoppingCart } from "lucide-react";
import { useCart } from "@/src/components/cart/cart-provider";

export function CartLink() {
  const { itemCount, hydrated } = useCart();

  return (
    <Link
      href="/cart"
      aria-label="Cart"
      className="relative inline-flex size-11 shrink-0 items-center justify-center gap-2 rounded-full bg-green-800 px-2 text-sm font-bold text-white shadow-sm transition hover:bg-green-900 min-[390px]:w-auto min-[390px]:px-4"
    >
      <ShoppingCart size={17} />
      <span className="hidden min-[390px]:inline">Cart</span>
      {hydrated && itemCount > 0 ? (
        <span className="grid min-w-6 place-items-center rounded-full bg-amber-300 px-1.5 py-0.5 text-xs font-black text-green-950">
          {itemCount}
        </span>
      ) : null}
    </Link>
  );
}
