import "server-only";

import { randomBytes } from "node:crypto";
import { calculateCheckoutDelivery } from "@/src/lib/product-delivery-rates";
import { sendCustomerOrderStatusNotification } from "@/src/lib/notifications";
import type { NotificationOrderRow } from "@/src/lib/notifications";
import { isValidQuantityStep } from "@/src/lib/quantity";
import { requireAdmin } from "@/src/lib/admin-auth";
import { createAdminSupabaseClient } from "@/src/lib/supabase/admin";
import type { DatabaseOrderStatus, DeliveryMethod, Order, OrderItem } from "@/src/types";
import type { DeliveryProductForCalculation } from "@/src/lib/delivery-calculator";

type OrderRow = {
  id: string;
  order_reference: string;
  customer_name: string;
  customer_email: string;
  customer_phone: string;
  delivery_address: string | null;
  delivery_zone_id: string | null;
  delivery_date: string;
  delivery_note: string | null;
  delivery_method: DeliveryMethod | null;
  delivery_state: string | null;
  delivery_city: string | null;
  delivery_rate_id: string | null;
  delivery_pricing_model: string | null;
  delivery_rate_breakdown: unknown | null;
  delivery_package_count: number | string | null;
  delivery_units: number | string | null;
  handling_fee: number | string | null;
  delivery_quote_required: boolean | null;
  delivery_fee_confirmed: boolean | null;
  subtotal: number | string;
  delivery_fee: number | string;
  total_amount: number | string;
  payment_status: Order["paymentStatus"];
  order_status: Order["orderStatus"];
  paystack_reference: string | null;
  created_at: string;
  delivery_rates: { estimated_delivery_time: string | null } | { estimated_delivery_time: string | null }[] | null;
  delivery_zones: { name: string } | { name: string }[] | null;
  order_items: Array<{
    id: string;
    product_id: string | null;
    product_name: string;
    quantity: number | string;
    unit: string;
    unit_price: number | string;
    total_price: number | string;
    products:
      | { stock_quantity: number | string }
      | { stock_quantity: number | string }[]
      | null;
  }>;
  payments: Array<{
    provider: string;
    reference: string;
    status: Order["paymentStatus"];
    paid_at: string | null;
    created_at: string;
  }>;
};

export type SafeAttribution = {
  utm_source?: string;
  utm_medium?: string;
  utm_campaign?: string;
  utm_content?: string;
  utm_term?: string;
  utm_id?: string;
  referrer?: string;
  landing_path?: string;
  first_seen_at?: string;
};

export type CreateOrderInput = {
  customerName: string;
  customerEmail: string;
  customerPhone: string;
  deliveryAddress?: string;
  deliveryDate: string;
  deliveryNote?: string;
  deliveryMethod: DeliveryMethod;
  deliveryState: string;
  deliveryCity: string;
  items: Array<{ productId: string; quantity: number }>;
  firstTouchAttribution?: SafeAttribution | null;
  lastTouchAttribution?: SafeAttribution | null;
};

const orderColumns = `
  id,
  order_reference,
  customer_name,
  customer_email,
  customer_phone,
  delivery_address,
  delivery_zone_id,
  delivery_date,
  delivery_note,
  delivery_method,
  delivery_state,
  delivery_city,
  delivery_rate_id,
  delivery_pricing_model,
  delivery_rate_breakdown,
  delivery_package_count,
  delivery_units,
  handling_fee,
  delivery_quote_required,
  delivery_fee_confirmed,
  subtotal,
  delivery_fee,
  total_amount,
  payment_status,
  order_status,
  paystack_reference,
  created_at,
  delivery_rates ( estimated_delivery_time ),
  delivery_zones ( name ),
  order_items (
    id,
    product_id,
    product_name,
    quantity,
    unit,
    unit_price,
    total_price,
    products ( stock_quantity )
  ),
  payments (
    provider,
    reference,
    status,
    paid_at,
    created_at
  )
`;

function relationRow<T>(relation: T | T[] | null): T | null {
  return Array.isArray(relation) ? relation[0] ?? null : relation;
}

function currentStock(
  relation:
    | { stock_quantity: number | string }
    | { stock_quantity: number | string }[]
    | null,
) {
  const row = relationRow(relation);
  return row ? Number(row.stock_quantity) : null;
}

function estimatedDeliveryTime(row: OrderRow) {
  const breakdown = row.delivery_rate_breakdown as { estimatedDeliveryTime?: string | null } | null;
  return breakdown?.estimatedDeliveryTime ?? relationRow(row.delivery_rates)?.estimated_delivery_time ?? null;
}

