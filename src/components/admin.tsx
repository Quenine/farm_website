/* eslint-disable @next/next/no-img-element */
import Link from "next/link";
import { LogOut } from "lucide-react";
import { siteConfig } from "@/src/config/site";
import { logoutAdmin } from "@/app/admin/logout/actions";
import { adminNav } from "@/src/lib/business-data";

export function AdminShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-stone-100">
      <div className="mx-auto grid max-w-7xl gap-6 px-4 py-6 lg:grid-cols-[260px_1fr]">
        <aside className="rounded-lg bg-green-950 p-4 text-white shadow-sm lg:min-h-[calc(100vh-48px)]">
          <Link href="/" className="flex items-center gap-3 rounded-lg bg-white/10 p-4">
            <span className="grid size-11 place-items-center overflow-hidden rounded-full bg-white">
              <img
                src={siteConfig.logoPath}
                alt={`${siteConfig.name} logo`}
                className="h-9 w-9 object-contain"
              />
            </span>
            <span>
              <span className="text-lg font-bold">{siteConfig.name}</span>
              <span className="mt-1 block text-xs text-green-100">Owner admin</span>
            </span>
          </Link>
          <nav className="mt-5 grid gap-1">
            {adminNav.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="flex items-center gap-3 rounded-lg px-3 py-3 text-sm font-semibold text-green-50 transition hover:bg-white/10"
              >
                <item.icon size={18} />
                {item.label}
              </Link>
            ))}
          </nav>
          <form action={logoutAdmin} className="mt-6 border-t border-white/15 pt-5">
            <button
              type="submit"
              className="flex w-full items-center gap-3 rounded-lg px-3 py-3 text-sm font-semibold text-green-50 transition hover:bg-white/10"
            >
              <LogOut size={18} />
              Logout
            </button>
          </form>
        </aside>
        <main>{children}</main>
      </div>
    </div>
  );
}

export function AdminHeader({
  title,
  body,
}: {
  title: string;
  body: string;
}) {
  return (
    <div className="mb-6 rounded-lg bg-white p-5 shadow-sm">
      <p className="text-sm font-bold uppercase tracking-[0.16em] text-green-700">
        Admin
      </p>
      <h1 className="mt-2 text-3xl font-bold text-stone-950">{title}</h1>
      <p className="mt-2 text-sm leading-6 text-stone-600">{body}</p>
    </div>
  );
}

export function StatCard({
  label,
  value,
  note,
}: {
  label: string;
  value: string;
  note: string;
}) {
  return (
    <div className="rounded-lg bg-white p-5 shadow-sm">
      <p className="text-sm font-semibold text-stone-500">{label}</p>
      <p className="mt-2 text-3xl font-bold text-green-950">{value}</p>
      <p className="mt-2 text-sm text-stone-600">{note}</p>
    </div>
  );
}

export function StatusBadge({ status }: { status: string }) {
  const normalized = status.toLowerCase();
  const tone =
    normalized === "paid" || normalized === "delivered"
      ? "bg-green-100 text-green-800"
      : normalized.includes("pending")
        ? "bg-amber-100 text-amber-800"
        : normalized.includes("failed") ||
            normalized.includes("cancelled") ||
            normalized.includes("review")
          ? "bg-red-100 text-red-800"
          : normalized === "out for delivery"
          ? "bg-blue-100 text-blue-800"
          : "bg-lime-100 text-lime-800";

  return (
    <span className={`rounded-full px-3 py-1 text-xs font-bold ${tone}`}>
      {status}
    </span>
  );
}

export function AdminActionButtons() {
  return (
    <div className="flex flex-wrap gap-2">
      {["Edit", "Delete"].map((label) => (
        <button
          key={label}
          type="button"
          className={`h-9 rounded-full px-3 text-xs font-bold ${
            label === "Delete"
              ? "bg-red-50 text-red-700"
              : "bg-green-50 text-green-800"
          }`}
        >
          {label}
        </button>
      ))}
    </div>
  );
}

export function AdminTable({
  headers,
  rows,
}: {
  headers: string[];
  rows: React.ReactNode[][];
}) {
  return (
    <div className="overflow-hidden rounded-lg bg-white shadow-sm">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[720px] text-left text-sm">
          <thead className="bg-green-950 text-white">
            <tr>
              {headers.map((header) => (
                <th key={header} className="px-4 py-3 font-semibold">
                  {header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-stone-100">
            {rows.map((row, index) => (
              <tr key={index} className="text-stone-700">
                {row.map((cell, cellIndex) => (
                  <td key={cellIndex} className="px-4 py-4">
                    {cell}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}



