"use server";

import { z } from "zod";
import {
  initializeOrderPayment,
  PaymentInitializationError,
} from "@/src/lib/payments";
import { trackOrder } from "@/src/lib/orders";

export type PaymentInitializationResult =
  | { success: true; authorizationUrl: string }
  | { success: false; message: string };

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

  return "Unable to start payment right now. Please try again shortly.";
}

export async function initializePaymentAction(
  orderId: string,
): Promise<PaymentInitializationResult> {
  try {
    const payment = await initializeOrderPayment(
      z.string().uuid().parse(orderId),
    );
    return { success: true, authorizationUrl: payment.authorizationUrl };
  } catch (error) {
    return {
      success: false,
      message: paymentErrorMessage(error),
    };
  }
}

export async function retryTrackedOrderPaymentAction(input: {
  reference: string;
  phone: string;
}): Promise<PaymentInitializationResult> {
  try {
    const order = await trackOrder(input.reference, input.phone);
    if (!order) {
      return {
        success: false,
        message: "Order reference and phone number do not match.",
      };
    }
    if (order.paymentStatus === "paid") {
      return { success: false, message: "This order is already paid." };
    }
    const payment = await initializeOrderPayment(order.id);
    return { success: true, authorizationUrl: payment.authorizationUrl };
  } catch (error) {
    return {
      success: false,
      message: paymentErrorMessage(error),
    };
  }
}
