"use client";

import { createPortal } from "react-dom";
import { X } from "lucide-react";
import { useEffect, useRef, useState } from "react";

export function MobileDrawer({ open, title, side = "right", onDismiss, children }: {
  open: boolean;
  title: string;
  side?: "left" | "right";
  onDismiss: (reason: "manual" | "navigation") => void;
  children: React.ReactNode;
}) {
  const [hydrated, setHydrated] = useState(false);
  const panel = useRef<HTMLElement>(null);
  useEffect(() => { queueMicrotask(() => setHydrated(true)); }, []);
  useEffect(() => {
    if (!open) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    panel.current?.querySelector<HTMLElement>("button,a,input")?.focus();
    const key = (event: KeyboardEvent) => {
      if (event.key === "Escape") onDismiss("manual");
      if (event.key === "Tab" && panel.current) {
        const nodes = [...panel.current.querySelectorAll<HTMLElement>("button,a,input,select,textarea")].filter((node) => !node.hasAttribute("disabled"));
        if (!nodes.length) return;
        const first = nodes[0], last = nodes[nodes.length - 1];
        if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
        else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
      }
    };
    window.addEventListener("keydown", key);
    return () => { document.body.style.overflow = previous; window.removeEventListener("keydown", key); };
  }, [open, onDismiss]);
  if (!hydrated || !open) return null;
  return createPortal(
    <div className="fixed inset-0 z-[1000] h-dvh w-screen bg-black/50" onMouseDown={(event) => { if (event.target === event.currentTarget) onDismiss("manual"); }}>
      <aside ref={panel} role="dialog" aria-modal="true" aria-label={title} className={`fixed inset-y-0 ${side === "right" ? "right-0" : "left-0"} h-dvh w-[min(88vw,360px)] overflow-y-auto bg-[#fbf7ed] px-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] pt-[max(1.25rem,env(safe-area-inset-top))] text-stone-900 shadow-2xl`}>
        <div className="flex min-h-11 items-center justify-between border-b border-green-900/10 pb-3">
          <strong className="text-lg text-green-950">{title}</strong>
          <button type="button" onClick={() => onDismiss("manual")} aria-label={`Close ${title.toLowerCase()}`} className="grid size-11 place-items-center rounded-full border border-green-900/20 bg-white"><X size={20}/></button>
        </div>
        <div className="pt-4">{children}</div>
      </aside>
    </div>,
    document.body,
  );
}
