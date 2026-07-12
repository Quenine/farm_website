"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";

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
    startTransition(() => router.push(nextUrl));
  };

  const clear = () => {
    setValues(defaultValues);
    startTransition(() => router.push(pathname));
  };

  return (
    <>
      <form onSubmit={submit} className="mt-6 grid gap-3 rounded-lg border border-green-900/10 bg-white p-4 shadow-sm lg:grid-cols-6">
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
