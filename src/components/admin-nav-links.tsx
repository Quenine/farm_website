"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  BarChart3,
  Boxes,
  CircleGauge,
  ClipboardList,
  FileText,
  Handshake,
  ListChecks,
  Mail,
  MapPin,
  MapPinned,
  Megaphone,
  PackageCheck,
  Settings,
} from "lucide-react";
import type { ContentFeatures } from "@/src/lib/content-features";
import type { AdminNavItem } from "@/src/types";

function buildAdminNav(features: ContentFeatures): AdminNavItem[] {
  return [
    { href: "/admin", label: "Dashboard", icon: BarChart3 },
    { href: "/admin/products", label: "Products", icon: PackageCheck },
    { href: "/admin/orders", label: "Orders", icon: ClipboardList },
    { href: "/admin/inquiries", label: "Inquiries", icon: Mail },
    { href: "/admin/inventory", label: "Inventory", icon: Boxes },
    { href: "/admin/delivery-rates", label: "Delivery Rates", icon: MapPin },
    { href: "/admin/delivery-coverage", label: "Delivery Coverage", icon: MapPinned },
    ...(features.contentHubEnabled ? [{ href: "/admin/content", label: "Content", icon: FileText }] : []),
    ...(features.affiliateContentEnabled ? [{ href: "/admin/affiliate", label: "Affiliate", icon: Handshake }] : []),
    { href: "/admin/marketing/campaigns", label: "Marketing", icon: Megaphone },
    { href: "/admin/launch-checklist", label: "Launch Checklist", icon: ListChecks },
    { href: "/admin/diagnostics", label: "Diagnostics", icon: CircleGauge },
    { href: "/admin/settings", label: "Settings", icon: Settings },
  ];
}

function isActiveRoute(pathname: string, href: string) {
  if (href === "/admin") return pathname === href;
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function AdminNavLinks({ features }: { features: ContentFeatures }) {
  const pathname = usePathname();
  const nav = buildAdminNav(features);

  return (
    <nav className="mt-5 grid gap-1">
      {nav.map((item) => {
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
