/* eslint-disable @next/next/no-img-element */
"use client";

import { useRef, useState, useTransition } from "react";
import {
  deactivateProductAction,
  deleteProductMediaAction,
  moveProductMediaAction,
  saveProductAction,
  setPrimaryProductMediaAction,
  updateProductMediaMetaAction,
  uploadProductMediaAction,
} from "@/app/admin/(protected)/products/actions";
import { AdminHeader, AdminTable } from "@/src/components/admin";
import { formatNaira } from "@/src/lib/format";
import { productPriceLabel } from "@/src/lib/product-pricing";
import type { Product, ProductMedia } from "@/src/types";

const emptyProduct: Product = {
  slug: "",
  name: "",
  price: 0,
  unit: "kg",
  stock: "0 kg available",
  stockCount: 0,
  minimumOrder: 1,
  minimumUnit: "kg",
  category: "Broilers",
  availability: "Available now",
  description: "",
  badge: "Noble Farms supply",
  status: "active",
  availableFrom: null,
  isFeatured: false,
  featuredSortOrder: 100,
  supportsWiderDelivery: false,
  isLiveAnimal: false,
  isProcessed: false,
  pricingMode: "fixed",
  isOrderableOnline: true,
  displayPriceLabel: null,
  media: [],
  primaryMedia: null,
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
    setForm({ ...emptyProduct });
    setEditing(emptyProduct);
  };

  const openEdit = (product: Product) => {
    setMessage(null);
    setForm({
      ...product,
      pricingMode: product.pricingMode ?? "fixed",
      isOrderableOnline: product.isOrderableOnline ?? true,
      displayPriceLabel: product.displayPriceLabel ?? null,
      featuredSortOrder: product.featuredSortOrder ?? 100,
      supportsWiderDelivery: product.supportsWiderDelivery ?? product.category === "Crop Produce",
      media: product.media ?? [],
      primaryMedia: product.primaryMedia ?? null,
    });
    setEditing(product);
  };

  const updateMedia = (media: ProductMedia[]) => {
    const primaryMedia =
      media.find((item) => item.mediaType === "image" && item.isPrimary) ??
      media.find((item) => item.mediaType === "image") ??
      media[0] ??
      null;
    setForm((current) => ({ ...current, media, primaryMedia }));
    setItems((current) =>
      current.map((item) =>
        item.id === form.id ? { ...item, media, primaryMedia } : item,
      ),
    );
  };

  const normalizedProduct = () => {
    const slug =
      form.slug ||
      form.name
        .toLowerCase()
        .trim()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/(^-|-$)/g, "");
    const pricingMode = form.pricingMode ?? "fixed";
    const isQuoteRequired = pricingMode === "quote_required";
    return {
      ...form,
      slug,
      pricingMode,
      isOrderableOnline: isQuoteRequired
        ? false
        : form.isOrderableOnline ?? true,
      displayPriceLabel: isQuoteRequired
        ? form.displayPriceLabel?.trim() || "Check Availability"
        : form.displayPriceLabel?.trim() || null,
      featuredSortOrder: form.featuredSortOrder ?? 100,
      stock: isQuoteRequired
        ? "Availability depends on quantity, season, and logistics"
        : `${form.stockCount} ${form.unit} available`,
      availability:
        form.status === "inactive"
          ? "Inactive"
          : form.status === "coming_soon"
            ? "Coming soon"
            : isQuoteRequired
              ? "Available by confirmed supply"
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
        ? "Saved in local preview mode."
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
        featuredSortOrder: saved.featuredSortOrder ?? 100,
        supportsWiderDelivery: saved.supportsWiderDelivery ?? false,
        isLiveAnimal: saved.isLiveAnimal ?? false,
        isProcessed: saved.isProcessed ?? false,
        pricingMode: saved.pricingMode ?? "fixed",
        isOrderableOnline: saved.isOrderableOnline ?? true,
        displayPriceLabel: saved.displayPriceLabel ?? null,
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
      setMessage("Product deactivated in local preview mode.");
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
        body="Manage public catalogue entries, pricing, media, units, and minimum order rules."
      />
      {usingFallback ? (
        <div className="mb-4 rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
          Supabase is not configured, so this page is using local preview
          records. Configure Supabase to persist product changes.
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
          "Featured",
          "Status",
          "Actions",
        ]}
        rows={items.map((product) => [
          <span key="name" className="font-bold text-green-950">
            {product.name}
          </span>,
          product.category,
          productPriceLabel(product) ?? `${formatNaira(product.price)} / ${product.unit}`,
          product.stock,
          product.isFeatured ? `Yes (${product.featuredSortOrder ?? 100})` : "No",
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
            className="grid max-h-[90vh] w-full max-w-3xl gap-4 overflow-y-auto rounded-lg bg-white p-6 shadow-xl"
          >
            <div>
              <h2 className="text-xl font-bold text-green-950">
                {editing.slug ? "Edit product" : "Create product"}
              </h2>
              <p className="mt-1 text-sm text-stone-600">
                Manage product details, media, pricing, availability, and fulfilment notes.
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
                Pricing mode
                <select
                  value={form.pricingMode ?? "fixed"}
                  onChange={(event) => {
                    const pricingMode = event.target.value as Product["pricingMode"];
                    const isQuoteRequired = pricingMode === "quote_required";
                    setForm({
                      ...form,
                      pricingMode,
                      isOrderableOnline: isQuoteRequired
                        ? false
                        : form.isOrderableOnline ?? true,
                      displayPriceLabel: isQuoteRequired
                        ? form.displayPriceLabel || "Check Availability"
                        : form.displayPriceLabel,
                    });
                  }}
                  className="h-11 rounded-lg border border-stone-200 bg-white px-4 font-normal"
                >
                  <option value="fixed">Fixed price</option>
                  <option value="quote_required">Quote required</option>
                </select>
              </label>
              <label className="grid gap-2 text-sm font-semibold text-stone-800">
                Orderable online
                <select
                  value={form.pricingMode === "quote_required" ? "false" : String(form.isOrderableOnline ?? true)}
                  disabled={form.pricingMode === "quote_required"}
                  onChange={(event) =>
                    setForm({
                      ...form,
                      isOrderableOnline: event.target.value === "true",
                    })
                  }
                  className="h-11 rounded-lg border border-stone-200 bg-white px-4 font-normal disabled:bg-stone-100"
                >
                  <option value="true">Yes</option>
                  <option value="false">No</option>
                </select>
              </label>
              <ProductInput
                label="Display price label"
                required={false}
                value={form.displayPriceLabel ?? ""}
                onChange={(displayPriceLabel) =>
                  setForm({ ...form, displayPriceLabel })
                }
              />
              <ProductInput
                label="Featured sort order"
                type="number"
                min={0}
                value={form.featuredSortOrder ?? 100}
                onChange={(featuredSortOrder) =>
                  setForm({ ...form, featuredSortOrder: Number(featuredSortOrder) })
                }
              />
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
            <div className="grid gap-3 sm:grid-cols-4">
              <ProductCheckbox label="Featured" checked={form.isFeatured ?? false} onChange={(isFeatured) => setForm({ ...form, isFeatured })} />
              <ProductCheckbox label="Wider delivery" checked={form.supportsWiderDelivery ?? false} onChange={(supportsWiderDelivery) => setForm({ ...form, supportsWiderDelivery })} />
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
            <ProductMediaManager
              product={form}
              disabled={usingFallback || !form.id}
              onMediaChange={updateMedia}
            />
            <div className="flex justify-end gap-3">
              <button type="button" disabled={isPending} onClick={() => setEditing(null)} className="h-11 rounded-full border border-stone-300 px-5 text-sm font-bold">
                Cancel
              </button>
              <button type="submit" disabled={isPending} className="h-11 rounded-full bg-green-800 px-5 text-sm font-bold text-white disabled:opacity-60">
                {isPending ? "Saving..." : "Save product"}
              </button>
            </div>
          </form>
        </div>
      ) : null}
    </>
  );
}

