"use client";

import { siteConfig } from "@/src/config/site";

import Link from "next/link";

export default function ErrorPage({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <main className="mx-auto flex min-h-[60vh] max-w-3xl flex-col items-center justify-center px-6 py-16 text-center">
      <p className="text-sm font-semibold uppercase tracking-[0.2em] text-green-700">
        {siteConfig.name}
      </p>
      <h1 className="mt-4 text-3xl font-bold text-slate-900">
        Something went wrong
      </h1>
      <p className="mt-3 max-w-xl text-slate-600">
        We could not load this page right now. Please try again, or return to
        the homepage.
      </p>
      <div className="mt-8 flex flex-wrap justify-center gap-3">
        <button
          type="button"
          onClick={reset}
          className="rounded-lg bg-green-700 px-5 py-3 font-semibold text-white hover:bg-green-800"
        >
          Try again
        </button>
        <Link
          href="/"
          className="rounded-lg border border-slate-300 px-5 py-3 font-semibold text-slate-800 hover:bg-slate-50"
        >
          Go home
        </Link>
      </div>
    </main>
  );
}


