import { revalidatePath } from "next/cache";
import { NextResponse, type NextRequest } from "next/server";
import {
  findOrderIdByPaymentReference,
  verifyAndProcessPaystackReference,
} from "@/src/lib/payments";

export async function GET(request: NextRequest) {
  const reference =
    request.nextUrl.searchParams.get("reference") ??
    request.nextUrl.searchParams.get("trxref");

  if (!reference) {
    return redirectToStatus(request, { result: "invalid" });
  }

  try {
    const result = await verifyAndProcessPaystackReference(reference);
    revalidatePaymentPaths();

    return redirectToStatus(request, {
      id: result.orderId,
      result: result.alreadyProcessed ? "already_confirmed" : result.state,
    });
  } catch {
    const orderId = await findOrderIdByPaymentReference(reference);
    return redirectToStatus(request, {
      id: orderId ?? undefined,
      result: "error",
    });
  }
}

function redirectToStatus(
  request: NextRequest,
  values: { id?: string; result: string },
) {
  const url = new URL("/payment/status", request.url);
  url.searchParams.set("result", values.result);
  if (values.id) url.searchParams.set("id", values.id);
  return NextResponse.redirect(url);
}

function revalidatePaymentPaths() {
  revalidatePath("/");
  revalidatePath("/shop");
  revalidatePath("/shop/[slug]", "page");
  revalidatePath("/admin");
  revalidatePath("/admin/inventory");
  revalidatePath("/admin/orders");
}
