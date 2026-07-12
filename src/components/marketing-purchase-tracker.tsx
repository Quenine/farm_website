"use client";

import { useEffect } from "react";
import { trackPurchase, type AnalyticsItem } from "@/src/lib/analytics";

export function PurchaseTracker({ reference, total, shipping, items, paid }: { reference: string; total: number; shipping: number; items: AnalyticsItem[]; paid: boolean }) {
  useEffect(() => {
    if (paid) trackPurchase({ transactionId: reference, value: total, shipping, items });
  }, [paid, reference, shipping, total, items]);
  return null;
}
