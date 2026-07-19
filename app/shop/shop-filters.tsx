"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { X } from "lucide-react";
import { usePathname, useRouter } from "next/navigation";
import { trackSafeEvent, trackSearch } from "@/src/lib/analytics";

type SortOption = "price-asc" | "featured" | "newest" | "price-desc" | "name-asc";

type ShopFilterValues = {
  search: string;
  category: string;
  availability: string;
  unit: string;
  sort: SortOption;
  minPrice: string;
  maxPrice: string;
};

type ShopFiltersProps = {
  categories: Array<[string, string]>;
  units: string[];
  totalCount: number;
  shownCount: number;
  initialValues: ShopFilterValues;
};

const availabilityOptions = [
  { value: "all", label: "All availability" },
  { value: "in-stock", label: "In stock" },
  { value: "out-of-stock", label: "Out of stock" },
  { value: "orderable", label: "Orderable online" },
  { value: "quote", label: "Check availability" },
];

const sortOptions: Array<{ value: SortOption; label: string }> = [
  { value: "price-asc", label: "Price: Low to High" },
  { value: "featured", label: "Featured" },
  { value: "newest", label: "Newest" },
  { value: "price-desc", label: "Price: High to Low" },
  { value: "name-asc", label: "Name: A to Z" },
];

const defaultValues: ShopFilterValues = {
  search: "",
  category: "",
  availability: "all",
  unit: "",
  sort: "price-asc",
  minPrice: "",
  maxPrice: "",
};

