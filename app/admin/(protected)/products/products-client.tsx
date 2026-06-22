"use client";

import { useState, useTransition } from "react";
import {
  deactivateProductAction,
  saveProductAction,
} from "@/app/admin/(protected)/products/actions";
import { AdminHeader, AdminTable } from "@/src/components/admin";
import { formatNaira } from "@/src/lib/format";
import type { Product } from "@/src/types";

const emptyProduct: Product = {
  slug: "",
  name: "",
  price: 0,
  unit: "kg",
  stock: "0 kg available",
  stockCount: 0,
  minimumOrder: 1,
  minimumUnit: "kg",
  category: "Live Chickens",
  availability: "Available now",
  description: "",
  badge: "Farm produce",
  status: "active",
  availableFrom: null,
  isFeatured: false,
  isLiveAnimal: false,
  isProcessed: false,
};

export function AdminProductsClient({
  initialProducts,
  usingFallback,
}: {
  initialProducts: Product[];
  usingFallback: boolean;
}) {
  const [items, setItems] = useState(initialProducts);
  const [editing, setEditing] = useState<Product | null>(null);
  const [form, setForm] = useState<Product>(emptyProduct);
  const [message, setMessage] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const openCreate = () => {
    setMessage(null);
    setForm(emptyProduct);
    setEditing(emptyProduct);
  };

  const openEdit = (product: Product) => {
    setMessage(null);
    setForm(product);
    setEditing(product);
  };

  const normalizedProduct = () => {
    const slug =
      form.slug ||
      form.name
        .toLowerCase()
        .trim()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/(^-|-$)/g, "");
    return {
      ...form,
      slug,
      stock: `${form.stockCount} ${form.unit} available`,
      availability:
        form.status === "inactive"
          ? "Inactive"
          : form.status === "coming_soon"
            ? "Coming soon"
            : "Available now",
    };
  };

  const saveLocally = (saved: Product) => {
    setItems((current) =>
      editing?.slug
        ? current.map((item) => (item.slug === editing.slug ? saved : item))
        : [saved, ...current],
    );
    setEditing(null);
    setMessage(
      usingFallback
        ? "Saved in local development fallback mode."
        : "Product saved successfully.",
    );
  };

  const saveProduct = (event: React.FormEvent) => {
    event.preventDefault();
    setMessage(null);
    const saved = normalizedProduct();

    if (usingFallback) {
      saveLocally(saved);
      return;
    }

    startTransition(async () => {
      const result = await saveProductAction({
        id: saved.id,
        name: saved.name,
        slug: saved.slug,
        description: saved.description,
        category: saved.category,
        price: saved.price,
        unit: saved.unit,
        stockCount: saved.stockCount,
        minimumOrder: saved.minimumOrder,
        status: saved.status ?? "active",
        availableFrom: saved.availableFrom,
        isFeatured: saved.isFeatured ?? false,
        isLiveAnimal: saved.isLiveAnimal ?? false,
        isProcessed: saved.isProcessed ?? false,
      });

      if (!result.success) {
        setMessage(result.message);
        return;
      }
      saveLocally(result.product);
    });
  };

  const deactivate = (product: Product) => {
    setMessage(null);
    if (usingFallback || !product.id) {
      setItems((current) =>
        current.map((item) =>
          item.slug === product.slug
            ? { ...item, status: "inactive", availability: "Inactive" }
            : item,
        ),
      );
      setMessage("Product deactivated in local development fallback mode.");
      return;
    }

    startTransition(async () => {
      const result = await deactivateProductAction(product.id as string);
      if (!result.success) {
        setMessage(result.message);
        return;
      }
      setItems((current) =>
        current.map((item) =>
          item.id === result.product.id ? result.product : item,
        ),
      );
      setMessage("Product deactivated successfully.");
    });
  };

  return (
    <>
      <AdminHeader
        title="Products management"
        body="Manage public catalogue entries, pricing, units, and minimum order rules."
      />
      {usingFallback ? (
        <div className="mb-4 rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
          Supabase is not configured, so this page is using the development-only
          mock fallback. Configure Supabase to persist product changes.
        </div>
      ) : null}
      {message ? (
        <div className="mb-4 rounded-lg border border-green-200 bg-green-50 p-4 text-sm font-semibold text-green-800">
          {message}
        </div>
      ) : null}
      <div className="mb-4 flex justify-end">
        <button
          type="button"
          onClick={openCreate}
          className="h-11 rounded-full bg-green-800 px-5 text-sm font-bold text-white"
        >
          Create Product
        </button>
      </div>
      <AdminTable
        headers={[
          "Product",
          "Category",
          "Price",
          "Stock",
          "Minimum order",
          "Status",
          "Actions",
        ]}
        rows={items.map((product) => [
          <span key="name" className="font-bold text-green-950">
            {product.name}
          </span>,
          product.category,
          `${formatNaira(product.price)} / ${product.unit}`,
          product.stock,
          `${product.minimumOrder} ${product.minimumUnit}`,
          product.availability,
          <div key="actions" className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => openEdit(product)}
              className="h-9 rounded-full bg-green-50 px-3 text-xs font-bold text-green-800"
            >
              Edit
            </button>
            <button
              type="button"
              disabled={isPending || product.status === "inactive"}
              onClick={() => deactivate(product)}
              className="h-9 rounded-full bg-amber-50 px-3 text-xs font-bold text-amber-800 disabled:cursor-not-allowed disabled:opacity-50"
            >
              Deactivate
            </button>
          </div>,
        ])}
      />
      {editing ? (
        <div className="fixed inset-0 z-50 grid place-items-center bg-green-950/50 p-4">
          <form
            onSubmit={saveProduct}
            className="grid max-h-[90vh] w-full max-w-2xl gap-4 overflow-y-auto rounded-lg bg-white p-6 shadow-xl"
          >
            <div>
              <h2 className="text-xl font-bold text-green-950">
                {editing.slug ? "Edit product" : "Create product"}
              </h2>
              <p className="mt-1 text-sm text-stone-600">
                Image upload remains a placeholder for this step.
              </p>
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              <ProductInput label="Product name" value={form.name} onChange={(name) => setForm({ ...form, name })} />
              <ProductInput label="Category" value={form.category} onChange={(category) => setForm({ ...form, category })} />
              <ProductInput label="Price" type="number" min={0} value={form.price} onChange={(price) => setForm({ ...form, price: Number(price) })} />
              <ProductInput label="Unit" value={form.unit} onChange={(unit) => setForm({ ...form, unit })} />
              <ProductInput label="Stock count" type="number" min={0} value={form.stockCount} onChange={(stockCount) => setForm({ ...form, stockCount: Number(stockCount) })} />
              <ProductInput label="Minimum order" type="number" min={0.01} value={form.minimumOrder} onChange={(minimumOrder) => setForm({ ...form, minimumOrder: Number(minimumOrder) })} />
              <label className="grid gap-2 text-sm font-semibold text-stone-800">
                Status
                <select
                  value={form.status ?? "active"}
                  onChange={(event) =>
                    setForm({
                      ...form,
                      status: event.target.value as Product["status"],
                    })
                  }
                  className="h-11 rounded-lg border border-stone-200 bg-white px-4 font-normal"
                >
                  <option value="active">Active</option>
                  <option value="inactive">Inactive</option>
                  <option value="coming_soon">Coming soon</option>
                </select>
              </label>
              <ProductInput
                label="Available from"
                type="date"
                required={form.status === "coming_soon"}
                value={form.availableFrom ?? ""}
                onChange={(availableFrom) =>
                  setForm({ ...form, availableFrom: availableFrom || null })
                }
              />
            </div>
            <div className="grid gap-3 sm:grid-cols-3">
              <ProductCheckbox label="Featured" checked={form.isFeatured ?? false} onChange={(isFeatured) => setForm({ ...form, isFeatured })} />
              <ProductCheckbox label="Live animal" checked={form.isLiveAnimal ?? false} onChange={(isLiveAnimal) => setForm({ ...form, isLiveAnimal })} />
              <ProductCheckbox label="Processed" checked={form.isProcessed ?? false} onChange={(isProcessed) => setForm({ ...form, isProcessed })} />
            </div>
            <label className="grid gap-2 text-sm font-semibold text-stone-800">
              Description
              <textarea
                required
                rows={3}
                value={form.description}
                onChange={(event) =>
                  setForm({ ...form, description: event.target.value })
                }
                className="rounded-lg border border-stone-200 px-4 py-3 font-normal"
              />
            </label>
            <div className="flex justify-end gap-3">
              <button type="button" disabled={isPending} onClick={() => setEditing(null)} className="h-11 rounded-full border border-stone-300 px-5 text-sm font-bold">
                Cancel
              </button>
              <button type="submit" disabled={isPending} className="h-11 rounded-full bg-green-800 px-5 text-sm font-bold text-white disabled:opacity-60">
                {isPending ? "Saving…" : "Save product"}
              </button>
            </div>
          </form>
        </div>
      ) : null}
    </>
  );
}

function ProductInput({
  label,
  value,
  onChange,
  type = "text",
  min,
  required = true,
}: {
  label: string;
  value: string | number;
  onChange: (value: string) => void;
  type?: string;
  min?: number;
  required?: boolean;
}) {
  return (
    <label className="grid gap-2 text-sm font-semibold text-stone-800">
      {label}
      <input
        required={required}
        type={type}
        min={min}
        step={type === "number" ? "any" : undefined}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="h-11 rounded-lg border border-stone-200 px-4 font-normal"
      />
    </label>
  );
}

function ProductCheckbox({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
}) {
  return (
    <label className="flex items-center gap-3 rounded-lg border border-stone-200 p-3 text-sm font-semibold">
      <input
        type="checkbox"
        checked={checked}
        onChange={(event) => onChange(event.target.checked)}
        className="size-4"
      />
      {label}
    </label>
  );
}