export function mapOrderRow(row: OrderRow): Order {
  const items: OrderItem[] = (row.order_items ?? []).map((item) => ({
    id: item.id,
    productId: item.product_id,
    productName: item.product_name,
    quantity: Number(item.quantity),
    unit: item.unit,
    unitPrice: Number(item.unit_price),
    totalPrice: Number(item.total_price),
    currentStock: currentStock(item.products),
  }));
  const latestPayment = [...(row.payments ?? [])].sort((a, b) =>
    b.created_at.localeCompare(a.created_at),
  )[0];

  return {
    id: row.id,
    reference: row.order_reference,
    customerName: row.customer_name,
    customerEmail: row.customer_email,
    customerPhone: row.customer_phone,
    deliveryAddress: row.delivery_address ?? "",
    deliveryZoneId: row.delivery_zone_id,
    deliveryArea: [row.delivery_city, row.delivery_state].filter(Boolean).join(", ") || "Not specified",
    deliveryDate: row.delivery_date,
    deliveryNote: row.delivery_note,
    deliveryMethod: row.delivery_method ?? "home_delivery",
    deliveryState: row.delivery_state,
    deliveryCity: row.delivery_city,
    deliveryRateId: row.delivery_rate_id,
    deliveryUnits: Number(row.delivery_units ?? 0),
    handlingFee: Number(row.handling_fee ?? 0),
    deliveryPricingModel: row.delivery_pricing_model ?? "legacy_rate",
    deliveryPackageCount: Number(row.delivery_package_count ?? 0),
    deliveryRateBreakdown: row.delivery_rate_breakdown as Order["deliveryRateBreakdown"],
    estimatedDeliveryTime: estimatedDeliveryTime(row),
    deliveryQuoteRequired: row.delivery_quote_required ?? false,
    deliveryFeeConfirmed: row.delivery_fee_confirmed ?? true,
    subtotal: Number(row.subtotal),
    deliveryFee: Number(row.delivery_fee),
    totalAmount: Number(row.total_amount),
    paymentStatus: row.payment_status,
    orderStatus: row.order_status,
    paystackReference: row.paystack_reference,
    paymentProvider: latestPayment?.provider ?? null,
    paidAt: row.payments.find((payment) => payment.status === "paid")?.paid_at ?? null,
    inventoryMovementCount: 0,
    inventoryDeducted: false,
    createdAt: row.created_at,
    items,
  };
}

export function normalizePhone(phone: string) {
  const trimmed = phone.trim();
  const prefix = trimmed.startsWith("+") ? "+" : "";
  return prefix + trimmed.replace(/\D/g, "");
}

