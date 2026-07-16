"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { permanentlyDeleteTrashedRecordAction, restoreTrashedRecordAction } from "@/app/admin/(protected)/content/actions";
import type { AdminEntity, AdminRecord } from "@/src/lib/content-admin";

type TrashEntity = Exclude<AdminEntity, "subscribers">;

export function TrashManager({ entity, records }: { entity: TrashEntity; records: AdminRecord[] }) {
  const router = useRouter();
  const [message, setMessage] = useState("");
  const [pending, startTransition] = useTransition();
  const label = (record: AdminRecord) => String(record.title || record.name || record.slug || record.id);

  const restore = (record: AdminRecord, reactivate: boolean) => {
    const resultingState = entity === "posts" ? "draft" : reactivate && !["partners", "offers"].includes(entity) ? "active" : "inactive";
    if (!window.confirm(`Restore ${label(record)}? Resulting state: ${resultingState}.`)) return;
    startTransition(async () => { const result = await restoreTrashedRecordAction(entity, String(record.id), reactivate); setMessage(result.message); if (result.success) router.refresh(); });
  };
  const permanentlyDelete = (record: AdminRecord) => {
    const confirmation = window.prompt(`Permanently delete ${label(record)}? This cannot be undone. Type DELETE to continue.`) ?? "";
    startTransition(async () => { const result = await permanentlyDeleteTrashedRecordAction(entity, String(record.id), confirmation); setMessage(result.message); if (result.success) router.refresh(); });
  };

  return <div className="grid gap-3">{message ? <p role="status" className="rounded-lg bg-amber-50 p-3 text-sm font-bold text-amber-900">{message}</p> : null}{records.map((record) => <article key={String(record.id)} className="rounded-lg border border-stone-200 bg-white p-4 shadow-sm"><div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between"><div><h2 className="font-bold text-green-950">{label(record)}</h2><p className="mt-1 text-xs text-stone-600">Deleted {record.deleted_at ? new Date(String(record.deleted_at)).toLocaleString("en-NG") : "-"} · By {String(record.deleted_by || "unknown admin")}</p><p className="mt-1 text-xs text-stone-600">Previous status: {String(record.status ?? (record.is_active ? "active" : "inactive"))} · Dependencies: {String(record.dependency_count ?? record.post_count ?? record.offer_count ?? 0)}</p><p className="mt-1 text-xs font-semibold text-amber-800">Restore result: {entity === "posts" ? "Draft, never automatically republished" : "Inactive by default"}</p></div><div className="flex flex-wrap gap-2"><button type="button" disabled={pending} onClick={() => restore(record, false)} className="rounded-full bg-green-800 px-3 py-2 text-xs font-bold text-white">Restore</button>{!["posts", "partners", "offers"].includes(entity) ? <button type="button" disabled={pending} onClick={() => restore(record, true)} className="rounded-full border border-green-800 px-3 py-2 text-xs font-bold text-green-950">Restore and Activate</button> : null}<button type="button" disabled={pending} onClick={() => permanentlyDelete(record)} className="rounded-full border border-red-700 px-3 py-2 text-xs font-bold text-red-800">Permanently Delete</button></div></div></article>)}</div>;
}
