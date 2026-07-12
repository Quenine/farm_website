"use client";

import { useMemo } from "react";
import { siteConfig } from "@/src/config/site";

function configuredHostname() {
  try {
    return new URL(siteConfig.url).hostname;
  } catch {
    return null;
  }
}

function localHostname(hostname: string) {
  return hostname === "localhost" || hostname === "127.0.0.1" || hostname === "::1" || hostname.endsWith(".local");
}

export function MarketingUrlPanel() {
  const status = useMemo(() => {
    const configured = configuredHostname();
    const current = typeof window === "undefined" ? "" : window.location.hostname;
    const configuredUrlValid = Boolean(configured);
    const localPreview = current ? localHostname(current) : false;
    const mismatch = Boolean(configured && current && configured !== current && !localPreview && process.env.NODE_ENV === "production");
    return { configured, current, configuredUrlValid, localPreview, mismatch };
  }, []);

  return (
    <div className="mb-5 rounded-lg border border-green-100 bg-white p-4 text-sm leading-6 text-stone-700 shadow-sm">
      <div className="flex flex-col justify-between gap-3 md:flex-row md:items-start">
        <div>
          <p className="font-bold text-green-950">Configured marketing link base</p>
          <p className="mt-1 break-all font-semibold text-stone-900">{siteConfig.url || "Not configured"}</p>
          <p className="mt-2">Tracked links and campaign QR codes use this configured website URL.</p>
        </div>
        <button type="button" onClick={() => navigator.clipboard?.writeText(siteConfig.url)} className="h-10 rounded-full border border-green-800 px-4 text-xs font-bold text-green-950">
          Copy base URL
        </button>
      </div>
      {!status.configuredUrlValid ? (
        <p className="mt-3 rounded-lg border border-red-200 bg-red-50 p-3 font-semibold text-red-800">NEXT_PUBLIC_SITE_URL is empty or invalid. Review it before creating printable campaign links or QR codes.</p>
      ) : null}
      {status.localPreview ? (
        <p className="mt-3 rounded-lg border border-amber-200 bg-amber-50 p-3 font-semibold text-amber-900">Local preview: generated links currently use the configured development URL. Production QR codes should be generated after deploying with the production site URL.</p>
      ) : null}
      {status.mismatch ? (
        <p className="mt-3 rounded-lg border border-red-200 bg-red-50 p-3 font-semibold text-red-800">The current deployment hostname does not match the configured marketing URL. Review NEXT_PUBLIC_SITE_URL before printing or sharing campaign QR codes.</p>
      ) : null}
      {status.current ? <p className="mt-3 text-xs font-semibold text-stone-500">Current browser hostname: {status.current}. Configured hostname: {status.configured ?? "invalid"}.</p> : null}
    </div>
  );
}
