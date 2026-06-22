"use server";

import "server-only";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireAdmin } from "@/src/lib/admin-auth";
import {
  deactivateAdminProduct,
  saveAdminProduct,
} from "@/src/lib/products";

const productSchema = z
  .object({
    id: z.string().uuid().optional(),
    name: z.string().trim().min(2).max(120),
    slug: z
      .string()
      .trim()
      .min(2)
      .max(140)
      .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
    description: z.string().trim().min(5).max(2000),
    category: z.string().trim().min(2).max(100),
    price: z.number().nonnegative(),
    unit: z.string().trim().min(1).max(40),
    stockCount: z.number().nonnegative(),
    minimumOrder: z.number().positive(),
    status: z.enum(["active", "inactive", "coming_soon"]),
    availableFrom: z.string().nullable().optional(),
    isFeatured: z.boolean(),
    isLiveAnimal: z.boolean(),
    isProcessed: z.boolean(),
  })
  .refine(
    (product) =>
      product.status !== "coming_soon" || Boolean(product.availableFrom),
    {
      message: "Coming soon products require an available-from date.",
      path: ["availableFrom"],
    },
  );

export type ProductActionState =
  | { success: true; product: Awaited<ReturnType<typeof saveAdminProduct>> }
  | { success: false; message: string };

export async function saveProductAction(
  input: z.input<typeof productSchema>,
): Promise<ProductActionState> {
  await requireAdmin();
  try {
    const product = await saveAdminProduct(productSchema.parse(input));
    revalidatePath("/");
    revalidatePath("/admin/products");
    revalidatePath("/shop");
    revalidatePath(`/shop/${product.slug}`);
    revalidatePath("/shop/[slug]", "page");
    return { success: true, product };
  } catch (error) {
    return {
      success: false,
      message: error instanceof Error ? error.message : "Unable to save product.",
    };
  }
}

export async function deactivateProductAction(
  id: string,
): Promise<ProductActionState> {
  await requireAdmin();
  try {
    const product = await deactivateAdminProduct(z.string().uuid().parse(id));
    revalidatePath("/");
    revalidatePath("/admin/products");
    revalidatePath("/shop");
    revalidatePath(`/shop/${product.slug}`);
    revalidatePath("/shop/[slug]", "page");
    return { success: true, product };
  } catch (error) {
    return {
      success: false,
      message:
        error instanceof Error ? error.message : "Unable to deactivate product.",
    };
  }
}
