"use server";

import { cookies } from "next/headers";
import { z } from "zod";
import { contentPublicConfig, siteConfig } from "@/src/config/site";
import { createOrder } from "@/src/lib/orders";
import {
  initializeOrderPayment,
  PaymentInitializationError,
} from "@/src/lib/payments";
import { PaystackRequestError } from "@/src/lib/paystack";

const attributionTouchSchema = z
  .object({
    utm_source: z.string().trim().max(160).optional(),
    utm_medium: z.string().trim().max(160).optional(),
    utm_campaign: z.string().trim().max(160).optional(),
    utm_content: z.string().trim().max(160).optional(),
    utm_term: z.string().trim().max(160).optional(),
    utm_id: z.string().trim().max(160).optional(),
    referrer: z.string().trim().max(300).optional(),
    landing_path: z.string().trim().max(300).optional(),
    first_seen_at: z.string().trim().max(80).optional(),
  })
  .partial();
const checkoutSchema = z
  .object({
    customerName: z.string().trim().min(2, "Enter your full name.").max(120),
    customerEmail: z.string().trim().email("Enter a valid email address."),
    customerPhone: z.string().trim().min(7, "Enter a valid phone number.").max(30),
    deliveryMethod: z.enum(["home_delivery", "pickup_point", "farm_pickup"]),
    deliveryAddress: z.string().trim().max(500).optional(),
    deliveryState: z.string().trim().min(2, "Select a delivery state.").max(80),
    deliveryCity: z.string().trim().min(2, "Select a city or area.").max(120),
    deliveryDate: z.iso.date("Select a valid delivery date."),
    deliveryNote: z.string().trim().max(1000).optional(),
    firstTouchAttribution: attributionTouchSchema.nullish(),
    lastTouchAttribution: attributionTouchSchema.nullish(),
    items: z
      .array(
        z.object({
          productId: z.string().uuid(),
          quantity: z.number().finite().positive(),
        }),
      )
      .min(1, "Your cart is empty.")
      .max(50),
  })
  .superRefine((value, context) => {
    if (value.deliveryMethod !== "farm_pickup" && (!value.deliveryAddress || value.deliveryAddress.length < 8)) {
      context.addIssue({
        code: "custom",
        path: ["deliveryAddress"],
        message: "Enter a complete delivery address.",
      });
    }
  });

export type CheckoutActionState =
  | {
      success: true;
      orderId: string;
      reference: string;
      authorizationUrl?: string;
      paymentError?: string;
      paymentDeferred?: boolean;
      confirmationMessage?: string;
    }
  | {
      success: false;
      message: string;
      fieldErrors?: Record<string, string[]>;
    };

function checkoutErrorMessage(error: unknown) {
  if (!(error instanceof Error)) return "Unable to create your order. Please try again.";

  const safeMessages = [
    "Delivery date cannot be in the past.",
    "Your cart is empty.",
    "Duplicate cart items are not allowed.",
    "A product in your cart is no longer available.",
    `Online delivery is not currently available for this location. Please contact ${siteConfig.name} to arrange this order.`,
    `Online delivery is not currently available for one or more items in your cart at this location. Please contact ${siteConfig.name} to arrange this order.`,
    "Selected delivery method is not available for one or more items in your cart.",
  ];

  if (
    safeMessages.includes(error.message) ||
    error.message.includes(" is not currently available to order.") ||
    error.message.includes(" requires a minimum order of ") ||
    error.message.includes(" only has ") ||
    error.message.includes("requires availability confirmation") ||
    error.message.includes("quantity must follow the allowed order step") ||
    error.message.includes("has an invalid quantity") ||
    error.message.includes("is not available for this delivery method")
  ) {
    return error.message;
  }

  return "We could not create your order right now. Please try again.";
}

function paymentErrorMessage(error: unknown) {
  if (error instanceof PaymentInitializationError) return error.userMessage;

  if (
    error instanceof Error &&
    (error.message === "This order has already been paid." ||
      error.message === "An item in this order is no longer available." ||
      error.message.includes("no longer has enough stock"))
  ) {
    return error.message;
  }

  return "Your order was saved, but payment could not be started. You can retry from the order tracking page.";
}

function contentAttributionFromCookie(raw: string | undefined) {
  if (!contentPublicConfig.hubEnabled || !raw) return null;
  try {
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    const postSlug = typeof parsed.postSlug === "string" ? parsed.postSlug.slice(0, 160) : "";
    const productSlug = typeof parsed.productSlug === "string" ? parsed.productSlug.slice(0, 160) : "";
    if (!postSlug || !productSlug) return null;
    return {
      source: "content_product_click",
      postId: typeof parsed.postId === "string" ? parsed.postId : undefined,
      postSlug,
      productId: typeof parsed.productId === "string" ? parsed.productId : undefined,
      productSlug,
      seenAt: typeof parsed.seenAt === "string" ? parsed.seenAt.slice(0, 80) : undefined,
    };
  } catch {
    return null;
  }
}

function logPaymentInitializationFailure(error: unknown) {
  if (error instanceof PaystackRequestError) {
    console.error("[Paystack Checkout Init Failed]", {
      httpStatus: error.httpStatus,
      responseBody: error.responseBody,
    });
  }
}

export async function createOrderAction(
  input: z.input<typeof checkoutSchema>,
): Promise<CheckoutActionState> {
  const parsed = checkoutSchema.safeParse(input);
  if (!parsed.success) {
    return {
      success: false,
      message: "Please correct the highlighted checkout details.",
      fieldErrors: parsed.error.flatten().fieldErrors,
    };
  }

  try {
    const cookieStore = await cookies();
    const contentAttribution = contentAttributionFromCookie(cookieStore.get("farm_content_referral")?.value);
    const order = await createOrder({ ...parsed.data, contentAttribution });
    try {
      const payment = await initializeOrderPayment(order.orderId);
      return {
        success: true,
        ...order,
        authorizationUrl: payment.authorizationUrl,
      };
    } catch (paymentError) {
      logPaymentInitializationFailure(paymentError);
      return {
        success: true,
        ...order,
        paymentError: paymentErrorMessage(paymentError),
      };
    }
  } catch (error) {
    return {
      success: false,
      message: checkoutErrorMessage(error),
    };
  }
}






