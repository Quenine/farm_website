"use server";

import "server-only";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { siteConfig } from "@/src/config/site";
import { z } from "zod";
import { requireAdmin } from "@/src/lib/admin-auth";
import {
  deactivateAdminProduct,
  mapProductMedia,
  saveAdminProduct,
} from "@/src/lib/products";
import { createAdminSupabaseClient } from "@/src/lib/supabase/admin";
import type { ProductMedia } from "@/src/types";

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
    stockAlertThreshold: z.number().nonnegative().nullable().optional(),
    minimumOrder: z.number().positive(),
    quantityStep: z.number().positive().default(1),
    quantityInputType: z.preprocess(
      (value) => (value === "decimal" ? "decimal" : "whole"),
      z.enum(["whole", "decimal"]),
    ),
    status: z.enum(["active", "inactive", "coming_soon"]),
    availableFrom: z.string().nullable().optional(),
    isFeatured: z.boolean(),
    featuredSortOrder: z.number().int().min(0).default(100),
    isLiveAnimal: z.boolean(),
    isProcessed: z.boolean(),
    supportsWiderDelivery: z.boolean().default(false),
    deliveryClass: z.enum([
      "standard",
      "fragile",
      "perishable",
      "fragile_produce",
      "heavy_produce",
      "live_animal",
      "fresh_food",
      "bulky_farm_input",
    ]).default("standard"),
    deliveryUnitValue: z.number().positive().default(1),
    handlingFee: z.number().nonnegative().default(0),
    supportsHomeDelivery: z.boolean().default(true),
    supportsPickupPoint: z.boolean().default(true),
    supportsFarmPickup: z.boolean().default(true),
    requiresDeliveryConfirmation: z.boolean().default(false),
    pricingMode: z.preprocess(
      (value) => (value === "quote_required" ? "quote_required" : "fixed"),
      z.enum(["fixed", "quote_required"]),
    ),
    isOrderableOnline: z.preprocess((value) => {
      if (typeof value === "boolean") return value;
      if (typeof value === "string") {
        return ["true", "1", "yes", "on"].includes(value.toLowerCase());
      }
      return true;
    }, z.boolean()),
    displayPriceLabel: z
      .string()
      .trim()
      .max(80)
      .transform((value) => value || null)
      .nullable()
      .optional(),
  })
  .refine(
    (product) =>
      product.quantityInputType === "decimal" || Number.isInteger(product.quantityStep),
    {
      path: ["quantityStep"],
      message: "Whole-number products need a whole-number quantity step.",
    },
  )
  .transform((product) => ({
    ...product,
    isOrderableOnline:
      product.pricingMode === "quote_required"
        ? false
        : product.isOrderableOnline,
    displayPriceLabel:
      product.pricingMode === "quote_required"
        ? product.displayPriceLabel || "Check Availability"
        : product.displayPriceLabel,
  }))
  .refine(
    (product) =>
      product.status !== "coming_soon" || Boolean(product.availableFrom),
    {
      message: "Scheduled availability products require an available-from date.",
      path: ["availableFrom"],
    },
  )
  .refine(
    (product) => product.pricingMode !== "fixed" || product.price > 0,
    {
      message: "Fixed-price products require a price greater than zero.",
      path: ["price"],
    },
  );

const mediaMetaSchema = z.object({
  mediaId: z.string().uuid(),
  altText: z.string().trim().max(160).nullable().optional(),
  caption: z.string().trim().max(240).nullable().optional(),
});

export type ProductActionState =
  | { success: true; product: Awaited<ReturnType<typeof saveAdminProduct>> }
  | { success: false; message: string };

export type ProductMediaActionState =
  | { success: true; media: ProductMedia[] }
  | { success: false; message: string };

function revalidateProductPaths(slug?: string) {
  revalidatePath("/");
  revalidatePath("/admin/products");
  revalidatePath("/shop");
  if (slug) revalidatePath(`/shop/${slug}`);
  revalidatePath("/shop/[slug]", "page");
}

export async function saveProductAction(
  input: z.input<typeof productSchema>,
): Promise<ProductActionState> {
  await requireAdmin();
  try {
    const product = await saveAdminProduct(productSchema.parse(input));
    revalidateProductPaths(product.slug);
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
    revalidateProductPaths(product.slug);
    return { success: true, product };
  } catch (error) {
    return {
      success: false,
      message:
        error instanceof Error ? error.message : "Unable to deactivate product.",
    };
  }
}

