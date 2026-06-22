"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import {
  CART_STORAGE_KEY,
  normalizeCart,
  persistCart,
} from "@/src/lib/cart-store";
import type { CartLine, Product } from "@/src/types";

type CartContextValue = {
  lines: CartLine[];
  itemCount: number;
  hydrated: boolean;
  addItem: (product: Product, quantity?: number) => void;
  updateQuantity: (slug: string, quantity: number) => void;
  removeItem: (slug: string) => void;
  clearCart: () => void;
};

const CartContext = createContext<CartContextValue | null>(null);

export function CartProvider({ children }: { children: React.ReactNode }) {
  const [lines, setLines] = useState<CartLine[]>([]);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    const hydrationTimer = window.setTimeout(() => {
      setLines(normalizeCart(window.localStorage.getItem(CART_STORAGE_KEY)));
      setHydrated(true);
    }, 0);

    const syncFromStorage = (event: StorageEvent) => {
      if (event.key === CART_STORAGE_KEY) {
        setLines(normalizeCart(event.newValue));
      }
    };

    window.addEventListener("storage", syncFromStorage);
    return () => {
      window.clearTimeout(hydrationTimer);
      window.removeEventListener("storage", syncFromStorage);
    };
  }, []);

  const commit = useCallback((update: (current: CartLine[]) => CartLine[]) => {
    setLines((current) => {
      const next = update(current);
      persistCart(next);
      return next;
    });
  }, []);

  const addItem = useCallback(
    (product: Product, quantity = product.minimumOrder) => {
      commit((current) => {
        const existing = current.find((line) => line.slug === product.slug);
        if (!existing) {
          return normalizeCart([
            ...current,
            { slug: product.slug, quantity, product },
          ]);
        }

        return normalizeCart(
          current.map((line) =>
            line.slug === product.slug
              ? { ...line, quantity: line.quantity + quantity, product }
              : line,
          ),
        );
      });
    },
    [commit],
  );

  const updateQuantity = useCallback(
    (slug: string, quantity: number) => {
      commit((current) =>
        normalizeCart(
          current.map((line) =>
            line.slug === slug ? { ...line, quantity } : line,
          ),
        ),
      );
    },
    [commit],
  );

  const removeItem = useCallback(
    (slug: string) => {
      commit((current) => current.filter((line) => line.slug !== slug));
    },
    [commit],
  );

  const clearCart = useCallback(() => {
    commit(() => []);
  }, [commit]);

  const value = useMemo(
    () => ({
      lines,
      itemCount: lines.reduce((sum, line) => sum + line.quantity, 0),
      hydrated,
      addItem,
      updateQuantity,
      removeItem,
      clearCart,
    }),
    [
      addItem,
      clearCart,
      hydrated,
      lines,
      removeItem,
      updateQuantity,
    ],
  );

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart() {
  const context = useContext(CartContext);
  if (!context) {
    throw new Error("useCart must be used within CartProvider");
  }
  return context;
}
