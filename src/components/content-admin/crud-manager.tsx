"use client";

import { useMemo, useState, useTransition } from "react";
import { saveAdminEntityAction, toggleAdminEntityAction } from "@/app/admin/(protected)/content/actions";
import type { AdminEntity, AdminRecord } from "@/src/lib/content-admin";

type Field = { name: string; label: string; type?: "text" | "textarea" | "number" | "url" | "date" | "checkbox" | "select"; required?: boolean; options?: Array<{ label: string; value: string }>; help?: string };

type Props = {
  entity: Extract<AdminEntity, "authors" | "categories" | "tags" | "sources" | "partners" | "offers" | "videos">;
  title: string;
  createLabel: string;
  records: AdminRecord[];
  fields: Field[];
  columns: Array<{ key: string; label: string; render?: (record: AdminRecord) => React.ReactNode }>;
  searchPlaceholder: string;
  emptyTitle: string;
  emptyBody: string;
  extraFilters?: React.ReactNode;
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

function relationCount(value: unknown) {
  if (Array.isArray(value)) return Number((value[0] as { count?: number } | undefined)?.count ?? 0);
  return 0;
}

export function CrudManager({ entity, title, createLabel, records, fields, columns, searchPlaceholder, emptyTitle, emptyBody, extraFilters }: Props) {
  const [items, setItems] = useState(records);
  const [editing, setEditing] = useState<AdminRecord | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [activeFilter, setActiveFilter] = useState("all");
  const [isPending, startTransition] = useTransition();

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return items.filter((item) => {
      if (activeFilter === "active" && item.is_active !== true) return false;
      if (activeFilter === "inactive" && item.is_active !== false) return false;
      if (!q) return true;
      return Object.values(item).some((value) => stringValue(value).toLowerCase().includes(q));
    });
  }, [activeFilter, items, search]);

  const openCreate = () => {
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
          <div><h2 className="text-2xl font-bold text-green-950">{title}</h2><p className="mt-1 text-sm text-stone-600">{filtered.length} of {items.length} records shown.</p></div>
          <button type="button" onClick={openCreate} className="inline-flex h-11 items-center justify-center rounded-full bg-green-800 px-5 text-sm font-bold text-white">{createLabel}</button>
        </div>
        <div className="mt-4 grid gap-3 md:grid-cols-[1fr_180px]">
          <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder={searchPlaceholder} className="h-11 rounded-lg border border-stone-200 px-4 text-sm focus:border-green-700 focus:outline-none focus:ring-2 focus:ring-green-700/20" />
          <select value={activeFilter} onChange={(event) => setActiveFilter(event.target.value)} className="h-11 rounded-lg border border-stone-200 px-4 text-sm">
            <option value="all">All statuses</option><option value="active">Active</option><option value="inactive">Inactive</option>
          </select>
        </div>
        {extraFilters}
      </div>
      {message ? <div role="status" className="rounded-lg bg-green-50 p-4 text-sm font-bold text-green-900">{message}</div> : null}
      {editing ? <form onSubmit={submit} className="grid gap-4 rounded-lg bg-white p-5 shadow-sm">
        <div className="flex items-center justify-between gap-3"><h3 className="text-xl font-bold text-green-950">{editing.id ? "Edit" : "Create"} {title.replace(/s$/, "")}</h3><button type="button" onClick={() => setEditing(null)} className="text-sm font-bold text-stone-600">Cancel</button></div>
        <div className="grid gap-4 md:grid-cols-2">
          {fields.map((field) => <FieldInput key={field.name} field={field} value={editing[field.name]} onChange={(value) => updateDraft(field.name, value)} />)}
        </div>
        <button disabled={isPending} className="h-11 w-fit rounded-full bg-green-800 px-5 text-sm font-bold text-white disabled:opacity-60">{isPending ? "Saving..." : "Save"}</button>
      </form> : null}
      {filtered.length ? <div className="overflow-hidden rounded-lg bg-white shadow-sm"><div className="overflow-x-auto"><table className="w-full min-w-[760px] text-left text-sm"><thead className="bg-green-950 text-white"><tr>{columns.map((column) => <th key={column.key} className="px-4 py-3 font-semibold">{column.label}</th>)}<th className="px-4 py-3 font-semibold">Actions</th></tr></thead><tbody className="divide-y divide-stone-100">{filtered.map((record) => <tr key={String(record.id)} className="text-stone-700">{columns.map((column) => <td key={column.key} className="px-4 py-4 align-top">{column.render ? column.render(record) : stringValue(record[column.key])}</td>)}<td className="px-4 py-4"><div className="flex flex-wrap gap-2"><button type="button" onClick={() => setEditing(record)} className="rounded-full bg-green-50 px-3 py-1 text-xs font-bold text-green-800">Edit</button>{"is_active" in record ? <button type="button" onClick={() => toggle(record)} className="rounded-full bg-amber-50 px-3 py-1 text-xs font-bold text-amber-800">{record.is_active ? "Deactivate" : "Activate"}</button> : null}</div></td></tr>)}</tbody></table></div></div> : <div className="rounded-lg bg-white p-8 text-center shadow-sm"><h3 className="text-xl font-bold text-green-950">{emptyTitle}</h3><p className="mt-2 text-sm text-stone-600">{emptyBody}</p><button type="button" onClick={openCreate} className="mt-4 rounded-full bg-green-800 px-5 py-2 text-sm font-bold text-white">{createLabel}</button></div>}
    </div>
  );
}

function FieldInput({ field, value, onChange }: { field: Field; value: unknown; onChange: (value: string | boolean) => void }) {
  if (field.type === "checkbox") return <label className="flex items-center gap-3 text-sm font-semibold text-stone-800"><input name={field.name} type="checkbox" checked={value === true} onChange={(event) => onChange(event.target.checked)} />{field.label}</label>;
  const common = "rounded-lg border border-stone-200 px-4 text-sm focus:border-green-700 focus:outline-none focus:ring-2 focus:ring-green-700/20";
  return <label className="grid gap-2 text-sm font-semibold text-stone-800">{field.label}{field.required ? <span className="sr-only">required</span> : null}{field.type === "textarea" ? <textarea name={field.name} value={stringValue(value)} onChange={(event) => onChange(event.target.value)} rows={4} required={field.required} className={`${common} py-3`} /> : field.type === "select" ? <select name={field.name} value={stringValue(value)} onChange={(event) => onChange(event.target.value)} required={field.required} className={`h-11 ${common}`}>{field.options?.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select> : <input name={field.name} type={field.type ?? "text"} value={stringValue(value)} onChange={(event) => onChange(event.target.value)} required={field.required} className={`h-11 ${common}`} />}{field.help ? <span className="text-xs font-normal leading-5 text-stone-500">{field.help}</span> : null}</label>;
}

export function countOf(record: AdminRecord, key: string) {
  return relationCount(record[key]);
}
