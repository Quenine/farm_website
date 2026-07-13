"use client";

import { useEffect, useRef, useState } from "react";
import {
  captureAttributionFromLocation,
  CONSENT_STORAGE_KEY,
  getConsentPreferences,
  saveConsentPreferences,
  trackPageView,
  type ConsentPreferences,
} from "@/src/lib/analytics";

function defaultDraft(): ConsentPreferences {
  return { essential: true, analytics: false, marketing: false, updatedAt: new Date().toISOString() };
}

type ConsentView = "banner" | "modal" | "hidden";

export function MarketingRuntime() {
  const [hydrated, setHydrated] = useState(false);
  const [preferences, setPreferences] = useState<ConsentPreferences | null>(null);
  const [view, setView] = useState<ConsentView>("hidden");
  const [draft, setDraft] = useState<ConsentPreferences>(() => defaultDraft());
  const manageButtonRef = useRef<HTMLButtonElement | null>(null);
  const saveButtonRef = useRef<HTMLButtonElement | null>(null);

  useEffect(() => {
    window.queueMicrotask(() => {
      const latest = getConsentPreferences();
      setPreferences(latest);
      setDraft(latest ?? defaultDraft());
      setView(latest ? "hidden" : "banner");
      setHydrated(true);
      captureAttributionFromLocation();
      trackPageView();
    });

    const openPreferences = () => {
      const stored = getConsentPreferences();
      const next = stored ?? defaultDraft();
      setPreferences(stored);
      setDraft(next);
      setView("modal");
      window.setTimeout(() => saveButtonRef.current?.focus(), 0);
    };
    const onConsentChanged = () => {
      const stored = getConsentPreferences();
      setPreferences(stored);
      if (stored?.analytics || stored?.marketing) trackPageView();
    };
    window.addEventListener("farm-open-cookie-preferences", openPreferences);
    window.addEventListener("farm-consent-changed", onConsentChanged);
    return () => {
      window.removeEventListener("farm-open-cookie-preferences", openPreferences);
      window.removeEventListener("farm-consent-changed", onConsentChanged);
    };
  }, []);

  useEffect(() => {
    if (view !== "modal") return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      if (preferences) setView("hidden");
      else setView("banner");
      window.setTimeout(() => manageButtonRef.current?.focus(), 0);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [preferences, view]);

  const persist = (analytics: boolean, marketing: boolean) => {
    const next = saveConsentPreferences({ analytics, marketing });
    setPreferences(next);
    setDraft(next);
    setView("hidden");
    if (analytics || marketing) trackPageView();
  };

  if (!hydrated || view === "hidden") return null;
  const managing = view === "modal";

  return (
    <div className="fixed inset-x-0 bottom-0 z-50 border-t border-green-900/10 bg-[#fbf7ed] p-4 shadow-2xl" role="dialog" aria-modal={managing} aria-labelledby="privacy-preferences-title">
      <div className="mx-auto grid max-w-5xl gap-4 md:grid-cols-[1fr_auto] md:items-end">
        <div>
          <p id="privacy-preferences-title" className="text-sm font-bold text-green-950">Privacy preferences</p>
          <p className="mt-1 text-sm leading-6 text-stone-700">
            Essential cookies keep cart, checkout and security working. Analytics and marketing tracking are optional and only load after consent.
          </p>
          {managing ? (
            <div className="mt-3 grid gap-2 text-sm text-stone-800 sm:grid-cols-2">
              <label className="flex items-center gap-2 rounded-lg border border-green-100 bg-white p-3 font-semibold">
                <input type="checkbox" checked disabled /> Essential
              </label>
              <label className="flex items-center gap-2 rounded-lg border border-green-100 bg-white p-3 font-semibold">
                <input type="checkbox" checked={draft.analytics} onChange={(event) => setDraft((current) => ({ ...current, analytics: event.target.checked }))} /> Analytics
              </label>
              <label className="flex items-center gap-2 rounded-lg border border-green-100 bg-white p-3 font-semibold">
                <input type="checkbox" checked={draft.marketing} onChange={(event) => setDraft((current) => ({ ...current, marketing: event.target.checked }))} /> Marketing
              </label>
            </div>
          ) : null}
        </div>
        <div className="flex flex-wrap gap-2 md:justify-end">
          {managing ? (
            <button ref={saveButtonRef} type="button" onClick={() => persist(draft.analytics, draft.marketing)} className="h-10 rounded-full bg-green-800 px-4 text-sm font-bold text-white">Save Preferences</button>
          ) : (
            <button ref={manageButtonRef} type="button" onClick={() => setView("modal")} className="h-10 rounded-full border border-green-800 px-4 text-sm font-bold text-green-950">Manage Preferences</button>
          )}
          <button type="button" onClick={() => persist(false, false)} className="h-10 rounded-full border border-green-800 px-4 text-sm font-bold text-green-950">Reject Non-Essential</button>
          <button type="button" onClick={() => persist(true, true)} className="h-10 rounded-full bg-green-800 px-4 text-sm font-bold text-white">Accept All</button>
        </div>
      </div>
    </div>
  );
}

export function CookiePreferencesLink() {
  return (
    <button
      type="button"
      onClick={() => window.dispatchEvent(new CustomEvent("farm-open-cookie-preferences"))}
      className="text-left hover:text-white"
    >
      Cookie Preferences
    </button>
  );
}

export function resetConsentForTests() {
  window.localStorage.removeItem(CONSENT_STORAGE_KEY);
}
