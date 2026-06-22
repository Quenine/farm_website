import "server-only";

import { requireAdmin } from "@/src/lib/admin-auth";
import { products as mockProducts } from "@/src/lib/mock-data";
import { hasAdminSupabaseConfig, hasPublicSupabaseConfig } from "@/src/lib/supabase/config";
import { createAdminSupabaseClient } from "@/src/lib/supabase/admin";
import { createServerSupabaseClient } from "@/src/lib/supabase/server";
import type { Product } from "@/src/types";

type ProductRow = {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  price: number | string;
  unit: string;
  stock_quantity: number | string;
  minimum_order_quantity: number | string;
  status: "active" | "inactive" | "coming_soon";
  available_from: string | null;
  is_featured: boolean;
  is_live_animal: boolean;
  is_processed: boolean;
  categories: { name: string } | { name: string }[] | null;
};

export type AdminProductInput = {
  id?: string;
  name: string;
  slug: string;
  description: string;
  category: string;
  price: number;
  unit: string;
  stockCount: number;
  minimumOrder: number;
  status: "active" | "inactive" | "coming_soon";
  availableFrom?: string | null;
  isFeatured: boolean;
  isLiveAnimal: boolean;
  isProcessed: boolean;
};

const productColumns = `
  id,
  name,
  slug,
  description,
  price,
  unit,
  stock_quantity,
  minimum_order_quantity,
  status,
  available_from,
  is_featured,
  is_live_animal,
  is_processed,
  categories ( name )
`;

function categoryName(row: ProductRow) {
  if (Array.isArray(row.categories)) {
    return row.categories[0]?.name ?? "Uncategorized";
  }
  return row.categories?.name ?? "Uncategorized";
}

function pluralizeUnit(unit: string, quantity: number) {
  const labels: Record<string, string> = {
    kg: "kg",
    crate: quantity === 1 ? "crate" : "crates",
    half_crate: quantity === 1 ? "half-crate" : "half-crates",
    bird: quantity === 1 ? "bird" : "birds",
    bag: quantity === 1 ? "bag" : "bags",
  };
  return labels[unit] ?? unit.replaceAll("_", " ");
}

export function mapProductRow(row: ProductRow): Product {
  const stockCount = Number(row.stock_quantity);
  const minimumOrder = Number(row.minimum_order_quantity);
  const unitLabel = pluralizeUnit(row.unit, stockCount);
  const statusLabels = {
    active: "Available now",
    inactive: "Inactive",
    coming_soon: row.available_from
      ? `Available from ${new Date(`${row.available_from}T00:00:00`).toLocaleDateString("en-NG", {
          month: "long",
          year: "numeric",
        })}`
      : "Coming soon",
  };

  return {
    id: row.id,
    slug: row.slug,
    name: row.name,
    price: Number(row.price),
    unit: row.unit.replaceAll("_", "-"),
    stock: `${stockCount} ${unitLabel} available`,
    stockCount,
    minimumOrder,
    minimumUnit: pluralizeUnit(row.unit, minimumOrder),
    category: categoryName(row),
    availability: statusLabels[row.status],
    description: row.description ?? "",
    badge:
      row.status === "coming_soon"
        ? "Coming soon"
        : row.is_featured
          ? "Featured"
          : "Farm produce",
    status: row.status,
    availableFrom: row.available_from,
    isFeatured: row.is_featured,
    isLiveAnimal: row.is_live_animal,
    isProcessed: row.is_processed,
  };
}

function developmentFallback() {
  if (process.env.NODE_ENV === "development") {
    return mockProducts;
  }
  throw new Error("Supabase configuration is required outside development.");
}

export async function getPublicProducts(): Promise<Product[]> {
  if (!hasPublicSupabaseConfig()) return developmentFallback();

  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase
    .from("products")
    .select(productColumns)
    .in("status", ["active", "coming_soon"])
    .order("status", { ascending: true })
    .order("is_featured", { ascending: false })
    .order("name");

  if (error) throw new Error(`Unable to load products: ${error.message}`);
  return ((data ?? []) as unknown as ProductRow[]).map(mapProductRow);
}

export async function getPublicProductBySlug(slug: string) {
  if (!hasPublicSupabaseConfig()) {
    return developmentFallback().find((product) => product.slug === slug) ?? null;
  }

  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase
    .from("products")
    .select(productColumns)
    .eq("slug", slug)
    .in("status", ["active", "coming_soon"])
    .maybeSingle();

  if (error) throw new Error(`Unable to load product: ${error.message}`);
  return data ? mapProductRow(data as unknown as ProductRow) : null;
}

export async function getAdminProducts() {
  await requireAdmin();
  if (!hasAdminSupabaseConfig()) {
    return { products: developmentFallback(), usingFallback: true };
  }

  const supabase = createAdminSupabaseClient();
  const { data, error } = await supabase
    .from("products")
    .select(productColumns)
    .order("created_at", { ascending: false });

  if (error) throw new Error(`Unable to load admin products: ${error.message}`);
  return {
    products: ((data ?? []) as unknown as ProductRow[]).map(mapProductRow),
    usingFallback: false,
  };
}

async function getCategoryId(categoryName: string) {
  const supabase = createAdminSupabaseClient();
  const { data, error } = await supabase
    .from("categories")
    .select("id")
    .eq("name", categoryName)
    .maybeSingle();

  if (error) throw new Error(`Unable to load category: ${error.message}`);
  if (!data) {
    throw new Error(
      `Category "${categoryName}" does not exist. Run database/seed.sql first.`,
    );
  }
  return data.id as string;
}

export async function saveAdminProduct(input: AdminProductInput) {
  await requireAdmin();
  const supabase = createAdminSupabaseClient();
  const categoryId = await getCategoryId(input.category);
  const payload = {
    name: input.name,
    slug: input.slug,
    description: input.description,
    category_id: categoryId,
    price: input.price,
    unit: input.unit.replaceAll("-", "_"),
    stock_quantity: input.stockCount,
    minimum_order_quantity: input.minimumOrder,
    status: input.status,
    available_from:
      input.status === "coming_soon" ? input.availableFrom : null,
    is_featured: input.isFeatured,
    is_live_animal: input.isLiveAnimal,
    is_processed: input.isProcessed,
  };

  const query = input.id
    ? supabase
        .from("products")
        .update(payload)
        .eq("id", input.id)
        .select(productColumns)
        .single()
    : supabase.from("products").insert(payload).select(productColumns).single();

  const { data, error } = await query;
  if (error) throw new Error(`Unable to save product: ${error.message}`);
  return mapProductRow(data as unknown as ProductRow);
}

export async function deactivateAdminProduct(id: string) {
  await requireAdmin();
  const supabase = createAdminSupabaseClient();
  const { data, error } = await supabase
    .from("products")
    .update({ status: "inactive" })
    .eq("id", id)
    .select(productColumns)
    .single();

  if (error) throw new Error(`Unable to deactivate product: ${error.message}`);
  return mapProductRow(data as unknown as ProductRow);
}