function validUpload(file: File, mediaType: "image" | "video") {
  const allowedImageTypes = ["image/jpeg", "image/png", "image/webp"];
  const allowedVideoTypes = ["video/mp4", "video/webm"];
  const allowedTypes = mediaType === "image" ? allowedImageTypes : allowedVideoTypes;
  const maxBytes = 5 * 1024 * 1024;
  if (!allowedTypes.includes(file.type)) {
    throw new Error(
      mediaType === "image"
        ? "Images must be JPEG, PNG, or WebP."
        : "Videos must be MP4 or WebM.",
    );
  }
  if (file.size > maxBytes) {
    throw new Error(
      mediaType === "image"
        ? "Image uploads must be 5MB or smaller."
        : "Video uploads must be 5MB or smaller.",
    );
  }
}

function safeFileName(name: string) {
  const extension = name.split(".").pop()?.toLowerCase().replace(/[^a-z0-9]/g, "") || "bin";
  return `${randomUUID()}.${extension}`;
}

async function loadProductMedia(productId: string) {
  const supabase = createAdminSupabaseClient();
  const { data, error } = await supabase
    .from("product_media")
    .select("id, product_id, media_type, url, storage_path, alt_text, caption, sort_order, is_primary, created_at")
    .eq("product_id", productId)
    .order("sort_order", { ascending: true })
    .order("created_at", { ascending: true });

  if (error) throw new Error(`Unable to load product media: ${error.message}`);
  return ((data ?? []) as unknown[]).map((row) => mapProductMedia(row as never));
}

export async function uploadProductMediaAction(
  productId: string,
  mediaType: "image" | "video",
  formData: FormData,
): Promise<ProductMediaActionState> {
  await requireAdmin();
  try {
    const parsedProductId = z.string().uuid().parse(productId);
    const parsedMediaType = z.enum(["image", "video"]).parse(mediaType);
    const files = formData
      .getAll("files")
      .filter((value): value is File => value instanceof File && value.size > 0);

    if (files.length === 0) throw new Error("Choose at least one file to upload.");

    const supabase = createAdminSupabaseClient();
    const existing = await loadProductMedia(parsedProductId);
    let nextSortOrder = existing.length;

    for (const file of files) {
      validUpload(file, parsedMediaType);
      const storagePath = `${parsedProductId}/${parsedMediaType}s/${safeFileName(file.name)}`;
      const { error: uploadError } = await supabase.storage
        .from("product-media")
        .upload(storagePath, file, {
          contentType: file.type,
          upsert: false,
        });
      if (uploadError) throw new Error(`Upload failed: ${uploadError.message}`);

      const { data: publicUrlData } = supabase.storage
        .from("product-media")
        .getPublicUrl(storagePath);
      const shouldBePrimary =
        parsedMediaType === "image" &&
        !existing.some((item) => item.mediaType === "image" && item.isPrimary) &&
        nextSortOrder === existing.length;

      const { error: insertError } = await supabase.from("product_media").insert({
        product_id: parsedProductId,
        media_type: parsedMediaType,
        url: publicUrlData.publicUrl,
        storage_path: storagePath,
        alt_text: parsedMediaType === "image" ? `${siteConfig.name} product photo` : null,
        caption: null,
        sort_order: nextSortOrder,
        is_primary: shouldBePrimary,
      });
      if (insertError) throw new Error(`Unable to save media: ${insertError.message}`);
      nextSortOrder += 1;
    }

    revalidateProductPaths();
    return { success: true, media: await loadProductMedia(parsedProductId) };
  } catch (error) {
    return {
      success: false,
      message: error instanceof Error ? error.message : "Unable to upload media.",
    };
  }
}

export async function updateProductMediaMetaAction(
  input: z.input<typeof mediaMetaSchema>,
): Promise<ProductMediaActionState> {
  await requireAdmin();
  try {
    const parsed = mediaMetaSchema.parse(input);
    const supabase = createAdminSupabaseClient();
    const { data: mediaRow, error: loadError } = await supabase
      .from("product_media")
      .select("product_id")
      .eq("id", parsed.mediaId)
      .single();
    if (loadError) throw new Error(`Unable to load media: ${loadError.message}`);

    const { error } = await supabase
      .from("product_media")
      .update({
        alt_text: parsed.altText || null,
        caption: parsed.caption || null,
      })
      .eq("id", parsed.mediaId);
    if (error) throw new Error(`Unable to update media: ${error.message}`);

    const productId = (mediaRow as { product_id: string }).product_id;
    revalidateProductPaths();
    return { success: true, media: await loadProductMedia(productId) };
  } catch (error) {
    return {
      success: false,
      message: error instanceof Error ? error.message : "Unable to update media.",
    };
  }
}

