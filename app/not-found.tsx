import Link from "next/link";

import { siteConfig } from "@/src/config/site";

export default function NotFound() {
  return (
    <main className="mx-auto flex min-h-[60vh] max-w-3xl flex-col items-center justify-center px-6 py-16 text-center">
      <p className="text-sm font-semibold uppercase tracking-[0.2em] text-green-700">
        {siteConfig.name}
      </p>
      <h1 className="mt-4 text-3xl font-bold text-slate-900">
        Page not found
      </h1>
      <p className="mt-3 text-slate-600">
        The page you requested does not exist or may have moved.
      </p>
      <Link
        href="/"
        className="mt-8 rounded-lg bg-green-700 px-5 py-3 font-semibold text-white hover:bg-green-800"
      >
        Return home
      </Link>
    </main>
  );
}


