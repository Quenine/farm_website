"use server";

import { randomBytes } from "node:crypto";
import { requireAdmin } from "@/src/lib/admin-auth";
import {
  getPaystackEnvironmentDiagnostics,
  initializePaystackDiagnosticTransaction,
} from "@/src/lib/paystack";
import { validateConfiguredSiteUrl } from "@/src/lib/site-url";

export type PaystackDiagnosticResult =
  | {
      success: true;
      authorizationUrlPresent: boolean;
      referencePresent: boolean;
      callbackUrl: string;
    }
  | {
      success: false;
      httpStatus?: number;
      responseBody: string;
      callbackUrl: string;
    };

function formatSafeResponseBody(value: unknown) {
  if (typeof value === "string") return value;
  if (value === null || value === undefined) return "No response body returned.";
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return "Unable to serialize Paystack response body safely.";
  }
}

function isPaystackEmail(email: unknown): email is string {
  return (
    typeof email === "string" &&
    email.length <= 254 &&
    /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
  );
}

export async function testPaystackInitializationAction(): Promise<PaystackDiagnosticResult> {
  const admin = await requireAdmin();
  const siteUrlValidation = validateConfiguredSiteUrl();
  const keyDiagnostics = getPaystackEnvironmentDiagnostics();
  const callbackUrl = siteUrlValidation.valid
    ? `${siteUrlValidation.siteUrl}/payment/callback`
    : "Unavailable";

  console.log("[Paystack Diagnostic Init]", {
    siteUrl: process.env.NEXT_PUBLIC_SITE_URL,
    callbackUrl,
    hasSecretKey: keyDiagnostics.secretKey.configured,
    secretKeyFormatValid: keyDiagnostics.secretKey.formatValid,
    publicKeyFormatValid: keyDiagnostics.publicKey.formatValid,
    keyModesMatch: keyDiagnostics.keyModesMatch,
    amountKobo: 10000,
  });

  if (!siteUrlValidation.valid) {
    return {
      success: false,
      responseBody: siteUrlValidation.reason,
      callbackUrl,
    };
  }
  if (!keyDiagnostics.secretKey.configured) {
    return {
      success: false,
      responseBody: "PAYSTACK_SECRET_KEY is missing.",
      callbackUrl,
    };
  }
  if (!keyDiagnostics.secretKey.formatValid) {
    return {
      success: false,
      responseBody: "PAYSTACK_SECRET_KEY format is invalid.",
      callbackUrl,
    };
  }

  const email = admin.email?.trim() || process.env.ADMIN_EMAIL?.trim() || "";
  if (!isPaystackEmail(email)) {
    return {
      success: false,
      responseBody: "Admin email is missing or invalid for Paystack.",
      callbackUrl,
    };
  }

  const result = await initializePaystackDiagnosticTransaction({
    email,
    amountKobo: 10000,
    reference: `NF-DIAG-${Date.now()}-${randomBytes(3).toString("hex").toUpperCase()}`,
    callbackUrl,
    metadata: {
      business: "noble_farms",
      app: "noble_farms_web",
      diagnostic: true,
    },
  });

  if (!result.ok) {
    console.error("[Paystack Diagnostic Failed]", {
      httpStatus: result.httpStatus,
      responseBody: result.responseBody,
    });
    return {
      success: false,
      httpStatus: result.httpStatus,
      responseBody: formatSafeResponseBody(result.responseBody),
      callbackUrl,
    };
  }

  return {
    success: true,
    authorizationUrlPresent: result.authorizationUrlPresent,
    referencePresent: result.referencePresent,
    callbackUrl,
  };
}
