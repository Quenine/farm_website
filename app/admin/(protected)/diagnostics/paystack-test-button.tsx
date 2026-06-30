"use client";

import { useState, useTransition } from "react";
import {
  testPaystackInitializationAction,
  type PaystackDiagnosticResult,
} from "./actions";

function yesNo(value: boolean) {
  return value ? "Yes" : "No";
}

export function PaystackTestButton() {
  const [result, setResult] = useState<PaystackDiagnosticResult | null>(null);
  const [isPending, startTransition] = useTransition();

  return (
    <div className="mt-6 rounded-lg bg-white p-5 shadow-sm">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <h2 className="text-lg font-bold text-stone-950">
            Paystack initialization check
          </h2>
          <p className="mt-1 text-sm text-stone-600">
            Sends a N100 diagnostic initialization request. Secret values are
            never displayed.
          </p>
        </div>
        <button
          type="button"
          disabled={isPending}
          onClick={() => {
            startTransition(async () => {
              setResult(await testPaystackInitializationAction());
            });
          }}
          className="h-11 rounded-full bg-green-800 px-5 text-sm font-bold text-white disabled:cursor-wait disabled:opacity-60"
        >
          {isPending ? "Checking Paystack..." : "Verify Paystack initialization"}
        </button>
      </div>

      {result ? (
        <div
          className={`mt-5 rounded-lg border p-4 text-sm ${
            result.success
              ? "border-green-200 bg-green-50 text-green-950"
              : "border-red-200 bg-red-50 text-red-950"
          }`}
        >
          <p className="font-bold">
            Paystack initialization: {result.success ? "Success" : "Failed"}
          </p>
          <dl className="mt-3 grid gap-2">
            {result.success ? (
              <>
                <div className="grid gap-1 md:grid-cols-[220px_1fr]">
                  <dt className="font-semibold">authorization_url present</dt>
                  <dd>{yesNo(result.authorizationUrlPresent)}</dd>
                </div>
                <div className="grid gap-1 md:grid-cols-[220px_1fr]">
                  <dt className="font-semibold">reference present</dt>
                  <dd>{yesNo(result.referencePresent)}</dd>
                </div>
              </>
            ) : (
              <>
                <div className="grid gap-1 md:grid-cols-[220px_1fr]">
                  <dt className="font-semibold">HTTP status</dt>
                  <dd>{result.httpStatus ?? "Not sent"}</dd>
                </div>
                <div className="grid gap-1 md:grid-cols-[220px_1fr]">
                  <dt className="font-semibold">Paystack response</dt>
                  <dd className="break-words whitespace-pre-wrap">
                    {result.responseBody}
                  </dd>
                </div>
              </>
            )}
            <div className="grid gap-1 md:grid-cols-[220px_1fr]">
              <dt className="font-semibold">callback_url used</dt>
              <dd className="break-all">{result.callbackUrl}</dd>
            </div>
          </dl>
        </div>
      ) : null}
    </div>
  );
}
