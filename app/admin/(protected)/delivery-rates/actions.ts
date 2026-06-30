"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { saveAdminProductDeliveryRate } from "@/src/lib/product-delivery-rates";

const productDeliveryRateSchema = z.object({
  id: z.string().uuid().optional(),
  productId: z.string().uuid(),
  state: z.string().trim().min(2).max(80),
  city: z.string().trim().min(2).max(120),
  deliveryMethod: z.enum(["home_delivery", "pickup_point", "farm_pickup"]),
  packageSize: z.number().positive(),
  firstPackageFee: z.number().nonnegative(),
  extraPackageFee: z.number().nonnegative(),
  estimatedDeliveryTime: z.string().trim().max(120).nullable().optional(),
  isActive: z.boolean(),
  sortOrder: z.number().int().min(0),
});

export type ProductDeliveryRateActionState =
  | { success: true; rate: Awaited<ReturnType<typeof saveAdminProductDeliveryRate>> }
  | { success: false; message: string };

export async function saveProductDeliveryRateAction(
  input: z.input<typeof productDeliveryRateSchema>,
): Promise<ProductDeliveryRateActionState> {
  try {
    const rate = await saveAdminProductDeliveryRate(productDeliveryRateSchema.parse(input));
    revalidatePath("/admin/delivery-rates");
    revalidatePath("/checkout");
    return { success: true, rate };
  } catch (error) {
    return {
      success: false,
      message: error instanceof Error ? error.message : "Unable to save product delivery rate.",
    };
  }
}
