"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireAdmin } from "@/src/lib/admin-auth";
import { updateAdminOrderStatus } from "@/src/lib/orders";

const statusSchema = z.enum([
  "pending_payment",
  "processing",
  "packed",
  "out_for_delivery",
  "delivered",
  "cancelled",
]);

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
