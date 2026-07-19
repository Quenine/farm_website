"use client";

import Link from "next/link";
import { LogOut, Menu, X } from "lucide-react";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { logoutAdmin } from "@/app/admin/logout/actions";
import { siteConfig } from "@/src/config/site";
import type { ContentFeatures } from "@/src/lib/content-features";
import { AdminNavLinks } from "@/src/components/admin-nav-links";

export function AdminMobileMenu({ features }: { features: ContentFeatures }) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const trigger = useRef<HTMLButtonElement>(null);
  const panel = useRef<HTMLDivElement>(null);
  const close = (restore = true) => {
    setOpen(false);
    if (restore) requestAnimationFrame(() => trigger.current?.focus());
  };
  useEffect(() => { queueMicrotask(() => setOpen(false)); }, [pathname]);
  useEffect(() => {
    if (!open) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    panel.current?.querySelector<HTMLElement>("button,a")?.focus();
    const key = (event: KeyboardEvent) => { if (event.key === "Escape") close(); };
    window.addEventListener("keydown", key);
    return () => { document.body.style.overflow = previous; window.removeEventListener("keydown", key); };
  }, [open]);
  return <>
    <button ref={trigger} type="button" onClick={() => setOpen(true)} aria-expanded={open} aria-label="Open admin menu" className="flex min-h-11 items-center gap-2 rounded-lg border border-white/30 px-4 font-bold"><Menu size={18}/> Menu</button>
    {open ? <div className="fixed inset-0 z-50 bg-black/50" onMouseDown={(event) => { if (event.target === event.currentTarget) close(); }}>
      <aside ref={panel} role="dialog" aria-modal="true" aria-label="Admin menu" className="absolute inset-y-0 left-0 w-[min(88vw,360px)] overflow-y-auto bg-green-950 p-4 text-white shadow-2xl">
        <div className="flex items-center justify-between"><strong>Admin menu</strong><button type="button" onClick={() => close()} aria-label="Close admin menu" className="grid size-11 place-items-center rounded-full border border-white/30"><X size={20}/></button></div>
        <Link href="/" onClick={() => close(false)} className="mt-4 block rounded-lg bg-white/10 p-4 font-bold">{siteConfig.name}<span className="mt-1 block text-xs font-normal text-green-100">Owner admin</span></Link>
        <AdminNavLinks features={features} onNavigate={() => close(false)}/>
        <form action={logoutAdmin} className="mt-6 border-t border-white/15 pt-5"><button type="submit" className="flex min-h-11 w-full items-center gap-3 rounded-lg px-3 text-sm font-semibold text-green-50 hover:bg-white/10"><LogOut size={18}/>Logout</button></form>
      </aside>
    </div> : null}
  </>;
}
