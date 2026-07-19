"use client";
import Link from "next/link";
import { Menu } from "lucide-react";
import { usePathname } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { contentPublicConfig } from "@/src/config/site";
import { InstallAppButton } from "@/src/components/pwa-runtime";
import { MobileDrawer } from "@/src/components/mobile-drawer";

export function PublicMobileMenu() {
  const pathname=usePathname(), trigger=useRef<HTMLButtonElement>(null);
  const [open,setOpen]=useState(false);
  const dismiss=useCallback((reason:"manual"|"navigation")=>{setOpen(false);if(reason==="manual")requestAnimationFrame(()=>trigger.current?.focus())},[]);
  useEffect(()=>{queueMicrotask(()=>setOpen(false))},[pathname]);
  useEffect(()=>{const close=()=>setOpen(false);window.addEventListener("popstate",close);return()=>window.removeEventListener("popstate",close)},[]);
  const links=[["/shop","Shop"],["/business-supply","Business Supply"],...(contentPublicConfig.hubEnabled?[["/blog","Blog"]]:[]),["/about","About"],["/contact","Contact"],["/track-order","Track Order"]];
  return <div className="md:hidden"><button ref={trigger} type="button" onClick={()=>setOpen(true)} aria-expanded={open} aria-haspopup="dialog" aria-label="Open menu" className="grid size-11 shrink-0 place-items-center rounded-full border border-green-900/20 bg-white text-green-950"><Menu size={21}/></button><MobileDrawer open={open} title="Menu" onDismiss={dismiss}><nav className="grid gap-2">{links.map(([href,label])=><Link key={href} href={href} onClick={()=>dismiss("navigation")} aria-current={pathname===href?"page":undefined} className={"flex min-h-11 items-center rounded-lg px-4 font-bold "+(pathname===href?"bg-green-100 text-green-950":"text-stone-700 hover:bg-white")}>{label}</Link>)}<div className="border-t border-green-900/10 px-4 pt-3 font-bold text-green-900"><InstallAppButton label="Install Shields Farms" afterClick={()=>dismiss("navigation")}/></div></nav></MobileDrawer></div>;
}
