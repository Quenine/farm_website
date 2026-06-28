import { products } from "@/src/lib/business-data";
import type { CartLine, Product } from "@/src/types";

export const CART_STORAGE_KEY = "noble-farms-cart";

export function getProductBySlug(slug: string) {
  return products.find((product) => product.slug === slug);
}

export function clampQuantity(product: Product, quantity: number) {
  return Math.min(
    Math.max(Math.round(quantity), product.minimumOrder),
    product.stockCount,
  );
}

export function normalizeCart(stored: string | CartLine[] | null): CartLine[] {
  if (!stored) {
    return [];
  }

  try {
    const parsed =
      typeof stored === "string" ? (JSON.parse(stored) as CartLine[]) : stored;
    if (!Array.isArray(parsed)) {
      return [];
    }

    return parsed
      .map((line) => {
        if (
          !line ||
          typeof line.slug !== "string" ||
          typeof line.quantity !== "number" ||
          !Number.isFinite(line.quantity)
        ) {
          return null;
        }
        const product = line.product ?? getProductBySlug(line.slug);
        if (!product) {
          return null;
        }
        return {
          slug: line.slug,
          quantity: clampQuantity(product, line.quantity),
          product,
        };
      })
      .filter(
        (line): line is NonNullable<typeof line> => line !== null,
      );
  } catch {
    return [];
  }
}

export function persistCart(lines: CartLine[]) {
  try {
    window.localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(lines));
  } catch {
    // The cart still works in memory when storage is unavailable.
  }
}
