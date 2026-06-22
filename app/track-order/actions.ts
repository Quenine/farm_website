"use server";

import { z } from "zod";
import { trackOrder } from "@/src/lib/orders";
import type { Order } from "@/src/types";

const trackingSchema = z.object({
  reference: z.string().trim().min(6).max(40),
  phone: z.string().trim().min(7).max(30),
});

export type TrackOrderResult =
  | { success: true; order: Order }
  | { success: false; message: string };

export async function trackOrderAction(input: {
  reference: string;
  phone: string;
}): Promise<TrackOrderResult> {
  const parsed = trackingSchema.safeParse(input);
  if (!parsed.success) {
    return {
      success: false,
      message: "Enter a valid order reference and phone number.",
    };
  }

  try {
    const order = await trackOrder(parsed.data.reference, parsed.data.phone);
    return order
      ? { success: true, order }
      : {
          success: false,
          message:
            "No order matched that reference and phone number. Check both entries and try again.",
        };
  } catch {
    return {
      success: false,
      message: "Unable to track the order right now. Please try again.",
    };
  }
}
