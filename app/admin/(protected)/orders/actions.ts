"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireAdmin } from "@/src/lib/admin-auth";
import { confirmAdminOrderDeliveryFee, updateAdminOrderStatus } from "@/src/lib/orders";

const statusSchema = z.enum([
  "pending_delivery_quote",
  "pending_payment",
  "processing",
  "packed",
  "out_for_delivery",
  "delivered",
  "cancelled",
]);

const deliveryFeeSchema = z.object({
  orderId: z.string().uuid(),
  deliveryFee: z.number().nonnegative(),
});

export async function updateOrderStatusAction(input: {
  orderId: string;
  status: z.infer<typeof statusSchema>;
}) {
  await requireAdmin();
  try {
    const order = await updateAdminOrderStatus(
      z.string().uuid().parse(input.orderId),
      statusSchema.parse(input.status),
    );
    revalidatePath("/admin");
    revalidatePath("/admin/orders");
    revalidatePath("/track-order");
    return { success: true as const, order };
  } catch (error) {
    return {
      success: false as const,
      message:
        error instanceof Error
          ? error.message
          : "Unable to update order status.",
    };
  }
}

export async function confirmDeliveryFeeAction(input: z.input<typeof deliveryFeeSchema>) {
  await requireAdmin();
  try {
    const parsed = deliveryFeeSchema.parse(input);
    const order = await confirmAdminOrderDeliveryFee(parsed.orderId, parsed.deliveryFee);
    revalidatePath("/admin");
    revalidatePath("/admin/orders");
    revalidatePath("/track-order");
    revalidatePath(`/order-success?id=${order.id}`);
    return { success: true as const, order };
  } catch (error) {
    return {
      success: false as const,
      message:
        error instanceof Error
          ? error.message
          : "Unable to confirm delivery fee.",
    };
  }
}