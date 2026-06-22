"use client";

import { useState, useTransition } from "react";
import {
  initializePaymentAction,
  retryTrackedOrderPaymentAction,
} from "@/app/payment/actions";

export function PayNowButton({
  orderId,
  reference,
  phone,
  label = "Pay Now",
}: {
  orderId?: string;
  reference?: string;
  phone?: string;
  label?: string;
}) {
  const [message, setMessage] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const pay = () => {
    setMessage(null);
    startTransition(async () => {
      const result =
        reference && phone
          ? await retryTrackedOrderPaymentAction({ reference, phone })
          : await initializePaymentAction(orderId ?? "");
      if (!result.success) {
        setMessage(result.message);
        return;
      }
      window.location.assign(result.authorizationUrl);
    });
  };

  return (
    <div>
      <button
        type="button"
        onClick={pay}
        disabled={isPending}
        className="inline-flex h-12 items-center justify-center rounded-full bg-green-800 px-6 text-sm font-bold text-white disabled:cursor-wait disabled:opacity-60"
      >
        {isPending ? "Opening Paystack…" : label}
      </button>
      {message ? (
        <p className="mt-2 max-w-md text-sm font-semibold text-red-700">
          {message}
        </p>
      ) : null}
    </div>
  );
}
