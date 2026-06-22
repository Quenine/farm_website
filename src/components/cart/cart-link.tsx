"use client";

import Link from "next/link";
import { ShoppingCart } from "lucide-react";
import { useCart } from "@/src/components/cart/cart-provider";

export function CartLink() {
  const { itemCount, hydrated } = useCart();

  return (
    <Link
      href="/cart"
      className="relative inline-flex h-11 items-center gap-2 rounded-full bg-green-800 px-4 text-sm font-bold text-white shadow-sm transition hover:bg-green-900"
    >
      <ShoppingCart size={17} />
      Cart
      {hydrated && itemCount > 0 ? (
        <span className="grid min-w-6 place-items-center rounded-full bg-amber-300 px-1.5 py-0.5 text-xs font-black text-green-950">
          {itemCount}
        </span>
      ) : null}
    </Link>
  );
}
