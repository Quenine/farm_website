"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { saveAdminDeliveryRate } from "@/src/lib/delivery-rates";

const deliveryRateSchema = z.object({
  id: z.string().uuid().optional(),
  state: z.string().trim().min(2).max(80),
  city: z.string().trim().min(2).max(120),
  deliveryMethod: z.enum(["home_delivery", "pickup_point", "farm_pickup"]),
  baseFee: z.number().nonnegative(),
  baseDeliveryUnits: z.number().nonnegative(),
  extraFeePerUnit: z.number().nonnegative(),
  estimatedDeliveryTime: z.string().trim().max(120).nullable().optional(),
  isActive: z.boolean(),
  sortOrder: z.number().int().min(0),
});

export type DeliveryRateActionState =
  | { success: true; rate: Awaited<ReturnType<typeof saveAdminDeliveryRate>> }
  | { success: false; message: string };

export async function saveDeliveryRateAction(
  input: z.input<typeof deliveryRateSchema>,
): Promise<DeliveryRateActionState> {
  try {
    const rate = await saveAdminDeliveryRate(deliveryRateSchema.parse(input));
    revalidatePath("/admin/delivery-zones");
    revalidatePath("/checkout");
    return { success: true, rate };
  } catch (error) {
    return {
      success: false,
      message: error instanceof Error ? error.message : "Unable to save delivery rate.",
    };
  }
}