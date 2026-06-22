"use server";

import { z } from "zod";
import { createOrder } from "@/src/lib/orders";
import {
  initializeOrderPayment,
  PaymentInitializationError,
} from "@/src/lib/payments";

const checkoutSchema = z.object({
  customerName: z.string().trim().min(2, "Enter your full name.").max(120),
  customerEmail: z.string().trim().email("Enter a valid email address."),
  customerPhone: z.string().trim().min(7, "Enter a valid phone number.").max(30),
  deliveryAddress: z
    .string()
    .trim()
    .min(8, "Enter a complete delivery address.")
    .max(500),
  deliveryZoneId: z.string().uuid("Select a delivery zone."),
  deliveryDate: z.iso.date("Select a valid delivery date."),
  deliveryNote: z.string().trim().max(1000).optional(),
  items: z
    .array(
      z.object({
        productId: z.string().uuid(),
        quantity: z.number().int().positive(),
      }),
    )
    .min(1, "Your cart is empty.")
    .max(50),
});

export type CheckoutActionState =
  | {
      success: true;
      orderId: string;
      reference: string;
      authorizationUrl?: string;
      paymentError?: string;
    }
  | {
      success: false;
      message: string;
      fieldErrors?: Record<string, string[]>;
    };

function checkoutErrorMessage(error: unknown) {
  if (!(error instanceof Error)) {
    return "Unable to create your order. Please try again.";
  }

  const safeMessages = [
    "Delivery date cannot be in the past.",
    "Your cart is empty.",
    "Duplicate cart items are not allowed.",
    "Select an active delivery zone.",
    "A product in your cart is no longer available.",
  ];

  if (
    safeMessages.includes(error.message) ||
    error.message.includes(" is not currently available to order.") ||
    error.message.includes(" requires a minimum order of ") ||
    error.message.includes(" only has ")
  ) {
    return error.message;
  }

  return "We could not create your order right now. Please try again.";
}

function paymentErrorMessage(error: unknown) {
  if (error instanceof PaymentInitializationError) {
    return error.userMessage;
  }

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
    const order = await createOrder(parsed.data);
    try {
      const payment = await initializeOrderPayment(order.orderId);
      return {
        success: true,
        ...order,
        authorizationUrl: payment.authorizationUrl,
      };
    } catch (paymentError) {
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
