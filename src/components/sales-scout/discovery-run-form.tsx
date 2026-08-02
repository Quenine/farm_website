"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { runDiscoveryAction } from "@/app/admin/(protected)/marketing/sales-scout/discover/actions";
import { initialDiscoveryActionState } from "@/src/lib/sales-scout/discovery/action-state";

function RunButton() {
  const { pending } = useFormStatus();
  return (
    <button
      disabled={pending}
      className="mt-3 rounded-full bg-green-800 px-5 py-3 font-bold text-white disabled:opacity-40"
    >
      {pending ? "Running paid discovery..." : "Confirm and run bounded discovery"}
    </button>
  );
}

export function DiscoveryRunForm({
  campaignId,
  disabled,
}: {
  campaignId: string;
  disabled: boolean;
}) {
  const [state, action] = useActionState(runDiscoveryAction, initialDiscoveryActionState);

  return (
    <form action={action}>
      <input type="hidden" name="campaignId" value={campaignId} />
      <label className="mt-3 flex gap-2">
        <input required type="checkbox" name="confirmed" value="yes" disabled={disabled} />
        <span>I confirm this may consume Geoapify and optional Tavily credits. It sends no outreach.</span>
      </label>
      <fieldset disabled={disabled}>
        <RunButton />
      </fieldset>
      {state.message ? (
        <p role="status" className="mt-2">
          {state.message}
          {state.reference ? ` Reference: ${state.reference}` : ""}
        </p>
      ) : null}
    </form>
  );
}
