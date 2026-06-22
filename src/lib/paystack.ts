import "server-only";

import { createHmac, timingSafeEqual } from "node:crypto";

const PAYSTACK_API_URL = "https://api.paystack.co";

export type PaystackMetadata = {
  order_id?: string;
  order_reference?: string;
  [key: string]: unknown;
};

export type PaystackTransaction = {
  status: string;
  reference: string;
  amount: number;
  currency: string;
  paid_at: string | null;
  metadata: PaystackMetadata | string | null;
  gateway_response?: string | null;
  customer?: { email?: string };
};

type PaystackResponse<T> = {
  status: boolean;
  message: string;
  data: T;
};

function getPaystackSecretKey() {
  const key = process.env.PAYSTACK_SECRET_KEY?.trim();
  if (!key) throw new Error("PAYSTACK_SECRET_KEY is not configured.");
  return key;
}

async function paystackRequest<T>(path: string, init?: RequestInit) {
  const response = await fetch(`${PAYSTACK_API_URL}${path}`, {
    ...init,
    cache: "no-store",
    headers: {
      Authorization: `Bearer ${getPaystackSecretKey()}`,
      "Content-Type": "application/json",
      ...init?.headers,
    },
  });

  const payload = (await response.json()) as PaystackResponse<T>;
  if (!response.ok || !payload.status) {
    throw new Error(payload.message || "Paystack request failed.");
  }
  return payload;
}

export async function initializePaystackTransaction(input: {
  email: string;
  amountKobo: number;
  reference: string;
  callbackUrl: string;
  metadata: PaystackMetadata;
}) {
  return paystackRequest<{
    authorization_url: string;
    access_code: string;
    reference: string;
  }>("/transaction/initialize", {
    method: "POST",
    body: JSON.stringify({
      email: input.email,
      amount: String(input.amountKobo),
      reference: input.reference,
      callback_url: input.callbackUrl,
      metadata: JSON.stringify(input.metadata),
    }),
  });
}

export async function verifyPaystackTransaction(reference: string) {
  return paystackRequest<PaystackTransaction>(
    `/transaction/verify/${encodeURIComponent(reference)}`,
  );
}

export function parsePaystackMetadata(
  metadata: PaystackTransaction["metadata"],
): PaystackMetadata {
  if (!metadata) return {};
  if (typeof metadata === "object") return metadata;
  try {
    const parsed = JSON.parse(metadata) as unknown;
    return parsed && typeof parsed === "object"
      ? (parsed as PaystackMetadata)
      : {};
  } catch {
    return {};
  }
}

export function verifyPaystackWebhookSignature(
  rawBody: string,
  signature: string | null,
) {
  if (!signature) return false;
  const expected = createHmac("sha512", getPaystackSecretKey())
    .update(rawBody)
    .digest("hex");
  const expectedBuffer = Buffer.from(expected, "utf8");
  const signatureBuffer = Buffer.from(signature, "utf8");
  return (
    expectedBuffer.length === signatureBuffer.length &&
    timingSafeEqual(expectedBuffer, signatureBuffer)
  );
}
