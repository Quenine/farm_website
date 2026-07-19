"use client";
import Link from "next/link";
import { LogOut, Menu } from "lucide-react";
import { usePathname } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { logoutAdmin } from "@/app/admin/logout/actions";
import { siteConfig } from "@/src/config/site";
import type { ContentFeatures } from "@/src/lib/content-features";
import { AdminNavLinks } from "@/src/components/admin-nav-links";
import { MobileDrawer } from "@/src/components/mobile-drawer";

export function AdminMobileMenu({features}:{features:ContentFeatures}) {
  const pathname=usePathname(),trigger=useRef<HTMLButtonElement>(null);const[open,setOpen]=useState(false);
  const dismiss=useCallback((reason:"manual"|"navigation")=>{setOpen(false);if(reason==="manual")requestAnimationFrame(()=>trigger.current?.focus())},[]);
  useEffect(()=>{queueMicrotask(()=>setOpen(false))},[pathname]);
  return <><button ref={trigger} type="button" onClick={()=>setOpen(true)} aria-expanded={open} aria-haspopup="dialog" aria-label="Open admin menu" className="flex min-h-11 items-center gap-2 rounded-lg border border-white/30 px-4 font-bold"><Menu size={18}/> Menu</button><MobileDrawer open={open} title="Admin menu" side="left" onDismiss={dismiss}><Link href="/" onClick={()=>dismiss("navigation")} className="block rounded-lg bg-green-950 p-4 font-bold text-white">{siteConfig.name}<span className="mt-1 block text-xs font-normal text-green-100">Owner admin</span></Link><div className="rounded-lg bg-green-950 p-2 text-white"><AdminNavLinks features={features} onNavigate={()=>dismiss("navigation")}/><form action={logoutAdmin} className="mt-6 border-t border-white/15 pt-5"><button type="submit" className="flex min-h-11 w-full items-center gap-3 rounded-lg px-3 text-sm font-semibold"><LogOut size={18}/>Logout</button></form></div></MobileDrawer></>;
}
