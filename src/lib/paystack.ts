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

const SENSITIVE_RESPONSE_KEY =
  /authorization|access[_-]?code|secret|token|password|api[_-]?key/i;

function sanitizeResponseText(value: string) {
  return value
    .replace(/\b(?:sk|pk)_(?:test|live)_[A-Za-z0-9_-]+\b/g, "[REDACTED_KEY]")
    .replace(/\bBearer\s+\S+/gi, "Bearer [REDACTED]")
    .replace(/\beyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\b/g, "[REDACTED_TOKEN]");
}

function getPaystackSecretKey() {
  const key = process.env.PAYSTACK_SECRET_KEY?.trim();
  if (!key) throw new Error("PAYSTACK_SECRET_KEY is not configured.");
  return key;
}

function sanitizeResponseBody(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(sanitizeResponseBody);
  }
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value).map(([key, nestedValue]) => [
        key,
        SENSITIVE_RESPONSE_KEY.test(key)
          ? "[REDACTED]"
          : sanitizeResponseBody(nestedValue),
      ]),
    );
  }
  if (typeof value === "string") {
    return sanitizeResponseText(value);
  }
  return value;
}

async function readResponseBody(response: Response) {
  const responseText = await response.text();
  if (!responseText) {
    return { payload: null, safeBody: null };
  }

  try {
    const payload = JSON.parse(responseText) as unknown;
    return { payload, safeBody: sanitizeResponseBody(payload) };
  } catch {
    return {
      payload: null,
      safeBody: sanitizeResponseText(responseText.slice(0, 4000)),
    };
  }
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
  orderReference: string;
}) {
  const response = await fetch(`${PAYSTACK_API_URL}/transaction/initialize`, {
    method: "POST",
    cache: "no-store",
    headers: {
      Authorization: `Bearer ${getPaystackSecretKey()}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      email: input.email,
      amount: String(input.amountKobo),
      reference: input.reference,
      callback_url: input.callbackUrl,
      metadata: JSON.stringify(input.metadata),
    }),
  });
  const { payload: rawPayload, safeBody: responseBody } =
    await readResponseBody(response);

  if (!response.ok) {
    console.error("[Paystack Init Failed]", {
      orderReference: input.orderReference,
      httpStatus: response.status,
      responseBody,
    });
    throw new Error("Paystack request failed.");
  }

  const payload = rawPayload as PaystackResponse<{
    authorization_url: string;
    access_code: string;
    reference: string;
  }>;

  if (!payload?.status) {
    console.error("[Paystack Init Failed]", {
      orderReference: input.orderReference,
      httpStatus: response.status,
      responseBody,
    });
    throw new Error(payload?.message || "Paystack request failed.");
  }

  return payload;
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