export async function setPrimaryProductMediaAction(
  mediaId: string,
): Promise<ProductMediaActionState> {
  await requireAdmin();
  try {
    const parsedMediaId = z.string().uuid().parse(mediaId);
    const supabase = createAdminSupabaseClient();
    const { data: mediaRow, error: loadError } = await supabase
      .from("product_media")
      .select("product_id, media_type")
      .eq("id", parsedMediaId)
      .single();
    if (loadError) throw new Error(`Unable to load media: ${loadError.message}`);
    const row = mediaRow as { product_id: string; media_type: string };
    if (row.media_type !== "image") throw new Error("Only images can be primary thumbnails.");

    await supabase
      .from("product_media")
      .update({ is_primary: false })
      .eq("product_id", row.product_id)
      .eq("media_type", "image");
    const { error } = await supabase
      .from("product_media")
      .update({ is_primary: true })
      .eq("id", parsedMediaId);
    if (error) throw new Error(`Unable to set primary media: ${error.message}`);

    revalidateProductPaths();
    return { success: true, media: await loadProductMedia(row.product_id) };
  } catch (error) {
    return {
      success: false,
      message: error instanceof Error ? error.message : "Unable to set primary media.",
    };
  }
}

export async function moveProductMediaAction(
  mediaId: string,
  direction: "up" | "down",
): Promise<ProductMediaActionState> {
  await requireAdmin();
  try {
    const parsedMediaId = z.string().uuid().parse(mediaId);
    const parsedDirection = z.enum(["up", "down"]).parse(direction);
    const supabase = createAdminSupabaseClient();
    const { data: currentRow, error: loadError } = await supabase
      .from("product_media")
      .select("product_id")
      .eq("id", parsedMediaId)
      .single();
    if (loadError) throw new Error(`Unable to load media: ${loadError.message}`);
    const productId = (currentRow as { product_id: string }).product_id;
    const media = await loadProductMedia(productId);
    const index = media.findIndex((item) => item.id === parsedMediaId);
    const swapIndex = parsedDirection === "up" ? index - 1 : index + 1;
    if (index < 0 || swapIndex < 0 || swapIndex >= media.length) {
      return { success: true, media };
    }
    const a = media[index];
    const b = media[swapIndex];
    const { error: firstError } = await supabase
      .from("product_media")
      .update({ sort_order: b.sortOrder })
      .eq("id", a.id);
    if (firstError) throw new Error(`Unable to reorder media: ${firstError.message}`);
    const { error: secondError } = await supabase
      .from("product_media")
      .update({ sort_order: a.sortOrder })
      .eq("id", b.id);
    if (secondError) throw new Error(`Unable to reorder media: ${secondError.message}`);

    revalidateProductPaths();
    return { success: true, media: await loadProductMedia(productId) };
  } catch (error) {
    return {
      success: false,
      message: error instanceof Error ? error.message : "Unable to reorder media.",
    };
  }
}

export async function deleteProductMediaAction(
  mediaId: string,
): Promise<ProductMediaActionState> {
  await requireAdmin();
  try {
    const parsedMediaId = z.string().uuid().parse(mediaId);
    const supabase = createAdminSupabaseClient();
    const { data: mediaRow, error: loadError } = await supabase
      .from("product_media")
      .select("product_id, storage_path")
      .eq("id", parsedMediaId)
      .single();
    if (loadError) throw new Error(`Unable to load media: ${loadError.message}`);
    const row = mediaRow as { product_id: string; storage_path: string | null };
    if (row.storage_path) {
      await supabase.storage.from("product-media").remove([row.storage_path]);
    }
    const { error } = await supabase.from("product_media").delete().eq("id", parsedMediaId);
    if (error) throw new Error(`Unable to delete media: ${error.message}`);

    revalidateProductPaths();
    return { success: true, media: await loadProductMedia(row.product_id) };
  } catch (error) {
    return {
      success: false,
      message: error instanceof Error ? error.message : "Unable to delete media.",
    };
  }
}


