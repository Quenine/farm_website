import "server-only";

import { randomBytes } from "node:crypto";
import {
  initializePaystackTransaction,
  parsePaystackMetadata,
  verifyPaystackTransaction,
  type PaystackTransaction,
} from "@/src/lib/paystack";
import { validateConfiguredSiteUrl } from "@/src/lib/site-url";
import { createAdminSupabaseClient } from "@/src/lib/supabase/admin";
import { getAdminSupabaseConfig } from "@/src/lib/supabase/config";

type ProcessResult = {
  orderId: string;
  state: "paid" | "review" | "failed" | "pending";
  message: string;
  alreadyProcessed?: boolean;
};

const PAYMENT_CONFIGURATION_MESSAGE =
  "Payment is temporarily unavailable because checkout is not configured correctly. Please try again later or contact Noble Farms.";

export class PaymentInitializationError extends Error {
  constructor(
    message: string,
    readonly userMessage: string,
  ) {
    super(message);
    this.name = "PaymentInitializationError";
  }
}

function failPaymentValidation(orderReference: string, reason: string): never {
  console.error("[Paystack Init Validation Failed]", {
    orderReference,
    reason,
  });
  throw new PaymentInitializationError(
    reason,
    PAYMENT_CONFIGURATION_MESSAGE,
  );
}

function isPaystackEmail(email: unknown): email is string {
  return (
    typeof email === "string" &&
    email.length <= 254 &&
    /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
  );
}

function paymentReference(orderReference: string) {
  return `${orderReference}-${randomBytes(4).toString("hex").toUpperCase()}`;
}

function amountInKobo(amount: number) {
  return Math.round(amount * 100);
}

async function assertPaymentProcessorReady() {
  const { url, serviceRoleKey } = getAdminSupabaseConfig();
  const response = await fetch(`${url}/rest/v1/`, {
    cache: "no-store",
    headers: {
      apikey: serviceRoleKey,
      Authorization: `Bearer ${serviceRoleKey}`,
      Accept: "application/openapi+json",
    },
  });
  if (!response.ok) {
    throw new Error("Unable to confirm payment processor readiness.");
  }
  const schema = (await response.json()) as {
    paths?: Record<string, unknown>;
    definitions?: {
      inventory_movements?: {
        properties?: Record<string, unknown>;
      };
    };
  };
  const movementProperties =
    schema.definitions?.inventory_movements?.properties;
  if (
    !schema.paths?.["/rpc/process_paystack_payment"] ||
    !movementProperties?.order_id ||
    !movementProperties?.order_item_id
  ) {
    throw new Error(
      "Inventory payment setup is incomplete. Rerun database/step5-paystack.sql in Supabase.",
    );
  }
}

async function findOrderForPayment(orderId: string) {
  const supabase = createAdminSupabaseClient();
  const { data, error } = await supabase
    .from("orders")
    .select(
      `
        id,
        order_reference,
        customer_email,
        total_amount,
        payment_status,
        paystack_reference,
        order_items (
          quantity,
          product_id,
          products ( stock_quantity, status )
        )
      `,
    )
    .eq("id", orderId)
    .maybeSingle();

  if (error) throw new Error(`Unable to load order for payment: ${error.message}`);
  if (!data) throw new Error("Order not found.");
  return data;
}

function relationRow<T>(value: T | T[] | null): T | null {
  return Array.isArray(value) ? value[0] ?? null : value;
}

function assertStockAvailable(
  order: Awaited<ReturnType<typeof findOrderForPayment>>,
) {
  for (const item of order.order_items ?? []) {
    const product = relationRow(
      item.products as
        | { stock_quantity: number | string; status: string }
        | { stock_quantity: number | string; status: string }[]
        | null,
    );
    if (!product || product.status !== "active") {
      throw new Error("An item in this order is no longer available.");
    }
    if (Number(item.quantity) > Number(product.stock_quantity)) {
      throw new Error(
        "An item in this order no longer has enough stock. Please contact Noble Farms.",
      );
    }
  }
}

export async function initializeOrderPayment(orderId: string) {
  await assertPaymentProcessorReady();
  const order = await findOrderForPayment(orderId);
  if (order.payment_status === "paid") {
    throw new Error("This order has already been paid.");
  }
  assertStockAvailable(order);

  const siteUrlValidation = validateConfiguredSiteUrl();
  if (!siteUrlValidation.valid) {
    failPaymentValidation(order.order_reference, siteUrlValidation.reason);
  }
  if (!process.env.PAYSTACK_SECRET_KEY?.trim()) {
    failPaymentValidation(
      order.order_reference,
      "PAYSTACK_SECRET_KEY is missing.",
    );
  }

  const amountNaira = Number(order.total_amount);
  const amountKobo = amountInKobo(amountNaira);
  if (!Number.isInteger(amountKobo) || amountKobo <= 0) {
    failPaymentValidation(
      order.order_reference,
      "Payment amount in kobo must be a positive integer.",
    );
  }

  const email =
    typeof order.customer_email === "string"
      ? order.customer_email.trim()
      : "";
  if (!isPaystackEmail(email)) {
    failPaymentValidation(
      order.order_reference,
      "Customer email is missing or invalid for Paystack.",
    );
  }

  const reference = paymentReference(order.order_reference);
  const callbackUrl = `${siteUrlValidation.siteUrl}/payment/callback`;

  console.log("[Paystack Init]", {
    orderReference: order.order_reference,
    siteUrl: process.env.NEXT_PUBLIC_SITE_URL,
    callbackUrl,
    hasSecretKey: Boolean(process.env.PAYSTACK_SECRET_KEY),
    hasPublicKey: Boolean(process.env.NEXT_PUBLIC_PAYSTACK_PUBLIC_KEY),
    amountNaira,
    amountKobo,
    emailPresent: Boolean(email),
  });

  const response = await initializePaystackTransaction({
    email,
    amountKobo,
    reference,
    callbackUrl,
    orderReference: order.order_reference,
    metadata: {
      order_id: order.id,
      order_reference: order.order_reference,
    },
  });

  console.log("[Paystack Init Success]", {
    orderReference: order.order_reference,
    authorizationUrlPresent: Boolean(response?.data?.authorization_url),
    reference: response?.data?.reference,
  });

  const supabase = createAdminSupabaseClient();
  const { error: paymentError } = await supabase.from("payments").insert({
    order_id: order.id,
    provider: "paystack",
    reference: response.data.reference,
    amount: Number(order.total_amount),
    status: "pending",
    raw_response: response,
  });
  if (paymentError) {
    throw new Error(`Unable to save payment attempt: ${paymentError.message}`);
  }

  const { error: orderError } = await supabase
    .from("orders")
    .update({
      paystack_reference: response.data.reference,
      payment_status: "pending",
      order_status: "pending_payment",
    })
    .eq("id", order.id)
    .neq("payment_status", "paid");
  if (orderError) {
    throw new Error(`Unable to attach payment to order: ${orderError.message}`);
  }

  return {
    authorizationUrl: response.data.authorization_url,
    reference: response.data.reference,
  };
}

