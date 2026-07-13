"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export const contentTabs = [
  ["Overview", "/admin/content"],
  ["Posts", "/admin/content/posts"],
  ["Categories", "/admin/content/categories"],
  ["Tags", "/admin/content/tags"],
  ["Authors", "/admin/content/authors"],
  ["Sources", "/admin/content/sources"],
  ["Videos", "/admin/content/videos"],
  ["Content Commerce", "/admin/content/commerce"],
  ["Subscribers", "/admin/content/subscribers"],
] as const;

export const affiliateTabs = [
  ["Overview", "/admin/affiliate"],
  ["Partners", "/admin/affiliate/partners"],
  ["Offers", "/admin/affiliate/offers"],
] as const;

export function AdminSubnav({ type = "content" }: { type?: "content" | "affiliate" }) {
  const pathname = usePathname();
  const tabs = type === "content" ? contentTabs : affiliateTabs;
  return (
    <nav className="mb-6 flex gap-2 overflow-x-auto rounded-lg bg-white p-2 shadow-sm" aria-label={`${type} admin navigation`}>
      {tabs.map(([label, href]) => {
        const active = pathname === href || (href !== `/admin/${type}` && pathname.startsWith(`${href}/`));
        return <Link key={href} href={href} className={`shrink-0 rounded-full px-4 py-2 text-sm font-bold ${active ? "bg-green-800 text-white" : "text-green-950 hover:bg-green-50"}`}>{label}</Link>;
      })}
    </nav>
  );
}
