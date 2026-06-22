import "server-only";

import { randomBytes } from "node:crypto";
import { calculateDeliveryFee } from "@/src/lib/delivery";
import { getCheckoutDeliveryData } from "@/src/lib/delivery-data";
import { requireAdmin } from "@/src/lib/admin-auth";
import { createAdminSupabaseClient } from "@/src/lib/supabase/admin";
import type {
  DatabaseOrderStatus,
  Order,
  OrderItem,
} from "@/src/types";

type OrderRow = {
  id: string;
  order_reference: string;
  customer_name: string;
  customer_email: string;
  customer_phone: string;
  delivery_address: string;
  delivery_zone_id: string;
  delivery_date: string;
  delivery_note: string | null;
  subtotal: number | string;
  delivery_fee: number | string;
  total_amount: number | string;
  payment_status: Order["paymentStatus"];
  order_status: Order["orderStatus"];
  paystack_reference: string | null;
  created_at: string;
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

export type CreateOrderInput = {
  customerName: string;
  customerEmail: string;
  customerPhone: string;
  deliveryAddress: string;
  deliveryZoneId: string;
  deliveryDate: string;
  deliveryNote?: string;
  items: Array<{ productId: string; quantity: number }>;
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
  subtotal,
  delivery_fee,
  total_amount,
  payment_status,
  order_status,
  paystack_reference,
  created_at,
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

function relatedName(
  relation: { name: string } | { name: string }[] | null,
) {
  return Array.isArray(relation)
    ? relation[0]?.name ?? "Unknown area"
    : relation?.name ?? "Unknown area";
}

function currentStock(
  relation:
    | { stock_quantity: number | string }
    | { stock_quantity: number | string }[]
    | null,
) {
  const row = Array.isArray(relation) ? relation[0] : relation;
  return row ? Number(row.stock_quantity) : null;
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
    deliveryAddress: row.delivery_address,
    deliveryZoneId: row.delivery_zone_id,
    deliveryArea: relatedName(row.delivery_zones),
    deliveryDate: row.delivery_date,
    deliveryNote: row.delivery_note,
    subtotal: Number(row.subtotal),
    deliveryFee: Number(row.delivery_fee),
    totalAmount: Number(row.total_amount),
    paymentStatus: row.payment_status,
    orderStatus: row.order_status,
    paystackReference: row.paystack_reference,
    paymentProvider: latestPayment?.provider ?? null,
    paidAt:
      row.payments.find((payment) => payment.status === "paid")?.paid_at ?? null,
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

function orderReference() {
  const date = todayInLagos().replaceAll("-", "");
  return `NF-${date}-${randomBytes(2).toString("hex").toUpperCase()}`;
}

export async function createOrder(input: CreateOrderInput) {
  if (input.deliveryDate < todayInLagos()) {
    throw new Error("Delivery date cannot be in the past.");
  }
  if (input.items.length === 0) {
    throw new Error("Your cart is empty.");
  }
  if (new Set(input.items.map((item) => item.productId)).size !== input.items.length) {
    throw new Error("Duplicate cart items are not allowed.");
  }

  const supabase = createAdminSupabaseClient();
  const uniqueProductIds = [...new Set(input.items.map((item) => item.productId))];
  const [{ zones, settings }, productsResult] = await Promise.all([
    getCheckoutDeliveryData(),
    supabase
      .from("products")
      .select(
        "id, name, price, unit, stock_quantity, minimum_order_quantity, status",
      )
      .in("id", uniqueProductIds),
  ]);

  if (productsResult.error) {
    throw new Error(`Unable to validate cart products: ${productsResult.error.message}`);
  }

  const zone = zones.find((item) => item.id === input.deliveryZoneId);
  if (!zone?.id || zone.isActive === false) {
    throw new Error("Select an active delivery zone.");
  }

  const productsById = new Map(
    (productsResult.data ?? []).map((product) => [product.id, product]),
  );
  const orderItems = input.items.map((item) => {
    const product = productsById.get(item.productId);
    if (!product) {
      throw new Error("A product in your cart is no longer available.");
    }
    if (product.status !== "active") {
      throw new Error(`${product.name} is not currently available to order.`);
    }

    const quantity = Math.round(item.quantity);
    const minimum = Number(product.minimum_order_quantity);
    const stock = Number(product.stock_quantity);
    if (quantity < minimum) {
      throw new Error(`${product.name} requires a minimum order of ${minimum}.`);
    }
    if (quantity > stock) {
      throw new Error(`${product.name} only has ${stock} available.`);
    }

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

  const subtotal = orderItems.reduce((sum, item) => sum + item.total_price, 0);
  const deliveryFee = calculateDeliveryFee(zone, settings);
  const totalAmount = subtotal + deliveryFee;
  const phone = normalizePhone(input.customerPhone);

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
        delivery_address: input.deliveryAddress,
        delivery_zone_id: zone.id,
        delivery_date: input.deliveryDate,
        delivery_note: input.deliveryNote || null,
        subtotal,
        delivery_fee: deliveryFee,
        total_amount: totalAmount,
        payment_status: "pending",
        order_status: "pending_payment",
      })
      .select("id, order_reference")
      .single();

    if (!error && data) {
      insertedOrder = data;
    } else {
      lastError = new Error(error?.message ?? "Unable to create order.");
      if (error?.code !== "23505") break;
    }
  }

  if (!insertedOrder) {
    throw lastError ?? new Error("Unable to create order.");
  }

  const { error: itemError } = await supabase.from("order_items").insert(
    orderItems.map((item) => ({
      ...item,
      order_id: insertedOrder.id,
    })),
  );

  if (itemError) {
    await supabase.from("orders").delete().eq("id", insertedOrder.id);
    throw new Error(`Unable to save order items: ${itemError.message}`);
  }

  return {
    orderId: insertedOrder.id,
    reference: insertedOrder.order_reference,
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
    .in(
      "order_id",
      orders.map((order) => order.id),
    )
    .eq("movement_type", "stock_out");

  if (movementError) {
    // The Step 5 inventory-link migration may not be installed yet.
    return orders;
  }

  const movementCounts = new Map<string, number>();
  for (const movement of movements ?? []) {
    if (!movement.order_id) continue;
    movementCounts.set(
      movement.order_id,
      (movementCounts.get(movement.order_id) ?? 0) + 1,
    );
  }

  return orders.map((order) => {
    const movementCount = movementCounts.get(order.id) ?? 0;
    return {
      ...order,
      inventoryMovementCount: movementCount,
      inventoryDeducted:
        order.items.length > 0 && movementCount === order.items.length,
    };
  });
}

export async function updateAdminOrderStatus(
  orderId: string,
  status: DatabaseOrderStatus,
) {
  await requireAdmin();
  const supabase = createAdminSupabaseClient();
  const { data, error } = await supabase
    .from("orders")
    .update({ order_status: status })
    .eq("id", orderId)
    .select(orderColumns)
    .single();
  if (error) throw new Error(`Unable to update order: ${error.message}`);
  return mapOrderRow(data as unknown as OrderRow);
}
