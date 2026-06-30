import "server-only";

import { requireAdmin } from "@/src/lib/admin-auth";
import { products as fallbackProducts } from "@/src/lib/business-data";
import { hasAdminSupabaseConfig, hasPublicSupabaseConfig } from "@/src/lib/supabase/config";
import { createAdminSupabaseClient } from "@/src/lib/supabase/admin";
import { createServerSupabaseClient } from "@/src/lib/supabase/server";
import type { DeliveryClass, Product, ProductMedia } from "@/src/types";

type ProductMediaRow = {
  id: string;
  product_id: string;
  media_type: "image" | "video";
  url: string;
  storage_path: string | null;
  alt_text: string | null;
  caption: string | null;
  sort_order: number | string;
  is_primary: boolean;
  created_at: string;
};

type ProductRow = {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  price: number | string;
  unit: string;
  stock_quantity: number | string;
  minimum_order_quantity: number | string;
  quantity_step: number | string | null;
  quantity_input_type: "whole" | "decimal" | null;
  pricing_mode: "fixed" | "quote_required" | null;
  is_orderable_online: boolean | null;
  display_price_label: string | null;
  status: "active" | "inactive" | "coming_soon";
  available_from: string | null;
  is_featured: boolean;
  featured_sort_order: number | string | null;
  supports_wider_delivery: boolean | null;
  delivery_class: DeliveryClass | null;
  delivery_unit_value: number | string | null;
  handling_fee: number | string | null;
  supports_home_delivery: boolean | null;
  supports_pickup_point: boolean | null;
  supports_farm_pickup: boolean | null;
  requires_delivery_confirmation: boolean | null;
  is_live_animal: boolean;
  is_processed: boolean;
  created_at: string;
  categories: { name: string } | { name: string }[] | null;
  product_media?: ProductMediaRow[] | null;
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
  quantityStep: number;
  quantityInputType: "whole" | "decimal";
  status: "active" | "inactive" | "coming_soon";
  availableFrom?: string | null;
  isFeatured: boolean;
  featuredSortOrder?: number;
  supportsWiderDelivery?: boolean;
  deliveryClass?: DeliveryClass;
  deliveryUnitValue?: number;
  handlingFee?: number;
  supportsHomeDelivery?: boolean;
  supportsPickupPoint?: boolean;
  supportsFarmPickup?: boolean;
  requiresDeliveryConfirmation?: boolean;
  isLiveAnimal: boolean;
  isProcessed: boolean;
  pricingMode: "fixed" | "quote_required";
  isOrderableOnline: boolean;
  displayPriceLabel?: string | null;
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
  quantity_step,
  quantity_input_type,
  pricing_mode,
  is_orderable_online,
  display_price_label,
  status,
  available_from,
  is_featured,
  featured_sort_order,
  supports_wider_delivery,
  delivery_class,
  delivery_unit_value,
  handling_fee,
  supports_home_delivery,
  supports_pickup_point,
  supports_farm_pickup,
  requires_delivery_confirmation,
  is_live_animal,
  is_processed,
  created_at,
  categories ( name ),
  product_media (
    id,
    product_id,
    media_type,
    url,
    storage_path,
    alt_text,
    caption,
    sort_order,
    is_primary,
    created_at
  )
`;

function categoryName(row: ProductRow) {
  const rawName = Array.isArray(row.categories)
    ? row.categories[0]?.name
    : row.categories?.name;
  const categoryAliases: Record<string, string> = {
    "Live Chickens": "Broilers",
    "Farm Supplies": "Farm Inputs",
  };
  return rawName ? categoryAliases[rawName] ?? rawName : "Uncategorized";
}

export function categoryRank(category: string) {
  const ranks: Record<string, number> = {
    Eggs: 1,
    Broilers: 2,
    "Processed Birds": 3,
    "Crop Produce": 4,
    "Farm Inputs": 9,
  };
  return ranks[category] ?? 5;
}

function productBadge(row: ProductRow, category: string) {
  if (row.pricing_mode === "quote_required") return "Check Availability";
  if (row.status === "coming_soon") return "Availability varies";
  if (row.is_featured) return "Available now";
  if (category === "Crop Produce") return "Fresh produce";
  if (category === "Farm Inputs") return "Farm input";
  return "Farm-direct";
}

function pluralizeUnit(unit: string, quantity: number) {
  const labels: Record<string, string> = {
    kg: "kg",
    crate: quantity === 1 ? "crate" : "crates",
    half_crate: quantity === 1 ? "half-crate" : "half-crates",
    bird: quantity === 1 ? "bird" : "birds",
    bag: quantity === 1 ? "bag" : "bags",
    basket: quantity === 1 ? "basket" : "baskets",
    unit: quantity === 1 ? "unit" : "units",
  };
  return labels[unit] ?? unit.replaceAll("_", " ");
}

export function mapProductMedia(row: ProductMediaRow): ProductMedia {
  return {
    id: row.id,
    productId: row.product_id,
    mediaType: row.media_type,
    url: row.url,
    storagePath: row.storage_path,
    altText: row.alt_text,
    caption: row.caption,
    sortOrder: Number(row.sort_order),
    isPrimary: row.is_primary,
    createdAt: row.created_at,
  };
}

function sortMedia(media: ProductMedia[]) {
  return [...media].sort(
    (a, b) => a.sortOrder - b.sortOrder || a.createdAt?.localeCompare(b.createdAt ?? "") || 0,
  );
}

function primaryMedia(media: ProductMedia[]) {
  const ordered = sortMedia(media);
  return (
    ordered.find((item) => item.mediaType === "image" && item.isPrimary) ??
    ordered.find((item) => item.mediaType === "image") ??
    ordered[0] ??
    null
  );
}

export function mapProductRow(row: ProductRow): Product {
  const stockCount = Number(row.stock_quantity);
  const minimumOrder = Number(row.minimum_order_quantity);
  const quantityStep = Number(row.quantity_step ?? 1);
  const quantityInputType = row.quantity_input_type === "decimal" ? "decimal" : "whole";
  const unitLabel = pluralizeUnit(row.unit, stockCount);
  const category = categoryName(row);
  const pricingMode = row.pricing_mode ?? "fixed";
  const isOrderableOnline = row.is_orderable_online ?? true;
  const media = sortMedia((row.product_media ?? []).map(mapProductMedia));
  const statusLabels = {
    active:
      pricingMode === "quote_required"
        ? "Available by confirmed supply"
        : "Available now",
    inactive: "Inactive",
    coming_soon: row.available_from
      ? `Available from ${new Date(`${row.available_from}T00:00:00`).toLocaleDateString("en-NG", {
          month: "long",
          year: "numeric",
        })}`
      : "Availability to be announced",
  };

  return {
    id: row.id,
    slug: row.slug,
    name: row.name,
    price: Number(row.price),
    unit: row.unit.replaceAll("_", "-"),
    stock:
      pricingMode === "quote_required"
        ? "Availability depends on quantity, season, and logistics"
        : `${stockCount} ${unitLabel} available`,
    stockCount,
    minimumOrder,
    quantityStep: Number.isFinite(quantityStep) && quantityStep > 0 ? quantityStep : 1,
    quantityInputType,
    minimumUnit: pluralizeUnit(row.unit, minimumOrder),
    category,
    availability: statusLabels[row.status],
    description: row.description ?? "",
    badge: productBadge(row, category),
    status: row.status,
    availableFrom: row.available_from,
    isFeatured: row.is_featured,
    featuredSortOrder: Number(row.featured_sort_order ?? 100),
    supportsWiderDelivery: row.supports_wider_delivery ?? category === "Crop Produce",
    deliveryClass: row.delivery_class ?? "standard",
    deliveryUnitValue: Number(row.delivery_unit_value ?? 1),
    handlingFee: Number(row.handling_fee ?? 0),
    supportsHomeDelivery: row.supports_home_delivery ?? true,
    supportsPickupPoint: row.supports_pickup_point ?? true,
    supportsFarmPickup: row.supports_farm_pickup ?? true,
    requiresDeliveryConfirmation: row.requires_delivery_confirmation ?? false,
    isLiveAnimal: row.is_live_animal,
    isProcessed: row.is_processed,
    pricingMode,
    isOrderableOnline,
    displayPriceLabel: row.display_price_label,
    media,
    primaryMedia: primaryMedia(media),
  };
}

function developmentFallback() {
  if (process.env.NODE_ENV === "development") {
    return fallbackProducts;
  }
  throw new Error("Supabase configuration is required outside development.");
}

function sortPublicProducts(products: Product[]) {
  return products.sort(
    (a, b) =>
      categoryRank(a.category) - categoryRank(b.category) ||
      a.name.localeCompare(b.name),
  );
}

export async function getPublicProducts(): Promise<Product[]> {
  if (!hasPublicSupabaseConfig()) return sortPublicProducts(developmentFallback());

  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase
    .from("products")
    .select(productColumns)
    .in("status", ["active", "coming_soon"])
    .order("status", { ascending: true })
    .order("is_featured", { ascending: false })
    .order("featured_sort_order", { ascending: true })
    .order("name");

  if (error) throw new Error(`Unable to load products: ${error.message}`);
  return sortPublicProducts(((data ?? []) as unknown as ProductRow[]).map(mapProductRow));
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
  const aliases: Record<string, string[]> = {
    Broilers: ["Broilers", "Live Chickens"],
    "Farm Inputs": ["Farm Inputs", "Farm Supplies"],
  };
  const candidateNames = aliases[categoryName] ?? [categoryName];
  const { data, error } = await supabase
    .from("categories")
    .select("id")
    .in("name", candidateNames)
    .limit(1)
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
    quantity_step: input.quantityStep,
    quantity_input_type: input.quantityInputType,
    status: input.status,
    available_from:
      input.status === "coming_soon" ? input.availableFrom : null,
    is_featured: input.isFeatured,
    featured_sort_order: input.featuredSortOrder ?? 100,
    supports_wider_delivery: input.supportsWiderDelivery ?? false,
    delivery_class: input.deliveryClass ?? "standard",
    delivery_unit_value: input.deliveryUnitValue ?? 1,
    handling_fee: input.handlingFee ?? 0,
    supports_home_delivery: input.supportsHomeDelivery ?? true,
    supports_pickup_point: input.supportsPickupPoint ?? true,
    supports_farm_pickup: input.supportsFarmPickup ?? true,
    requires_delivery_confirmation: input.requiresDeliveryConfirmation ?? false,
    is_live_animal: input.isLiveAnimal,
    is_processed: input.isProcessed,
    pricing_mode: input.pricingMode,
    is_orderable_online:
      input.pricingMode === "quote_required" ? false : input.isOrderableOnline,
    display_price_label: input.displayPriceLabel || null,
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
