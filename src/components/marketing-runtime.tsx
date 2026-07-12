"use client";

import { useEffect, useState } from "react";
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

function initialPreferences() {
  return getConsentPreferences();
}

export function MarketingRuntime() {
  const [preferences, setPreferences] = useState<ConsentPreferences | null>(() => initialPreferences());
  const [showBanner, setShowBanner] = useState(() => !initialPreferences());
  const [managing, setManaging] = useState(false);
  const [draft, setDraft] = useState<ConsentPreferences>(() => initialPreferences() ?? defaultDraft());

  useEffect(() => {
    captureAttributionFromLocation();
    trackPageView();

    const openPreferences = () => {
      const latest = getConsentPreferences();
      setDraft(latest ?? defaultDraft());
      setManaging(true);
      setShowBanner(true);
    };
    const onConsentChanged = () => {
      const latest = getConsentPreferences();
      setPreferences(latest);
      if (latest?.analytics || latest?.marketing) trackPageView();
    };
    window.addEventListener("farm-open-cookie-preferences", openPreferences);
    window.addEventListener("farm-consent-changed", onConsentChanged);
    return () => {
      window.removeEventListener("farm-open-cookie-preferences", openPreferences);
      window.removeEventListener("farm-consent-changed", onConsentChanged);
    };
  }, []);

  const save = (analytics: boolean, marketing: boolean) => {
    const next = saveConsentPreferences({ analytics, marketing });
    setPreferences(next);
    setDraft(next);
    setShowBanner(false);
    setManaging(false);
    if (analytics || marketing) trackPageView();
  };

  if (!showBanner && preferences) return null;

  return (
    <div className="fixed inset-x-0 bottom-0 z-50 border-t border-green-900/10 bg-[#fbf7ed] p-4 shadow-2xl">
      <div className="mx-auto grid max-w-5xl gap-4 md:grid-cols-[1fr_auto] md:items-end">
        <div>
          <p className="text-sm font-bold text-green-950">Privacy preferences</p>
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
            <button type="button" onClick={() => save(draft.analytics, draft.marketing)} className="h-10 rounded-full bg-green-800 px-4 text-sm font-bold text-white">Save preferences</button>
          ) : (
            <button type="button" onClick={() => setManaging(true)} className="h-10 rounded-full border border-green-800 px-4 text-sm font-bold text-green-950">Manage Preferences</button>
          )}
          <button type="button" onClick={() => save(false, false)} className="h-10 rounded-full border border-green-800 px-4 text-sm font-bold text-green-950">Reject Non-Essential</button>
          <button type="button" onClick={() => save(true, true)} className="h-10 rounded-full bg-green-800 px-4 text-sm font-bold text-white">Accept All</button>
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