function todayInLagos() {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Africa/Lagos",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());
  const value = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${value.year}-${value.month}-${value.day}`;
}

function safeAttribution(input: unknown): SafeAttribution | null {
  if (!input || typeof input !== "object") return null;
  const source = input as Record<string, unknown>;
  const allowed: Array<keyof SafeAttribution> = [
    "utm_source",
    "utm_medium",
    "utm_campaign",
    "utm_content",
    "utm_term",
    "utm_id",
    "referrer",
    "landing_path",
    "first_seen_at",
  ];
  const output: SafeAttribution = {};
  for (const key of allowed) {
    const value = source[key];
    if (typeof value === "string" && value.trim()) output[key] = value.trim().slice(0, 300);
  }
  return Object.keys(output).length > 0 ? output : null;
}
function orderReference() {
  const date = todayInLagos().replaceAll("-", "");
  return `NF-${date}-${randomBytes(2).toString("hex").toUpperCase()}`;
}

export async function createOrder(input: CreateOrderInput) {
  if (input.deliveryDate < todayInLagos()) throw new Error("Delivery date cannot be in the past.");
  if (input.items.length === 0) throw new Error("Your cart is empty.");
  if (new Set(input.items.map((item) => item.productId)).size !== input.items.length) {
    throw new Error("Duplicate cart items are not allowed.");
  }

  const supabase = createAdminSupabaseClient();
  const uniqueProductIds = [...new Set(input.items.map((item) => item.productId))];
  const { data: products, error: productsError } = await supabase
    .from("products")
    .select(
      "id, name, price, unit, stock_quantity, minimum_order_quantity, quantity_step, quantity_input_type, status, pricing_mode, is_orderable_online, delivery_unit_value, handling_fee, supports_home_delivery, supports_pickup_point, supports_farm_pickup, requires_delivery_confirmation",
    )
    .in("id", uniqueProductIds);

  if (productsError) throw new Error(`Unable to validate cart products: ${productsError.message}`);

  const productsById = new Map((products ?? []).map((product) => [product.id, product]));
  const deliveryProducts: DeliveryProductForCalculation[] = [];
  const orderItems = input.items.map((item) => {
    const product = productsById.get(item.productId) as
      | {
          id: string;
          name: string;
          price: number | string;
          unit: string;
          stock_quantity: number | string;
          minimum_order_quantity: number | string;
          quantity_step: number | string | null;
          quantity_input_type: "whole" | "decimal" | null;
          status: string;
          pricing_mode: string | null;
          is_orderable_online: boolean | null;
          supports_home_delivery: boolean | null;
          supports_pickup_point: boolean | null;
          supports_farm_pickup: boolean | null;
          requires_delivery_confirmation: boolean | null;
        }
      | undefined;
    if (!product) throw new Error("A product in your cart is no longer available.");
    if (product.status !== "active") throw new Error(`${product.name} is not currently available to order.`);
    if (product.pricing_mode === "quote_required" || product.is_orderable_online === false || Number(product.price) <= 0) {
      throw new Error(`${product.name} requires availability confirmation before checkout.`);
    }

    const quantity = item.quantity;
    const minimum = Number(product.minimum_order_quantity);
    const stock = Number(product.stock_quantity);
    const quantityStep = Number(product.quantity_step ?? 1);
    const quantityInputType = product.quantity_input_type === "decimal" ? "decimal" : "whole";
    if (!Number.isFinite(quantity) || quantity <= 0) throw new Error(`${product.name} has an invalid quantity.`);
    if (quantity < minimum) throw new Error(`${product.name} requires a minimum order of ${minimum}.`);
    if (quantity > stock) throw new Error(`${product.name} only has ${stock} available.`);
    if (!isValidQuantityStep({ quantity, min: minimum, max: stock, step: quantityStep, inputType: quantityInputType })) {
      throw new Error(`${product.name} quantity must follow the allowed order step.`);
    }

    deliveryProducts.push({
      productId: product.id,
      name: product.name,
      quantity,
      minimumOrder: minimum,
      stockCount: stock,
      quantityStep,
      quantityInputType,
      supportsHomeDelivery: product.supports_home_delivery ?? true,
      supportsPickupPoint: product.supports_pickup_point ?? true,
      supportsFarmPickup: product.supports_farm_pickup ?? true,
      requiresDeliveryConfirmation: product.requires_delivery_confirmation ?? false,
    });

    const unitPrice = Number(product.price);
    return {
      product_id: product.id,
      product_name: product.name,
      quantity,
      unit: product.unit,
      unit_price: unitPrice,
      total_price: unitPrice * quantity,
    };
  });

  const delivery = await calculateCheckoutDelivery({
    products: deliveryProducts,
    state: input.deliveryState,
    city: input.deliveryCity,
    deliveryMethod: input.deliveryMethod,
  });
  if (!delivery.supported) throw new Error(delivery.reason);

  const subtotal = orderItems.reduce((sum, item) => sum + item.total_price, 0);
  const deliveryFee = delivery.deliveryFee;
  const totalAmount = subtotal + deliveryFee;
  const phone = normalizePhone(input.customerPhone);
  const deliveryAddress = input.deliveryAddress?.trim() ||
    (input.deliveryMethod === "farm_pickup" ? "Farm Pickup / Direct Arrangement" : "");

  let insertedOrder: { id: string; order_reference: string } | null = null;
  let lastError: Error | null = null;

  for (let attempt = 0; attempt < 3 && !insertedOrder; attempt += 1) {
    const { data, error } = await supabase
      .from("orders")
      .insert({
        order_reference: orderReference(),
        customer_name: input.customerName,
        customer_email: input.customerEmail,
        customer_phone: phone,
        delivery_address: deliveryAddress,
        delivery_zone_id: null,
        delivery_date: input.deliveryDate,
        delivery_note: input.deliveryNote || null,
        delivery_method: input.deliveryMethod,
        delivery_state: input.deliveryState,
        delivery_city: input.deliveryCity,
        delivery_rate_id: null,
        delivery_pricing_model: delivery.deliveryPricingModel,
        delivery_rate_breakdown: delivery.deliveryRateBreakdown,
        delivery_package_count: delivery.deliveryPackageCount,
        delivery_units: delivery.deliveryUnits,
        handling_fee: delivery.handlingFee,
        delivery_quote_required: false,
        delivery_fee_confirmed: true,
        subtotal,
        delivery_fee: deliveryFee,
        total_amount: totalAmount,
        payment_status: "pending",
        order_status: "pending_payment",
        first_touch_attribution: safeAttribution(input.firstTouchAttribution),
        last_touch_attribution: safeAttribution(input.lastTouchAttribution),
      })
      .select("id, order_reference")
      .single();

    if (!error && data) insertedOrder = data;
    else {
      lastError = new Error(error?.message ?? "Unable to create order.");
      if (error?.code !== "23505") break;
    }
  }

  if (!insertedOrder) throw lastError ?? new Error("Unable to create order.");

  const { error: itemError } = await supabase.from("order_items").insert(
    orderItems.map((item) => ({ ...item, order_id: insertedOrder.id })),
  );

  if (itemError) {
    await supabase.from("orders").delete().eq("id", insertedOrder.id);
    throw new Error(`Unable to save order items: ${itemError.message}`);
  }

  return {
    orderId: insertedOrder.id,
    reference: insertedOrder.order_reference,
    paymentDeferred: false,
  };
}

export async function getOrderSuccess(orderId: string) {
  const supabase = createAdminSupabaseClient();
  const { data, error } = await supabase
    .from("orders")
    .select(orderColumns)
    .eq("id", orderId)
    .maybeSingle();
  if (error) throw new Error(`Unable to load order: ${error.message}`);
  return data ? mapOrderRow(data as unknown as OrderRow) : null;
}

export async function trackOrder(reference: string, phone: string) {
  const supabase = createAdminSupabaseClient();
  const { data, error } = await supabase
    .from("orders")
    .select(orderColumns)
    .eq("order_reference", reference.trim().toUpperCase())
    .eq("customer_phone", normalizePhone(phone))
    .maybeSingle();
  if (error) throw new Error(`Unable to track order: ${error.message}`);
  return data ? mapOrderRow(data as unknown as OrderRow) : null;
}

export async function getAdminOrders() {
  await requireAdmin();
  const supabase = createAdminSupabaseClient();
  const { data, error } = await supabase
    .from("orders")
    .select(orderColumns)
    .order("created_at", { ascending: false });
  if (error) throw new Error(`Unable to load orders: ${error.message}`);
  const orders = ((data ?? []) as unknown as OrderRow[]).map(mapOrderRow);
  if (orders.length === 0) return orders;

  const { data: movements, error: movementError } = await supabase
    .from("inventory_movements")
    .select("order_id")
    .in("order_id", orders.map((order) => order.id))
    .eq("movement_type", "stock_out");

  if (movementError) return orders;

  const movementCounts = new Map<string, number>();
  for (const movement of movements ?? []) {
    if (!movement.order_id) continue;
    movementCounts.set(movement.order_id, (movementCounts.get(movement.order_id) ?? 0) + 1);
  }

  return orders.map((order) => {
    const movementCount = movementCounts.get(order.id) ?? 0;
    return {
      ...order,
      inventoryMovementCount: movementCount,
      inventoryDeducted: order.items.length > 0 && movementCount === order.items.length,
    };
  });
}

export async function updateAdminOrderStatus(orderId: string, status: DatabaseOrderStatus) {
  await requireAdmin();
  const supabase = createAdminSupabaseClient();
  const { data: existingOrder, error: existingError } = await supabase
    .from("orders")
    .select("order_status")
    .eq("id", orderId)
    .single();
  if (existingError) throw new Error(`Unable to load order: ${existingError.message}`);

  const previousStatus = (existingOrder as { order_status: DatabaseOrderStatus }).order_status;
  const { data, error } = await supabase
    .from("orders")
    .update({ order_status: status })
    .eq("id", orderId)
    .select(orderColumns)
    .single();
  if (error) throw new Error(`Unable to update order: ${error.message}`);

  if (previousStatus !== status) {
    try {
      await sendCustomerOrderStatusNotification(data as unknown as NotificationOrderRow, status);
    } catch (notificationError) {
      console.error("[Order Status Notification Failed]", {
        orderId,
        status,
        reason:
          notificationError instanceof Error
            ? notificationError.message
            : "Unknown notification error",
      });
    }
  }

  return mapOrderRow(data as unknown as OrderRow);
}

export async function confirmAdminOrderDeliveryFee(orderId: string, deliveryFee: number) {
  await requireAdmin();
  if (!Number.isFinite(deliveryFee) || deliveryFee < 0) throw new Error("Enter a valid delivery fee.");
  const supabase = createAdminSupabaseClient();
  const { data: order, error: loadError } = await supabase
    .from("orders")
    .select("subtotal")
    .eq("id", orderId)
    .single();
  if (loadError) throw new Error(`Unable to load order: ${loadError.message}`);

  const subtotal = Number((order as { subtotal: number | string }).subtotal);
  const { data, error } = await supabase
    .from("orders")
    .update({
      delivery_fee: deliveryFee,
      total_amount: subtotal + deliveryFee,
      delivery_quote_required: false,
      delivery_fee_confirmed: true,
      order_status: "pending_payment",
      payment_status: "pending",
    })
    .eq("id", orderId)
    .neq("payment_status", "paid")
    .select(orderColumns)
    .single();
  if (error) throw new Error(`Unable to confirm delivery fee: ${error.message}`);
  return mapOrderRow(data as unknown as OrderRow);
}


