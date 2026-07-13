"use client";

import { useActionState } from "react";
import { subscribeToContentUpdates, type SubscribeState } from "@/src/components/content/subscribe-actions";
import { contentPublicConfig, siteConfig } from "@/src/config/site";

const initialState: SubscribeState = { ok: false, message: "" };

export function ContentSubscribeForm({ sourcePath, compact = false }: { sourcePath: string; compact?: boolean }) {
  const [state, action, isPending] = useActionState(subscribeToContentUpdates, initialState);
  if (!contentPublicConfig.subscriptionsEnabled) return null;

  return (
    <form action={action} className={`rounded-lg border border-green-900/10 bg-white p-5 shadow-sm ${compact ? "" : "max-w-2xl"}`}>
      <input type="hidden" name="sourcePath" value={sourcePath} />
      <label className="hidden" aria-hidden="true">
        Website
        <input name="website" tabIndex={-1} autoComplete="off" />
      </label>
      <div>
        <p className="text-sm font-bold uppercase tracking-[0.16em] text-green-700">Updates</p>
        <h2 className="mt-2 text-2xl font-bold text-green-950">Get agribusiness guides and farm updates</h2>
        <p className="mt-2 text-sm leading-6 text-stone-700">Receive practical guides, poultry updates, farm tools and equipment recommendations, and {siteConfig.name} product supply updates.</p>
      </div>
      <div className="mt-4 grid gap-3 sm:grid-cols-[1fr_220px]">
        <label className="grid gap-2 text-sm font-semibold text-stone-800">
          Email address
          <input name="email" type="email" required placeholder="you@example.com" className="h-12 rounded-lg border border-stone-200 px-4 text-sm focus:border-green-700 focus:outline-none focus:ring-2 focus:ring-green-700/20" />
        </label>
        <label className="grid gap-2 text-sm font-semibold text-stone-800">
          Topic
          <select name="topic" className="h-12 rounded-lg border border-stone-200 px-4 text-sm focus:border-green-700 focus:outline-none focus:ring-2 focus:ring-green-700/20">
            <option>Agribusiness guides</option>
            <option>Poultry updates</option>
            <option>Farm tools and equipment</option>
            <option>{siteConfig.name} supply updates</option>
          </select>
        </label>
      </div>
      <label className="mt-4 flex items-start gap-3 text-sm leading-6 text-stone-700">
        <input name="consent" type="checkbox" required className="mt-1" />
        <span>I agree to receive updates from {siteConfig.name}. I understand I can unsubscribe later.</span>
      </label>
      {state.message ? <p role="status" className={`mt-3 text-sm font-semibold ${state.ok ? "text-green-800" : "text-red-700"}`}>{state.message}</p> : null}
      <button type="submit" disabled={isPending} className="mt-4 inline-flex h-11 items-center justify-center rounded-full bg-green-800 px-5 text-sm font-bold text-white disabled:opacity-60">
        {isPending ? "Saving..." : "Subscribe"}
      </button>
    </form>
  );
}
