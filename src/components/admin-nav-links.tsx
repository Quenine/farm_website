"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { adminNav } from "@/src/lib/business-data";

function isActiveRoute(pathname: string, href: string) {
  if (href === "/admin") return pathname === href;
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function AdminNavLinks() {
  const pathname = usePathname();

  return (
    <nav className="mt-5 grid gap-1">
      {adminNav.map((item) => {
        const active = isActiveRoute(pathname, item.href);
        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={active ? "page" : undefined}
            className={`flex items-center gap-3 rounded-lg px-3 py-3 text-sm font-semibold transition ${
              active
                ? "bg-white/15 text-white shadow-sm"
                : "text-green-50 hover:bg-white/10"
            }`}
          >
            <item.icon size={18} />
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
