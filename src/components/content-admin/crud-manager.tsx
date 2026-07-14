"use client";

import { useState, useTransition } from "react";
import { moveAdminEntityToTrashAction, permanentlyDeleteAdminEntityAction, restoreAdminEntityAction, saveAdminEntityAction, toggleAdminEntityAction } from "@/app/admin/(protected)/content/actions";
import type { AdminEntity, AdminRecord } from "@/src/lib/content-admin";

type Field = { name: string; label: string; type?: "text" | "textarea" | "number" | "url" | "date" | "checkbox" | "select" | "json-text"; required?: boolean; options?: Array<{ label: string; value: string }>; help?: string };
type Column = { key: string; label: string; valueKey?: string; format?: "text" | "number" | "status" | "date" };

type Props = {
  entity: Extract<AdminEntity, "authors" | "categories" | "tags" | "sources" | "partners" | "offers" | "videos">;
  title: string;
  createLabel: string;
  records: AdminRecord[];
  fields: Field[];
  columns: Column[];
  searchPlaceholder: string;
  emptyTitle: string;
  emptyBody: string;
  loadError?: string;
  createDisabledReason?: string;
  filters?: Record<string, string | undefined>;
  count?: number;
  page?: number;
  pageSize?: number;
  totalPages?: number;
};

function slugify(value: string) {
  return value.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
}

function stringValue(value: unknown) {
  if (Array.isArray(value)) return value.join(", ");
  if (value === null || value === undefined) return "";
  if (typeof value === "object") return JSON.stringify(value, null, 2);
  return String(value);
}

function columnValue(record: AdminRecord, column: Column) {
  const value = record[column.valueKey ?? column.key];
  if (column.format === "status") return value === true ? "Active" : value === false ? "Inactive" : stringValue(value);
  if (column.format === "number") return String(Number.isFinite(Number(value)) ? Number(value) : 0);
  if (column.format === "date") return typeof value === "string" && value ? new Date(value).toLocaleDateString("en-NG") : "-";
  return stringValue(value);
}

