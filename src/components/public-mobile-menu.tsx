"use client";

import Link from "next/link";
import { Menu, X } from "lucide-react";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { contentPublicConfig } from "@/src/config/site";
import { InstallAppButton } from "@/src/components/pwa-runtime";

export function PublicMobileMenu() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const trigger = useRef<HTMLButtonElement>(null);
  const panel = useRef<HTMLDivElement>(null);
  const close = (restoreFocus = true) => {
    setOpen(false);
    if (restoreFocus) requestAnimationFrame(() => trigger.current?.focus());
  };

  useEffect(() => {
    queueMicrotask(() => setOpen(false));
  }, [pathname]);

  useEffect(() => {
    if (!open) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    panel.current?.querySelector<HTMLElement>("button,a")?.focus();
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") close();
      if (event.key === "Tab" && panel.current) {
        const nodes = [...panel.current.querySelectorAll<HTMLElement>("button,a")];
        if (!nodes.length) return;
        const first = nodes[0], last = nodes[nodes.length - 1];
        if (event.shiftKey && document.activeElement === first) {
          event.preventDefault(); last.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault(); first.focus();
        }
      }
    };
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = previous;
      window.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const links = [
    ["/shop", "Shop"], ["/business-supply", "Business Supply"],
    ...(contentPublicConfig.hubEnabled ? [["/blog", "Blog"]] : []),
    ["/about", "About"], ["/contact", "Contact"], ["/track-order", "Track Order"],
  ];

  return <div className="md:hidden">
    <button ref={trigger} type="button" onClick={() => setOpen(true)} aria-expanded={open} aria-label="Open menu" className="grid size-11 place-items-center rounded-full border border-green-900/20 bg-white text-green-950"><Menu size={21}/></button>
    {open ? <div className="fixed inset-0 z-50 bg-black/40" onMouseDown={(event) => { if (event.target === event.currentTarget) close(); }}>
      <div ref={panel} role="dialog" aria-modal="true" aria-label="Main menu" className="absolute inset-y-0 right-0 w-[min(88vw,360px)] overflow-y-auto bg-[#fbf7ed] px-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] pt-[max(1.25rem,env(safe-area-inset-top))] shadow-2xl">
        <div className="flex items-center justify-between"><strong className="text-lg text-green-950">Menu</strong><button type="button" onClick={() => close()} aria-label="Close menu" className="grid size-11 place-items-center rounded-full border"><X size={20}/></button></div>
        <nav className="mt-6 grid gap-2">
          {links.map(([href, label]) => <Link key={href} href={href} onClick={() => close(false)} aria-current={pathname === href ? "page" : undefined} className={"flex min-h-11 items-center rounded-lg px-4 font-bold " + (pathname === href ? "bg-green-100 text-green-950" : "text-stone-700")}>{label}</Link>)}
          <div className="min-h-11 px-4 py-3 font-bold text-green-900"><InstallAppButton label="Install Shields Farms" afterClick={() => close(false)}/></div>
        </nav>
      </div>
    </div> : null}
  </div>;
}
