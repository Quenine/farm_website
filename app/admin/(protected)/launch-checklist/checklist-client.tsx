"use client";

import { useState, useTransition } from "react";
import { resetLaunchChecklistAction, saveLaunchChecklistAction } from "./actions";

export type ChecklistSection = { title: string; items: Array<{ id: string; label: string }> };

export function ChecklistClient({ sections, initialChecked, updatedAt, checkedBy }: { sections: ChecklistSection[]; initialChecked: string[]; updatedAt?: string; checkedBy?: string }) {
  const [checked, setChecked] = useState(new Set(initialChecked));
  const [message, setMessage] = useState("");
  const [pending, startTransition] = useTransition();
  const toggle = (id: string) => setChecked((current) => { const next = new Set(current); if (next.has(id)) next.delete(id); else next.add(id); return next; });
  const save = () => startTransition(async () => { const result = await saveLaunchChecklistAction([...checked]); setMessage(result.message); });
  const reset = () => startTransition(async () => { const result = await resetLaunchChecklistAction(); if (result.ok) setChecked(new Set()); setMessage(result.message); });
  return <><div className="mb-4 flex flex-wrap items-center gap-3"><button type="button" disabled={pending} onClick={save} className="rounded-full bg-green-800 px-4 py-2 text-sm font-bold text-white">Save checklist</button><button type="button" disabled={pending} onClick={reset} className="rounded-full border border-red-700 px-4 py-2 text-sm font-bold text-red-800">Reset</button><span aria-live="polite" className="text-sm text-stone-600">{pending ? "Saving..." : message || (updatedAt ? `Last updated ${new Date(updatedAt).toLocaleString("en-NG")}${checkedBy ? ` by ${checkedBy}` : ""}` : "Not saved yet.")}</span></div><section className="grid gap-4 lg:grid-cols-2">{sections.map((section) => <div key={section.title} className="rounded-lg border border-green-100 bg-white p-5 shadow-sm"><h2 className="text-lg font-bold text-green-950">{section.title}</h2><div className="mt-4 grid gap-2">{section.items.map((item) => <label key={item.id} className="flex items-start gap-3 rounded-lg border border-stone-100 bg-stone-50 p-3 text-sm font-semibold text-stone-800"><input type="checkbox" checked={checked.has(item.id)} onChange={() => toggle(item.id)} className="mt-1 size-4 rounded border-stone-300" /><span>{item.label}</span></label>)}</div></div>)}</section></>;
}