export function CrudManager({ entity, title, createLabel, records, fields, columns, searchPlaceholder, emptyTitle, emptyBody, loadError, createDisabledReason, filters = {}, count = records.length, page = 1, pageSize = 25, totalPages = 1 }: Props) {
  const [items, setItems] = useState(Array.isArray(records) ? records : []);
  const [editing, setEditing] = useState<AdminRecord | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const filtered = items;
  const pageHref = (nextPage: number) => { const params = new URLSearchParams(); for (const [key, value] of Object.entries(filters)) if (value) params.set(key, value); params.set('page', String(nextPage)); return `?${params.toString()}`; };

  const openCreate = () => {
    if (createDisabledReason) { setMessage(createDisabledReason); return; }
    const draft: AdminRecord = { is_active: true };
    if (entity === "categories") draft.sort_order = 100;
    if (entity === "sources") { draft.source_type = "other"; draft.is_primary_source = false; }
    if (entity === "offers") { draft.button_label = "Check current price"; draft.recommendation_basis = "editorial_research"; draft.is_featured = false; }
    if (entity === "videos") draft.platform = "youtube";
    setEditing(draft);
    setMessage(null);
  };

  const submit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!editing) return;
    const form = new FormData(event.currentTarget);
    const payload: AdminRecord = { id: editing.id };
    for (const field of fields) {
      if (field.type === "checkbox") payload[field.name] = form.get(field.name) === "on";
      else payload[field.name] = form.get(field.name)?.toString() ?? "";
    }
    startTransition(async () => {
      const result = await saveAdminEntityAction(entity, payload);
      setMessage(result.message);
      if (result.success) {
        const next = { ...editing, ...payload, id: result.id ?? editing.id };
        setItems((current) => editing.id ? current.map((item) => item.id === editing.id ? next : item) : [next, ...current]);
        setEditing(null);
      }
    });
  };

  const toggle = (record: AdminRecord) => {
    const nextActive = record.is_active !== true;
    startTransition(async () => {
      const result = await toggleAdminEntityAction(entity, String(record.id), nextActive);
      setMessage(result.message);
      if (result.success) setItems((current) => current.map((item) => item.id === record.id ? { ...item, is_active: nextActive } : item));
    });
  };


  const moveToTrash = (record: AdminRecord) => {
    const name = stringValue(record.title || record.name || record.slug || record.id);
    if (!window.confirm("Move '" + name + "' to Trash? This is reversible and public redirects or new selection will be disabled where applicable.")) return;
    startTransition(async () => {
      const result = await moveAdminEntityToTrashAction(entity, String(record.id), name);
      setMessage(result.message);
      if (result.success) setItems((current) => current.map((item) => item.id === record.id ? { ...item, deleted_at: new Date().toISOString(), is_active: false } : item));
    });
  };

  const restore = (record: AdminRecord) => {
    const name = stringValue(record.title || record.name || record.slug || record.id);
    if (!window.confirm("Restore '" + name + "' from Trash? It will remain inactive unless edited or reactivated.")) return;
    startTransition(async () => {
      const result = await restoreAdminEntityAction(entity, String(record.id), false);
      setMessage(result.message);
      if (result.success) setItems((current) => current.map((item) => item.id === record.id ? { ...item, deleted_at: null } : item));
    });
  };

  const permanentDelete = (record: AdminRecord) => {
    const name = stringValue(record.title || record.name || record.slug || record.id);
    const confirmation = window.prompt("Permanently delete '" + name + "'? This cannot be undone. Type DELETE to continue.") ?? "";
    startTransition(async () => {
      const result = await permanentlyDeleteAdminEntityAction(entity, String(record.id), confirmation);
      setMessage(result.message);
      if (result.success) setItems((current) => current.filter((item) => item.id !== record.id));
    });
  };

  const updateDraft = (key: string, value: string | boolean) => {
    setEditing((current) => {
      if (!current) return current;
      const next = { ...current, [key]: value };
      if (key === "name" || key === "title") {
        if (!current.slug) next.slug = slugify(String(value));
      }
      return next;
    });
  };

  return (
    <div className="grid gap-6">
      <div className="rounded-lg bg-white p-5 shadow-sm">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div><h2 className="text-2xl font-bold text-green-950">{title}</h2><p className="mt-1 text-sm text-stone-600">{filtered.length} of {count} records shown. Page {page} of {totalPages}.</p></div>
          <button type="button" onClick={openCreate} disabled={Boolean(createDisabledReason)} className="inline-flex h-11 items-center justify-center rounded-full bg-green-800 px-5 text-sm font-bold text-white disabled:cursor-not-allowed disabled:opacity-50">{createLabel}</button>
        </div>
        <form method="get" className="mt-4 grid gap-3 md:grid-cols-[1fr_180px_180px_auto]">
          <input name="q" defaultValue={filters.q} placeholder={searchPlaceholder} className="h-11 rounded-lg border border-stone-200 px-4 text-sm focus:border-green-700 focus:outline-none focus:ring-2 focus:ring-green-700/20" />
          <select name="active" defaultValue={filters.active ?? 'all'} className="h-11 rounded-lg border border-stone-200 px-4 text-sm"><option value="all">All statuses</option><option value="active">Active</option><option value="inactive">Inactive</option></select>
          <select name="trash" defaultValue={filters.trash ?? 'active'} className="h-11 rounded-lg border border-stone-200 px-4 text-sm"><option value="active">Active records</option><option value="trash">Trash</option><option value="all">All records</option></select>
          <button className="h-11 rounded-full bg-green-800 px-5 text-sm font-bold text-white">Apply</button>
        </form>
      </div>
      {loadError ? <div role="alert" className="rounded-lg bg-amber-50 p-4 text-sm font-bold text-amber-900">{loadError}</div> : null}
      {message ? <div role="status" className="rounded-lg bg-green-50 p-4 text-sm font-bold text-green-900">{message}</div> : null}
      {editing ? <form onSubmit={submit} className="grid gap-4 rounded-lg bg-white p-5 shadow-sm">
        <div className="flex items-center justify-between gap-3"><h3 className="text-xl font-bold text-green-950">{editing.id ? "Edit" : "Create"} {title.replace(/s$/, "")}</h3><button type="button" onClick={() => setEditing(null)} className="text-sm font-bold text-stone-600">Cancel</button></div>
        <div className="grid gap-4 md:grid-cols-2">
          {fields.map((field) => <FieldInput key={field.name} field={field} value={editing[field.name]} onChange={(value) => updateDraft(field.name, value)} />)}
        </div>
        <button disabled={isPending} className="h-11 w-fit rounded-full bg-green-800 px-5 text-sm font-bold text-white disabled:opacity-60">{isPending ? "Saving..." : "Save"}</button>
      </form> : null}
      {filtered.length ? <div className="overflow-hidden rounded-lg bg-white shadow-sm"><div className="overflow-x-auto"><table className="w-full min-w-[760px] text-left text-sm"><thead className="bg-green-950 text-white"><tr>{columns.map((column) => <th key={column.key} className="px-4 py-3 font-semibold">{column.label}</th>)}<th className="px-4 py-3 font-semibold">Actions</th></tr></thead><tbody className="divide-y divide-stone-100">{filtered.map((record) => <tr key={String(record.id)} className="text-stone-700">{columns.map((column) => <td key={column.key} className="px-4 py-4 align-top">{columnValue(record, column)}</td>)}<td className="px-4 py-4"><div className="flex flex-wrap gap-2"><button type="button" onClick={() => setEditing(record)} className="rounded-full bg-green-50 px-3 py-1 text-xs font-bold text-green-800">Edit</button>{"is_active" in record && !record.deleted_at ? <button type="button" onClick={() => toggle(record)} className="rounded-full bg-amber-50 px-3 py-1 text-xs font-bold text-amber-800">{record.is_active ? "Deactivate" : "Activate"}</button> : null}{record.deleted_at ? <><button type="button" onClick={() => restore(record)} className="rounded-full bg-green-50 px-3 py-1 text-xs font-bold text-green-800">Restore</button><button type="button" onClick={() => permanentDelete(record)} className="rounded-full bg-red-50 px-3 py-1 text-xs font-bold text-red-800">Permanently Delete</button></> : <button type="button" onClick={() => moveToTrash(record)} className="rounded-full bg-stone-100 px-3 py-1 text-xs font-bold text-stone-700">Move to Trash</button>}</div></td></tr>)}</tbody></table></div><nav className="flex items-center justify-between border-t border-stone-100 p-4"><a aria-disabled={page <= 1} href={page > 1 ? pageHref(page - 1) : undefined} className="text-sm font-bold text-green-800 aria-disabled:pointer-events-none aria-disabled:opacity-40">Previous</a><span className="text-sm text-stone-600">Page {page} of {totalPages} · {pageSize} per page</span><a aria-disabled={page >= totalPages} href={page < totalPages ? pageHref(page + 1) : undefined} className="text-sm font-bold text-green-800 aria-disabled:pointer-events-none aria-disabled:opacity-40">Next</a></nav></div> : <div className="rounded-lg bg-white p-8 text-center shadow-sm"><h3 className="text-xl font-bold text-green-950">{emptyTitle}</h3><p className="mt-2 text-sm text-stone-600">{emptyBody}</p>{createDisabledReason ? null : <button type="button" onClick={openCreate} className="mt-4 rounded-full bg-green-800 px-5 py-2 text-sm font-bold text-white">{createLabel}</button>}</div>}
    </div>
  );
}

