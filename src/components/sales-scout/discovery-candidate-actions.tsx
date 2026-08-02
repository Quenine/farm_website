"use client";

import { useActionState, useState } from "react";
import { useFormStatus } from "react-dom";
import {
  captureDiscoveryCandidateAction,
  dismissDiscoveryCandidateAction,
} from "@/app/admin/(protected)/marketing/sales-scout/discover/actions";
import { initialDiscoveryActionState } from "@/src/lib/sales-scout/discovery/action-state";

type CaptureChoice = {
  choice: string;
  prospectId?: string;
  prospect?: { businessName?: string } | null;
};

function PendingButton({ idleLabel }: { idleLabel: string }) {
  const { pending } = useFormStatus();
  return (
    <button
      disabled={pending}
      className="mt-3 rounded-full bg-green-800 px-4 py-2 text-white disabled:opacity-40"
    >
      {pending ? "Saving..." : idleLabel}
    </button>
  );
}

export function CaptureCandidateForm({
  candidateId,
  choice,
}: {
  candidateId: string;
  choice: CaptureChoice;
}) {
  const [state, action] = useActionState(captureDiscoveryCandidateAction, initialDiscoveryActionState);
  const resolution =
    choice.choice === "create_new"
      ? { choice: "create_new" }
      : { choice: "attach_to_existing", prospectId: choice.prospectId };

  return (
    <form action={action} className="mt-2">
      <input type="hidden" name="candidateId" value={candidateId} />
      <input type="hidden" name="resolution" value={JSON.stringify(resolution)} />
      <PendingButton
        idleLabel={
          choice.choice === "create_new"
            ? "Create prospect"
            : `Attach to ${choice.prospect?.businessName ?? "existing prospect"}`
        }
      />
      {state.message ? <p role="status">{state.message}</p> : null}
    </form>
  );
}

export function DismissCandidateForm({ candidateId }: { candidateId: string }) {
  const [state, action] = useActionState(dismissDiscoveryCandidateAction, initialDiscoveryActionState);
  return (
    <form action={action} className="rounded-xl border bg-amber-50 p-5">
      <input type="hidden" name="candidateId" value={candidateId} />
      <label className="block font-bold">
        Dismissal reason
        <textarea
          name="reason"
          required
          minLength={3}
          maxLength={500}
          className="mt-2 block w-full rounded border p-3"
        />
      </label>
      <p>Dismissal removes this listing from normal staged review.</p>
      <PendingButton idleLabel="Dismiss candidate" />
      {state.message ? (
        <p role="status">
          {state.message}
          {state.reference ? ` Reference: ${state.reference}` : ""}
        </p>
      ) : null}
    </form>
  );
}

export type CandidateContact = { route:string;displayValue:string;normalizedIdentity:string;profileUrl:string|null;sourceUrl:string;confidence:"verified"|"plausible" };
export function CandidateContactActions({contact}:{contact:CandidateContact}){
  const[confirmed,setConfirmed]=useState(contact.confidence==="verified");
  const href=contact.route==="phone"?`tel:${contact.normalizedIdentity}`:contact.route==="whatsapp"?`https://wa.me/${contact.normalizedIdentity.replace("+","")}`:contact.route==="email"?`mailto:${encodeURIComponent(contact.normalizedIdentity)}`:contact.profileUrl;
  return <div className="mt-2 flex flex-wrap items-center gap-2">{contact.confidence==="plausible"?<label className="flex gap-2 text-sm"><input type="checkbox" checked={confirmed} onChange={event=>setConfirmed(event.target.checked)}/>Review this public contact before using it.</label>:null}{href?<a href={confirmed?href:undefined} aria-disabled={!confirmed} target={href.startsWith("http")?"_blank":undefined} rel="noreferrer" className="rounded-full border px-3 py-1 text-sm aria-disabled:pointer-events-none aria-disabled:opacity-40">Open {contact.route}</a>:null}<button type="button" onClick={()=>navigator.clipboard.writeText(contact.displayValue)} className="rounded-full border px-3 py-1 text-sm">Copy contact</button></div>;
}