async function resolveOrderForTransaction(transaction: PaystackTransaction) {
  const supabase = createAdminSupabaseClient();
  const metadata = parsePaystackMetadata(transaction.metadata);
  const { data: payment } = await supabase
    .from("payments")
    .select("order_id")
    .eq("reference", transaction.reference)
    .maybeSingle();

  const orderId = payment?.order_id ?? metadata.order_id;
  if (!orderId || typeof orderId !== "string") {
    throw new Error("Payment does not identify a Noble Farms order.");
  }

  const { data: order, error } = await supabase
    .from("orders")
    .select("id, order_reference, total_amount, payment_status, paystack_reference")
    .eq("id", orderId)
    .maybeSingle();
  if (error) throw new Error(`Unable to load payment order: ${error.message}`);
  if (!order) throw new Error("Payment order was not found.");

  if (
    metadata.order_reference &&
    metadata.order_reference !== order.order_reference
  ) {
    throw new Error("Payment order reference does not match.");
  }
  if (transaction.reference !== order.paystack_reference && !payment) {
    throw new Error("Paystack reference does not belong to this order.");
  }
  if (transaction.currency !== "NGN") {
    throw new Error("Payment currency does not match this order.");
  }
  if (transaction.amount !== amountInKobo(Number(order.total_amount))) {
    throw new Error("Payment amount does not match this order.");
  }

  return order;
}

async function markConfirmedFailure(transaction: PaystackTransaction) {
  const order = await resolveOrderForTransaction(transaction);
  const supabase = createAdminSupabaseClient();
  await supabase
    .from("payments")
    .update({ status: "failed", raw_response: transaction })
    .eq("reference", transaction.reference)
    .neq("status", "paid");
  await supabase
    .from("orders")
    .update({ payment_status: "failed" })
    .eq("id", order.id)
    .eq("paystack_reference", transaction.reference)
    .neq("payment_status", "paid");
  return {
    orderId: order.id,
    state: "failed",
    message: "Paystack confirmed that this payment failed.",
  } satisfies ProcessResult;
}

export async function processVerifiedPaystackTransaction(
  transaction: PaystackTransaction,
  rawResponse: unknown,
): Promise<ProcessResult> {
  if (transaction.status === "failed") {
    return markConfirmedFailure(transaction);
  }
  if (transaction.status !== "success") {
    const order = await resolveOrderForTransaction(transaction);
    return {
      orderId: order.id,
      state: "pending",
      message: "Payment is still pending confirmation.",
    };
  }

  const order = await resolveOrderForTransaction(transaction);
  const supabase = createAdminSupabaseClient();
  const { data, error } = await supabase.rpc("process_paystack_payment", {
    p_order_id: order.id,
    p_reference: transaction.reference,
    p_amount: transaction.amount / 100,
    p_paid_at: transaction.paid_at ?? new Date().toISOString(),
    p_raw_response: rawResponse,
  });

  if (error) {
    throw new Error(
      error.code === "PGRST202"
        ? "Run database/step5-paystack.sql before processing payments."
        : `Unable to process payment: ${error.message}`,
    );
  }

  const result = data as {
    needs_review?: boolean;
    already_processed?: boolean;
  };
  return result.needs_review
    ? {
        orderId: order.id,
        state: "review",
        message:
          "Payment was received, but stock changed. The order needs owner review.",
        alreadyProcessed: result.already_processed ?? false,
      }
    : {
        orderId: order.id,
        state: "paid",
        message: result.already_processed
          ? "Payment was already confirmed."
          : "Payment verified successfully.",
        alreadyProcessed: result.already_processed ?? false,
      };
}

export async function verifyAndProcessPaystackReference(reference: string) {
  const response = await verifyPaystackTransaction(reference);
  return processVerifiedPaystackTransaction(response.data, response);
}

export async function findOrderIdByPaymentReference(reference: string) {
  const supabase = createAdminSupabaseClient();
  const { data } = await supabase
    .from("payments")
    .select("order_id")
    .eq("reference", reference)
    .maybeSingle();
  return data?.order_id ?? null;
}
