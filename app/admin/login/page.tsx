import Link from "next/link";
import { Leaf } from "lucide-react";
import { redirect } from "next/navigation";
import { AdminLoginForm } from "@/app/admin/login/login-form";
import { getAuthenticatedAdmin } from "@/src/lib/admin-auth";

export default async function AdminLoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const admin = await getAuthenticatedAdmin();
  if (admin) redirect("/admin");
  const { error } = await searchParams;

  return (
    <main className="grid min-h-screen place-items-center bg-[#fbf7ed] px-4 py-10">
      <section className="w-full max-w-md rounded-lg bg-white p-7 shadow-sm">
        <Link href="/" className="flex items-center gap-3">
          <span className="flex size-11 items-center justify-center rounded-full bg-green-800 text-white">
            <Leaf size={21} />
          </span>
          <span>
            <span className="block text-xl font-bold text-green-950">
              Noble Farms
            </span>
            <span className="text-xs font-semibold text-stone-500">
              Owner administration
            </span>
          </span>
        </Link>
        <h1 className="mt-7 text-3xl font-bold text-stone-950">Admin login</h1>
        <p className="mt-2 text-sm leading-6 text-stone-600">
          Sign in with the owner account configured for this Noble Farms
          project.
        </p>
        {error === "unauthorized" ? (
          <div className="mt-5 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm font-semibold text-amber-900">
            That account is signed in but is not authorized as the Noble Farms
            owner.
          </div>
        ) : null}
        {error === "configuration" ? (
          <div className="mt-5 rounded-lg border border-red-200 bg-red-50 p-3 text-sm font-semibold text-red-700">
            Admin authentication is not configured. Set ADMIN_EMAIL on the
            server.
          </div>
        ) : null}
        <AdminLoginForm />
        <Link
          href="/"
          className="mt-5 block text-center text-sm font-bold text-green-800"
        >
          Back to homepage
        </Link>
      </section>
    </main>
  );
}
