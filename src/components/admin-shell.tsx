import "server-only";
/* eslint-disable @next/next/no-img-element */
import Link from "next/link";
import { LogOut } from "lucide-react";
import { siteConfig } from "@/src/config/site";
import { logoutAdmin } from "@/app/admin/logout/actions";
import { AdminNavLinks } from "@/src/components/admin-nav-links";
import { AdminMobileMenu } from "@/src/components/admin-mobile-menu";
import { getContentFeatures } from "@/src/lib/content-features";
import { loadAdminNotifications } from "@/src/lib/admin-notifications";
import { AdminNotificationBell } from "@/src/components/admin-notification-bell";

export async function AdminShell({ children }: { children: React.ReactNode }) {
  const contentFeatures = getContentFeatures();
  const notifications = await loadAdminNotifications(8);
  const sidebar = <><Link href="/" className="flex items-center gap-3 rounded-lg bg-white/10 p-4"><span className="grid size-11 place-items-center overflow-hidden rounded-full bg-white"><img src={siteConfig.logoPath} alt={siteConfig.name+" logo"} className="h-9 w-9 object-contain"/></span><span><span className="text-lg font-bold">{siteConfig.name}</span><span className="mt-1 block text-xs text-green-100">Owner admin</span></span></Link><AdminNavLinks features={contentFeatures}/><form action={logoutAdmin} className="mt-6 border-t border-white/15 pt-5"><button type="submit" className="flex w-full items-center gap-3 rounded-lg px-3 py-3 text-sm font-semibold text-green-50 hover:bg-white/10"><LogOut size={18}/>Logout</button></form></>;
  return <div className="min-h-screen bg-stone-100">
    <div className="sticky top-0 z-40 flex items-center justify-between bg-green-950 px-4 py-3 text-white lg:hidden"><AdminMobileMenu features={contentFeatures}/><AdminNotificationBell initial={notifications}/></div>
    <div className="mx-auto grid max-w-7xl gap-6 px-3 py-4 sm:px-4 lg:grid-cols-[260px_minmax(0,1fr)] lg:py-6">
      <aside className="hidden rounded-lg bg-green-950 p-4 text-white shadow-sm lg:block lg:min-h-[calc(100vh-48px)]">{sidebar}</aside>
      <main className="min-w-0"><div className="mb-3 hidden justify-end lg:flex"><AdminNotificationBell initial={notifications}/></div>{children}</main>
    </div>
  </div>;
}
