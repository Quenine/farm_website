"use client";

import Link from "next/link";
import { useEffect } from "react";
import { AdminSubnav } from "@/src/components/content-admin/admin-subnav";

export default function AffiliateAdminError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error("[Affiliate Admin Boundary]", { digest: error.digest, message: error.message });
  }, [error]);
  return <div><AdminSubnav type="affiliate" /><section className="rounded-lg bg-white p-6 shadow-sm"><h1 className="text-2xl font-bold text-green-950">Affiliate admin could not load</h1><p className="mt-2 text-sm text-stone-600">A protected affiliate admin page failed. Diagnostic reference: {error.digest ?? "AFFILIATE-BOUNDARY"}.</p><div className="mt-4 flex flex-wrap gap-3"><button type="button" onClick={reset} className="rounded-full bg-green-800 px-4 py-2 text-sm font-bold text-white">Retry</button><Link href="/admin/content/diagnostics" className="rounded-full border border-green-800 px-4 py-2 text-sm font-bold text-green-950">Content Diagnostics</Link></div></section></div>;
}