function ProductMediaManager({
  product,
  disabled,
  onMediaChange,
}: {
  product: Product;
  disabled: boolean;
  onMediaChange: (media: ProductMedia[]) => void;
}) {
  const imageInputRef = useRef<HTMLInputElement>(null);
  const videoInputRef = useRef<HTMLInputElement>(null);
  const [isPending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);
  const media = product.media ?? [];

  const runAction = (action: () => Promise<{ success: true; media: ProductMedia[] } | { success: false; message: string }>) => {
    setMessage(null);
    startTransition(async () => {
      const result = await action();
      if (!result.success) {
        setMessage(result.message);
        return;
      }
      onMediaChange(result.media);
      setMessage("Media updated.");
    });
  };

  const upload = (files: FileList | null, mediaType: "image" | "video") => {
    if (!product.id || !files?.length) return;
    const formData = new FormData();
    Array.from(files).forEach((file) => formData.append("files", file));
    runAction(() => uploadProductMediaAction(product.id as string, mediaType, formData));
  };

  return (
    <section className="rounded-lg border border-green-900/10 bg-green-50 p-4">
      <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
        <div>
          <h3 className="text-lg font-bold text-green-950">Media</h3>
          <p className="mt-1 text-sm text-green-900">
            Upload product images and optional videos up to 5MB each. Public cards use the primary image.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <input
            ref={imageInputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            multiple
            hidden
            onChange={(event) => upload(event.target.files, "image")}
          />
          <input
            ref={videoInputRef}
            type="file"
            accept="video/mp4,video/webm"
            hidden
            onChange={(event) => upload(event.target.files, "video")}
          />
          <button
            type="button"
            disabled={disabled || isPending}
            onClick={() => imageInputRef.current?.click()}
            className="h-10 rounded-full bg-green-800 px-4 text-xs font-bold text-white disabled:cursor-not-allowed disabled:opacity-50"
          >
            Upload Images
          </button>
          <button
            type="button"
            disabled={disabled || isPending}
            onClick={() => videoInputRef.current?.click()}
            className="h-10 rounded-full border border-green-800 px-4 text-xs font-bold text-green-950 disabled:cursor-not-allowed disabled:opacity-50"
          >
            Upload Video
          </button>
        </div>
      </div>
      {disabled ? (
        <p className="mt-3 rounded-lg bg-amber-50 p-3 text-sm font-semibold text-amber-900">
          Save the product first, then reopen it to upload and manage media.
        </p>
      ) : null}
      {message ? <p className="mt-3 text-sm font-semibold text-green-900">{message}</p> : null}
      {media.length === 0 ? (
        <div className="mt-4 rounded-lg bg-white p-4 text-sm text-stone-600">
          No media yet. Product cards will use the branded Noble Farms placeholder.
        </div>
      ) : (
        <div className="mt-4 grid gap-4 md:grid-cols-2">
          {media.map((item, index) => (
            <div key={item.id} className="rounded-lg bg-white p-3 shadow-sm">
              <div className="aspect-video overflow-hidden rounded-lg bg-stone-100">
                {item.mediaType === "image" ? (
                  <img
                    src={item.url}
                    alt={item.altText || product.name}
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <video src={item.url} controls className="h-full w-full object-cover" />
                )}
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                <span className="rounded-full bg-stone-100 px-2 py-1 text-xs font-bold text-stone-700">
                  {item.mediaType === "image" ? "Image" : "Video"}
                </span>
                {item.isPrimary ? (
                  <span className="rounded-full bg-lime-100 px-2 py-1 text-xs font-bold text-green-800">
                    Primary
                  </span>
                ) : null}
              </div>
              <div className="mt-3 grid gap-2">
                <ProductInput
                  label="Alt text"
                  required={false}
                  value={item.altText ?? ""}
                  onChange={(altText) =>
                    runAction(() =>
                      updateProductMediaMetaAction({
                        mediaId: item.id,
                        altText,
                        caption: item.caption ?? null,
                      }),
                    )
                  }
                />
                <ProductInput
                  label="Caption"
                  required={false}
                  value={item.caption ?? ""}
                  onChange={(caption) =>
                    runAction(() =>
                      updateProductMediaMetaAction({
                        mediaId: item.id,
                        altText: item.altText ?? null,
                        caption,
                      }),
                    )
                  }
                />
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                <MediaButton disabled={isPending || item.mediaType !== "image"} onClick={() => runAction(() => setPrimaryProductMediaAction(item.id))}>
                  Set Primary
                </MediaButton>
                <MediaButton disabled={isPending || index === 0} onClick={() => runAction(() => moveProductMediaAction(item.id, "up"))}>
                  Move Up
                </MediaButton>
                <MediaButton disabled={isPending || index === media.length - 1} onClick={() => runAction(() => moveProductMediaAction(item.id, "down"))}>
                  Move Down
                </MediaButton>
                <MediaButton danger disabled={isPending} onClick={() => runAction(() => deleteProductMediaAction(item.id))}>
                  Delete
                </MediaButton>
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

function MediaButton({
  children,
  disabled,
  danger = false,
  onClick,
}: {
  children: React.ReactNode;
  disabled?: boolean;
  danger?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={`h-9 rounded-full px-3 text-xs font-bold disabled:cursor-not-allowed disabled:opacity-50 ${
        danger ? "bg-red-50 text-red-700" : "bg-green-50 text-green-800"
      }`}
    >
      {children}
    </button>
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