export function ShopFilters({ categories, units, totalCount, shownCount, initialValues }: ShopFiltersProps) {
  const router = useRouter();
  const pathname = usePathname();
  const [isPending, startTransition] = useTransition();
  const [values, setValues] = useState<ShopFilterValues>(initialValues);
  const [open, setOpen] = useState(false);
  const opener = useRef<HTMLButtonElement>(null);
  const sheet = useRef<HTMLDivElement>(null);
  const searchInput = useRef<HTMLInputElement>(null);

  const update = (key: keyof ShopFilterValues, value: string) => {
    setValues((current) => ({ ...current, [key]: value }));
  };

  const submit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const params = new URLSearchParams();
    if (values.search.trim()) params.set("search", values.search.trim());
    if (values.category) params.set("category", values.category);
    if (values.availability !== "all") params.set("availability", values.availability);
    if (values.unit) params.set("unit", values.unit);
    if (values.sort !== "price-asc") params.set("sort", values.sort);
    if (values.minPrice) params.set("minPrice", values.minPrice);
    if (values.maxPrice) params.set("maxPrice", values.maxPrice);
    const nextUrl = params.toString() ? `${pathname}?${params.toString()}` : pathname;
    trackSearch(values.search);
    trackSafeEvent("filter_products", { filter_count: params.size, sort: values.sort });
    startTransition(() => router.push(nextUrl));
  };

  const clear = () => {
    setValues(defaultValues);
    setOpen(false);
    startTransition(() => router.push("/shop"));
    requestAnimationFrame(() => searchInput.current?.focus());
  };
  useEffect(()=>{if(!open)return;const previous=document.body.style.overflow;document.body.style.overflow="hidden";const first=sheet.current?.querySelector<HTMLElement>("select,input,button");first?.focus();const key=(event:KeyboardEvent)=>{if(event.key==="Escape"){setOpen(false);opener.current?.focus();}if(event.key==="Tab"&&sheet.current){const nodes=[...sheet.current.querySelectorAll<HTMLElement>("button,input,select")].filter((node)=>!node.hasAttribute("disabled"));if(!nodes.length)return;const firstNode=nodes[0],last=nodes[nodes.length-1];if(event.shiftKey&&document.activeElement===firstNode){event.preventDefault();last.focus();}else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();firstNode.focus();}}};window.addEventListener("keydown",key);return()=>{document.body.style.overflow=previous;window.removeEventListener("keydown",key)}},[open]);
  const active=[values.category,values.availability!=="all"?values.availability:"",values.unit,values.minPrice?`Min ₦${values.minPrice}`:"",values.maxPrice?`Max ₦${values.maxPrice}`:""].filter(Boolean);

  return (
    <>
      <form onSubmit={submit} className="mt-6 flex gap-2 lg:hidden"><label className="sr-only" htmlFor="mobile-shop-search">Search products</label><div className="relative min-w-0 flex-1"><input ref={searchInput} id="mobile-shop-search" value={values.search} onChange={(event)=>update("search",event.target.value)} placeholder="Search products" className="h-12 w-full rounded-full border bg-white px-4 pr-12"/>{values.search?<button type="button" onClick={clear} aria-label="Clear search and filters" className="absolute right-1 top-1 grid size-10 place-items-center rounded-full text-stone-600 hover:bg-stone-100"><X size={18}/></button>:null}</div><button className="rounded-full bg-green-800 px-4 text-sm font-bold text-white">Search</button></form>
      <div className="mt-3 flex gap-2 lg:hidden"><button ref={opener} type="button" onClick={()=>setOpen(true)} className="h-11 flex-1 rounded-full border border-green-800 font-bold text-green-950">Filters{active.length?` (${active.length})`:""}</button><button type="button" onClick={()=>setOpen(true)} className="h-11 flex-1 rounded-full border border-green-800 font-bold text-green-950">Sort</button></div>
      {active.length?<div className="mt-3 flex flex-wrap gap-2 lg:hidden">{active.map((value)=><span key={value} className="rounded-full bg-green-100 px-3 py-1 text-xs font-bold text-green-900">{value}</span>)}<button type="button" onClick={clear} className="text-xs font-bold text-red-700 underline">Clear all</button></div>:null}
      <form onSubmit={submit} className="mt-6 hidden gap-3 rounded-lg border border-green-900/10 bg-white p-4 shadow-sm lg:grid lg:grid-cols-6">
        <label className="grid gap-2 text-sm font-semibold text-stone-800 lg:col-span-2">
          Search
          <input value={values.search} onChange={(event) => update("search", event.target.value)} placeholder="Search carrots, eggs, kg, crop produce" className="h-11 rounded-lg border border-stone-200 px-3 font-normal" />
        </label>
        <FilterSelect label="Category" value={values.category} onChange={(value) => update("category", value)}>
          <option value="">All categories</option>
          {categories.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
        </FilterSelect>
        <FilterSelect label="Availability" value={values.availability} onChange={(value) => update("availability", value)}>
          {availabilityOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
        </FilterSelect>
        <FilterSelect label="Unit/package" value={values.unit} onChange={(value) => update("unit", value)}>
          <option value="">All units</option>
          {units.map((item) => <option key={item} value={item}>{item}</option>)}
        </FilterSelect>
        <FilterSelect label="Sort" value={values.sort} onChange={(value) => update("sort", value as SortOption)}>
          {sortOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
        </FilterSelect>
        <label className="grid gap-2 text-sm font-semibold text-stone-800">
          Min price
          <input value={values.minPrice} onChange={(event) => update("minPrice", event.target.value)} name="minPrice" type="number" min={0} placeholder="0" className="h-11 rounded-lg border border-stone-200 px-3 font-normal" />
        </label>
        <label className="grid gap-2 text-sm font-semibold text-stone-800">
          Max price
          <input value={values.maxPrice} onChange={(event) => update("maxPrice", event.target.value)} name="maxPrice" type="number" min={0} placeholder="100000" className="h-11 rounded-lg border border-stone-200 px-3 font-normal" />
        </label>
        <div className="flex items-end gap-2 lg:col-span-4 lg:justify-end">
          <button type="submit" disabled={isPending} className="h-11 rounded-full bg-green-800 px-5 text-sm font-bold text-white disabled:opacity-60">Apply filters</button>
          <button type="button" disabled={isPending} onClick={clear} className="inline-flex h-11 items-center rounded-full border border-green-800 px-5 text-sm font-bold text-green-900 disabled:opacity-60">Clear filters</button>
        </div>
      </form>
      {open?<div className="fixed inset-0 z-50 bg-black/40 lg:hidden" onMouseDown={(event)=>{if(event.target===event.currentTarget){setOpen(false);opener.current?.focus();}}}><div ref={sheet} role="dialog" aria-modal="true" aria-label="Product filters" className="absolute inset-x-0 bottom-0 max-h-[88vh] overflow-y-auto rounded-t-2xl bg-white p-5"><div className="flex items-center justify-between"><h2 className="text-xl font-bold text-green-950">Filter and sort</h2><button type="button" onClick={()=>{setOpen(false);opener.current?.focus()}} className="rounded-full border px-3 py-2 font-bold">Cancel</button></div><div className="mt-5 grid gap-4"><FilterSelect label="Category" value={values.category} onChange={(value)=>update("category",value)}><option value="">All categories</option>{categories.map(([value,label])=><option key={value} value={value}>{label}</option>)}</FilterSelect><FilterSelect label="Availability" value={values.availability} onChange={(value)=>update("availability",value)}>{availabilityOptions.map((option)=><option key={option.value} value={option.value}>{option.label}</option>)}</FilterSelect><FilterSelect label="Unit/package" value={values.unit} onChange={(value)=>update("unit",value)}><option value="">All units</option>{units.map((item)=><option key={item}>{item}</option>)}</FilterSelect><FilterSelect label="Sort" value={values.sort} onChange={(value)=>update("sort",value as SortOption)}>{sortOptions.map((option)=><option key={option.value} value={option.value}>{option.label}</option>)}</FilterSelect><div className="grid grid-cols-2 gap-3"><label className="grid gap-2 text-sm font-semibold">Min price<input value={values.minPrice} onChange={(e)=>update("minPrice",e.target.value)} type="number" min="0" className="h-11 rounded-lg border px-3"/></label><label className="grid gap-2 text-sm font-semibold">Max price<input value={values.maxPrice} onChange={(e)=>update("maxPrice",e.target.value)} type="number" min="0" className="h-11 rounded-lg border px-3"/></label></div><div className="sticky bottom-0 flex gap-2 bg-white py-3"><button type="button" onClick={()=>setValues(defaultValues)} className="h-12 flex-1 rounded-full border font-bold">Reset</button><button type="button" onClick={()=>{const fake={preventDefault(){}} as React.FormEvent<HTMLFormElement>;submit(fake);setOpen(false);opener.current?.focus()}} className="h-12 flex-1 rounded-full bg-green-800 font-bold text-white">Apply</button></div></div></div></div>:null}
      <div className="mt-5 flex flex-wrap items-center justify-between gap-3 text-sm text-stone-600">
        <p><strong className="text-green-950">{shownCount}</strong> of {totalCount} products shown</p>
        <p><Link href="/contact" className="font-bold text-green-800">Need help finding a product?</Link></p>
      </div>
    </>
  );
}

function FilterSelect({ label, value, onChange, children }: { label: string; value: string; onChange: (value: string) => void; children: React.ReactNode }) {
  return (
    <label className="grid gap-2 text-sm font-semibold text-stone-800">
      {label}
      <select value={value} onChange={(event) => onChange(event.target.value)} className="h-11 rounded-lg border border-stone-200 bg-white px-3 font-normal">
        {children}
      </select>
    </label>
  );
}