function FieldInput({ field, value, onChange }: { field: Field; value: unknown; onChange: (value: string | boolean) => void }) {
  if (field.type === "checkbox") return <label className="flex items-center gap-3 text-sm font-semibold text-stone-800"><input name={field.name} type="checkbox" checked={value === true} onChange={(event) => onChange(event.target.checked)} />{field.label}</label>;
  const common = "rounded-lg border border-stone-200 px-4 text-sm focus:border-green-700 focus:outline-none focus:ring-2 focus:ring-green-700/20";
  return <label className="grid gap-2 text-sm font-semibold text-stone-800">{field.label}{field.required ? <span className="sr-only">required</span> : null}{field.type === "textarea" ? <textarea name={field.name} value={stringValue(value)} onChange={(event) => onChange(event.target.value)} rows={4} required={field.required} className={`${common} py-3`} /> : field.type === "select" ? <select name={field.name} value={stringValue(value)} onChange={(event) => onChange(event.target.value)} required={field.required} className={`h-11 ${common}`}>{field.options?.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select> : <input name={field.name} type={field.type ?? "text"} value={stringValue(value)} onChange={(event) => onChange(event.target.value)} required={field.required} className={`h-11 ${common}`} />}{field.help ? <span className="text-xs font-normal leading-5 text-stone-500">{field.help}</span> : null}</label>;
}
