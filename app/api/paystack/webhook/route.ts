import {
  processVerifiedPaystackTransaction,
} from "@/src/lib/payments";
import { revalidatePath } from "next/cache";
import {
  verifyPaystackWebhookSignature,
  type PaystackTransaction,
} from "@/src/lib/paystack";

type PaystackWebhookEvent = {
  event: string;
  data: PaystackTransaction;
};

export async function POST(request: Request) {
  const rawBody = await request.text();
  const signature = request.headers.get("x-paystack-signature");

  if (!verifyPaystackWebhookSignature(rawBody, signature)) {
    return Response.json({ received: false }, { status: 401 });
  }

  let event: PaystackWebhookEvent;
  try {
    event = JSON.parse(rawBody) as PaystackWebhookEvent;
  } catch {
    return Response.json({ received: false }, { status: 400 });
  }

  if (event.event === "charge.success") {
    try {
      await processVerifiedPaystackTransaction(event.data, event);
      revalidatePaymentPaths();
    } catch {
      console.error("Paystack webhook processing failed.");
      return Response.json({ received: false }, { status: 500 });
    }
  }

  return Response.json({ received: true });
}

function revalidatePaymentPaths() {
  revalidatePath("/");
  revalidatePath("/shop");
  revalidatePath("/shop/[slug]", "page");
  revalidatePath("/admin");
  revalidatePath("/admin/inventory");
  revalidatePath("/admin/orders");
}
