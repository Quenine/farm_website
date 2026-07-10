"use client";

import Link from "next/link";
import { useMemo, useState, useTransition } from "react";
import { saveProductDeliveryRateAction } from "@/app/admin/(protected)/delivery-rates/actions";
import { AdminHeader, AdminTable, StatusBadge } from "@/src/components/admin";
import {
  findMatchingProductDeliveryRate,
  formatDeliveryMethod,
  supportsDeliveryMethod,
  type DeliveryProductForCalculation,
  type MatchingRateSource,
} from "@/src/lib/delivery-calculator";
import { formatNaira } from "@/src/lib/format";
import { getNigeriaCities, mergeUniqueSorted, nigeriaStateNames } from "@/src/lib/nigeria-locations";
import type { DeliveryMethod, Product, ProductDeliveryRate } from "@/src/types";

const emptyRate = (product?: Product): ProductDeliveryRate => ({
  productId: product?.id ?? "",
  productName: product?.name,
  productSlug: product?.slug,
  state: "Oyo",
  city: "Ibadan",
  deliveryMethod: "home_delivery",
  packageSize: 1,
  firstPackageFee: 0,
  extraPackageFee: 0,
  estimatedDeliveryTime: "",
  isActive: true,
  sortOrder: 100,
});

type ProductWithId = Product & { id: string };

type FilterState = {
  productId: string;
  state: string;
  city: string;
  deliveryMethod: "all" | DeliveryMethod;
};

type CoverageFilter = {
  state: string;
  city: string;
  deliveryMethod: DeliveryMethod;
};

export function AdminProductDeliveryRatesClient({
  initialRates,
  products,
  initialProductId,
}: {
  initialRates: ProductDeliveryRate[];
  products: Product[];
  initialProductId?: string;
}) {
  const selectableProducts = useMemo(
    () => products.filter((product): product is ProductWithId => Boolean(product.id)),
    [products],
  );
  const defaultProductFilter = initialProductId && selectableProducts.some((product) => product.id === initialProductId)
    ? initialProductId
    : "all";

  const [rates, setRates] = useState(initialRates);
  const [editing, setEditing] = useState<ProductDeliveryRate | null>(null);
  const [form, setForm] = useState<ProductDeliveryRate>(emptyRate(selectableProducts[0]));
  const [filters, setFilters] = useState<FilterState>({
    productId: defaultProductFilter,
    state: "all",
    city: "all",
    deliveryMethod: "all",
  });
  const [coverageFilter, setCoverageFilter] = useState<CoverageFilter>({
    state: "Lagos",
    city: "Lagos Mainland",
    deliveryMethod: "home_delivery",
  });
  const [message, setMessage] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const productById = useMemo(
    () => new Map(selectableProducts.map((product) => [product.id, product])),
    [selectableProducts],
  );
  const states = mergeUniqueSorted([...nigeriaStateNames, ...rates.map((rate) => rate.state)]);
  const filterCities = filters.state === "all"
    ? mergeUniqueSorted([...nigeriaLocationsCityNames(), ...rates.map((rate) => rate.city)])
    : mergeUniqueSorted([...getNigeriaCities(filters.state), ...rates.filter((rate) => rate.state === filters.state).map((rate) => rate.city)]);
  const coverageCities = mergeUniqueSorted([...getNigeriaCities(coverageFilter.state), ...rates.filter((rate) => rate.state === coverageFilter.state).map((rate) => rate.city)]);
  const formCities = mergeUniqueSorted([...getNigeriaCities(form.state), ...rates.filter((rate) => rate.state === form.state).map((rate) => rate.city)]);

  const filteredRates = rates.filter((rate) => {
    if (filters.productId !== "all" && rate.productId !== filters.productId) return false;
    if (filters.state !== "all" && rate.state !== filters.state) return false;
    if (filters.city !== "all" && rate.city !== filters.city) return false;
    if (filters.deliveryMethod !== "all" && rate.deliveryMethod !== filters.deliveryMethod) return false;
    return true;
  });

  const activeOrderableProducts = selectableProducts.filter(isOrderableProduct);
  const coverageRows = activeOrderableProducts.map((product) => {
    const deliveryProduct = toDeliveryProduct(product);
    const supportsMethod = supportsDeliveryMethod(deliveryProduct, coverageFilter.deliveryMethod);
    const match = supportsMethod
      ? findMatchingProductDeliveryRate({
          rates,
          productId: product.id,
          state: coverageFilter.state,
          city: coverageFilter.city,
          deliveryMethod: coverageFilter.deliveryMethod,
        })
      : { rate: null, source: "missing" as MatchingRateSource };
    const sourceLabel = supportsMethod ? sourceToLabel(match.source) : "Missing";
    const status = !supportsMethod
      ? "Method unsupported"
      : match.rate
        ? "Ready"
        : "Missing rate";

    return { product, supportsMethod, match, sourceLabel, status };
  });

  const selectedProduct = filters.productId === "all" ? null : productById.get(filters.productId) ?? null;
  const selectedProductHasCommonDestinationWarning = selectedProduct
    ? !rates.some(
        (rate) =>
          rate.productId === selectedProduct.id &&
          rate.isActive &&
          rate.deliveryMethod === "home_delivery" &&
          rate.state.trim().toLowerCase() === "lagos" &&
          ["lagos mainland", "all"].includes(rate.city.trim().toLowerCase()),
      )
    : false;

  const openCreate = (preset?: Partial<ProductDeliveryRate>) => {
    setMessage(null);
    const baseProduct = selectableProducts.find((product) => product.id === preset?.productId) ?? selectableProducts[0];
    const next = { ...emptyRate(baseProduct), ...preset, id: undefined };
    setForm(next);
    setEditing(next);
  };

  const openEdit = (rate: ProductDeliveryRate) => {
    setMessage(null);
    setForm({ ...rate });
    setEditing(rate);
  };

  const duplicateRate = (rate: ProductDeliveryRate) => {
    setMessage(null);
    setForm({
      ...rate,
      id: undefined,
      city: rate.city === "All" ? "Lagos Mainland" : rate.city,
      sortOrder: rate.sortOrder + 1,
    });
    setEditing({ ...rate, id: undefined });
  };

  const saveRate = (event: React.FormEvent) => {
    event.preventDefault();
    setMessage(null);
    startTransition(async () => {
      const product = productById.get(form.productId);
      const result = await saveProductDeliveryRateAction(form);
      if (!result.success) {
        setMessage(result.message);
        return;
      }
      const saved = {
        ...result.rate,
        productName: result.rate.productName ?? product?.name,
        productSlug: result.rate.productSlug ?? product?.slug,
      };
      setRates((current) =>
        form.id
          ? current.map((rate) => (rate.id === saved.id ? saved : rate))
          : [saved, ...current],
      );
      setEditing(null);
      setMessage("Product delivery rate saved.");
    });
  };

  return (
    <>
      <AdminHeader
        title="Product Delivery Rates"
        body="Use product delivery rates to set realistic delivery pricing per product and destination."
      />
      {message ? <div className="mb-4 rounded-lg border border-green-200 bg-green-50 p-4 text-sm font-semibold text-green-800">{message}</div> : null}
      <div className="mb-4 rounded-lg border border-green-100 bg-white p-4 text-sm leading-6 text-stone-700 shadow-sm">
        <p className="font-bold text-green-950">Before accepting online orders for a destination, every orderable product must have an active Product Delivery Rate for that destination and delivery method, or an All-city fallback.</p>
        <p>Rates are product-specific. If a cart has three products, all three products need a matching rate before checkout can calculate delivery.</p>
        {filters.productId !== "all" ? (
          <p className="mt-2 rounded-lg bg-amber-50 p-3 text-amber-900">You are viewing rates for this product only. Other cart items also need rates before checkout can calculate delivery.</p>
        ) : null}
      </div>
      <div className="mb-4 grid gap-3 rounded-lg bg-white p-4 shadow-sm lg:grid-cols-5">
        <FilterSelect label="Product" value={filters.productId} onChange={(productId) => setFilters({ ...filters, productId })}>
          <option value="all">All products</option>
          {selectableProducts.map((product) => <option key={product.id} value={product.id}>{product.name}</option>)}
        </FilterSelect>
        <FilterSelect label="State" value={filters.state} onChange={(state) => setFilters({ ...filters, state, city: "all" })}>
          <option value="all">All states</option>
          {states.map((state) => <option key={state} value={state}>{state}</option>)}
        </FilterSelect>
        <FilterSelect label="City" value={filters.city} onChange={(city) => setFilters({ ...filters, city })}>
          <option value="all">All cities</option>
          {filterCities.map((city) => <option key={city} value={city}>{city}</option>)}
        </FilterSelect>
        <FilterSelect label="Method" value={filters.deliveryMethod} onChange={(deliveryMethod) => setFilters({ ...filters, deliveryMethod: deliveryMethod as FilterState["deliveryMethod"] })}>
          <option value="all">All methods</option>
          <option value="home_delivery">Home Delivery</option>
          <option value="pickup_point">Pickup Point</option>
          <option value="farm_pickup">Farm Pickup</option>
        </FilterSelect>
        <div className="flex flex-wrap items-end justify-end gap-2">
          <button type="button" onClick={() => openCreate()} className="h-11 rounded-full bg-green-800 px-5 text-sm font-bold text-white">
            Add Rate
          </button>
          {selectedProduct ? (
            <button type="button" onClick={() => openCreate({ productId: selectedProduct.id, state: "Lagos", city: "All", deliveryMethod: "home_delivery" })} className="h-11 rounded-full border border-green-800 px-4 text-xs font-bold text-green-950">
              Create Lagos fallback
            </button>
          ) : null}
        </div>
      </div>
      {selectedProductHasCommonDestinationWarning ? (
        <div className="mb-4 rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm font-semibold text-amber-900">
          {selectedProduct?.name} has no active Lagos/Home Delivery All-city fallback yet.
        </div>
      ) : null}
      <div className="mb-4 rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm leading-6 text-amber-900">
        <p><strong>Package Size</strong> is the amount covered by one delivery package. Example: 1 Bag, 1 Basket, 1 Crate, or 20 kg.</p>
        <p><strong>First Package Fee</strong> is the delivery cost for the first package of this product to this location.</p>
        <p><strong>Extra Package Fee</strong> is what to add for each additional package after the first.</p>
        <p>Checkout uses the highest first-package fee once, then adds extra package fees for other products and larger quantities. This keeps delivery fair without overcharging customers.</p>
      </div>
      <CoverageChecker
        rows={coverageRows}
        states={states}
        cities={coverageCities}
        filter={coverageFilter}
        onFilterChange={setCoverageFilter}
        onAddRate={(product) => openCreate({
          productId: product.id,
          state: coverageFilter.state,
          city: coverageFilter.city,
          deliveryMethod: coverageFilter.deliveryMethod,
        })}
        onAddFallback={(product) => openCreate({
          productId: product.id,
          state: coverageFilter.state,
          city: "All",
          deliveryMethod: coverageFilter.deliveryMethod,
        })}
      />
      <AdminTable
        headers={["Product", "Location", "Method", "Package", "First fee", "Extra fee", "ETA", "Status", "Actions"]}
        rows={filteredRates.map((rate) => [
          <span key="product" className="font-bold text-green-950">{rate.productName ?? productById.get(rate.productId)?.name ?? "Unknown product"}</span>,
          `${rate.state} / ${rate.city}`,
          formatDeliveryMethod(rate.deliveryMethod),
          String(rate.packageSize),
          formatNaira(rate.firstPackageFee),
          formatNaira(rate.extraPackageFee),
          rate.estimatedDeliveryTime || "Not set",
          <StatusBadge key="status" status={rate.isActive ? "Active" : "Inactive"} />,
          <div key="actions" className="flex flex-wrap gap-2">
            <button type="button" onClick={() => openEdit(rate)} className="h-9 rounded-full bg-green-50 px-3 text-xs font-bold text-green-800">Edit</button>
            <button type="button" onClick={() => duplicateRate(rate)} className="h-9 rounded-full bg-amber-50 px-3 text-xs font-bold text-amber-800">Duplicate</button>
          </div>,
        ])}
      />
      {editing ? (
        <div className="fixed inset-0 z-50 grid place-items-center bg-green-950/50 p-4">
          <form onSubmit={saveRate} className="grid max-h-[90vh] w-full max-w-2xl gap-4 overflow-y-auto rounded-lg bg-white p-6 shadow-xl">
            <h2 className="text-xl font-bold text-green-950">{form.id ? "Edit product delivery rate" : "Create product delivery rate"}</h2>
            <div className="grid gap-4 md:grid-cols-2">
              <label className="grid gap-2 text-sm font-semibold text-stone-800">
                Product
                <select required value={form.productId} onChange={(event) => setForm({ ...form, productId: event.target.value })} className="h-11 rounded-lg border border-stone-200 bg-white px-4 font-normal">
                  <option value="" disabled>Select product</option>
                  {selectableProducts.map((product) => <option key={product.id} value={product.id}>{product.name}</option>)}
                </select>
              </label>
              <label className="grid gap-2 text-sm font-semibold text-stone-800">
                State
                <select value={form.state} onChange={(event) => {
                  const state = event.target.value;
                  const city = mergeUniqueSorted([...getNigeriaCities(state), ...rates.filter((rate) => rate.state === state).map((rate) => rate.city)])[0] ?? "All";
                  setForm({ ...form, state, city });
                }} className="h-11 rounded-lg border border-stone-200 bg-white px-4 font-normal">
                  {states.map((state) => <option key={state} value={state}>{state}</option>)}
                </select>
              </label>
              <label className="grid gap-2 text-sm font-semibold text-stone-800">
                City / Area
                <select value={form.city} onChange={(event) => setForm({ ...form, city: event.target.value })} className="h-11 rounded-lg border border-stone-200 bg-white px-4 font-normal">
                  {formCities.map((city) => <option key={city} value={city}>{city}</option>)}
                </select>
              </label>
              <label className="grid gap-2 text-sm font-semibold text-stone-800">
                Delivery method
                <select value={form.deliveryMethod} onChange={(event) => setForm({ ...form, deliveryMethod: event.target.value as DeliveryMethod })} className="h-11 rounded-lg border border-stone-200 bg-white px-4 font-normal">
                  <option value="home_delivery">Home Delivery</option>
                  <option value="pickup_point">Pickup Point Delivery</option>
                  <option value="farm_pickup">Farm Pickup / Direct Arrangement</option>
                </select>
              </label>
              <RateInput label="Package size" type="number" min={0.01} value={form.packageSize} onChange={(packageSize) => setForm({ ...form, packageSize: Number(packageSize) })} />
              <RateInput label="First package fee" type="number" min={0} value={form.firstPackageFee} onChange={(firstPackageFee) => setForm({ ...form, firstPackageFee: Number(firstPackageFee) })} />
              <RateInput label="Extra package fee" type="number" min={0} value={form.extraPackageFee} onChange={(extraPackageFee) => setForm({ ...form, extraPackageFee: Number(extraPackageFee) })} />
              <RateInput label="Estimated delivery time" required={false} value={form.estimatedDeliveryTime ?? ""} onChange={(estimatedDeliveryTime) => setForm({ ...form, estimatedDeliveryTime })} />
              <RateInput label="Sort order" type="number" min={0} value={form.sortOrder} onChange={(sortOrder) => setForm({ ...form, sortOrder: Number(sortOrder) })} />
              <label className="flex items-center gap-3 rounded-lg border border-stone-200 p-3 text-sm font-semibold">
                <input type="checkbox" checked={form.isActive} onChange={(event) => setForm({ ...form, isActive: event.target.checked })} className="size-4" />
                Active
              </label>
            </div>
            <div className="flex justify-end gap-3">
              <button type="button" disabled={isPending} onClick={() => setEditing(null)} className="h-11 rounded-full border border-stone-300 px-5 text-sm font-bold">Cancel</button>
              <button type="submit" disabled={isPending} className="h-11 rounded-full bg-green-800 px-5 text-sm font-bold text-white disabled:opacity-60">{isPending ? "Saving..." : "Save rate"}</button>
            </div>
          </form>
        </div>
      ) : null}
    </>
  );
}

function CoverageChecker({
  rows,
  states,
  cities,
  filter,
  onFilterChange,
  onAddRate,
  onAddFallback,
}: {
  rows: Array<{
    product: ProductWithId;
    supportsMethod: boolean;
    match: { rate: ProductDeliveryRate | null; source: MatchingRateSource };
    sourceLabel: string;
    status: string;
  }>;
  states: string[];
  cities: string[];
  filter: CoverageFilter;
  onFilterChange: (filter: CoverageFilter) => void;
  onAddRate: (product: ProductWithId) => void;
  onAddFallback: (product: ProductWithId) => void;
}) {
  return (
    <section className="mb-5 rounded-lg border border-green-100 bg-white p-4 shadow-sm">
      <div className="flex flex-col justify-between gap-3 lg:flex-row lg:items-end">
        <div>
          <h2 className="text-lg font-bold text-green-950">Check Delivery Coverage</h2>
          <p className="mt-1 text-sm leading-6 text-stone-600">Select a destination and method to see which orderable products are ready for checkout.</p>
        </div>
        <div className="grid gap-3 sm:grid-cols-3">
          <FilterSelect label="State" value={filter.state} onChange={(state) => onFilterChange({ ...filter, state, city: getNigeriaCities(state)[0] ?? "All" })}>
            {states.map((state) => <option key={state} value={state}>{state}</option>)}
          </FilterSelect>
          <FilterSelect label="City" value={filter.city} onChange={(city) => onFilterChange({ ...filter, city })}>
            {cities.map((city) => <option key={city} value={city}>{city}</option>)}
          </FilterSelect>
          <FilterSelect label="Method" value={filter.deliveryMethod} onChange={(deliveryMethod) => onFilterChange({ ...filter, deliveryMethod: deliveryMethod as DeliveryMethod })}>
            <option value="home_delivery">Home Delivery</option>
            <option value="pickup_point">Pickup Point</option>
            <option value="farm_pickup">Farm Pickup</option>
          </FilterSelect>
        </div>
      </div>
      <div className="mt-4 overflow-x-auto">
        <table className="min-w-full divide-y divide-stone-100 text-left text-sm">
          <thead className="text-xs uppercase tracking-wide text-stone-500">
            <tr>
              <th className="py-2 pr-4">Product</th>
              <th className="py-2 pr-4">Supports selected method?</th>
              <th className="py-2 pr-4">Has delivery rate?</th>
              <th className="py-2 pr-4">Matching rate source</th>
              <th className="py-2 pr-4">Status</th>
              <th className="py-2 pr-4">Quick actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-stone-100">
            {rows.map((row) => (
              <tr key={row.product.id}>
                <td className="py-3 pr-4 font-bold text-green-950">{row.product.name}</td>
                <td className="py-3 pr-4">{row.supportsMethod ? "Yes" : "No"}</td>
                <td className="py-3 pr-4">{row.match.rate ? "Yes" : "No"}</td>
                <td className="py-3 pr-4">{row.sourceLabel}</td>
                <td className="py-3 pr-4"><StatusBadge status={row.status} /></td>
                <td className="py-3 pr-4">
                  <div className="flex flex-wrap gap-2">
                    <button type="button" onClick={() => onAddRate(row.product)} className="h-8 rounded-full bg-green-50 px-3 text-xs font-bold text-green-800">Add rate</button>
                    <button type="button" onClick={() => onAddFallback(row.product)} className="h-8 rounded-full bg-amber-50 px-3 text-xs font-bold text-amber-800">Create city = All fallback</button>
                    <Link href={`/admin/products?product=${encodeURIComponent(row.product.id)}`} className="inline-flex h-8 items-center rounded-full bg-stone-100 px-3 text-xs font-bold text-stone-700">Edit product delivery support</Link>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function isOrderableProduct(product: ProductWithId) {
  return (
    product.status === "active" &&
    product.pricingMode !== "quote_required" &&
    product.isOrderableOnline !== false &&
    product.price > 0
  );
}

function toDeliveryProduct(product: ProductWithId): DeliveryProductForCalculation {
  return {
    productId: product.id,
    name: product.name,
    quantity: product.minimumOrder || 1,
    minimumOrder: product.minimumOrder,
    stockCount: product.stockCount,
    quantityStep: product.quantityStep,
    quantityInputType: product.quantityInputType,
    supportsHomeDelivery: product.supportsHomeDelivery ?? true,
    supportsPickupPoint: product.supportsPickupPoint ?? true,
    supportsFarmPickup: product.supportsFarmPickup ?? true,
    requiresDeliveryConfirmation: product.requiresDeliveryConfirmation ?? false,
  };
}

function nigeriaLocationsCityNames() {
  return nigeriaStateNames.flatMap((state) => getNigeriaCities(state));
}

function sourceToLabel(source: MatchingRateSource) {
  return {
    exact: "Exact city",
    all_city_fallback: "All-city fallback",
    missing: "Missing",
  }[source];
}

function FilterSelect({ label, value, onChange, children }: { label: string; value: string; onChange: (value: string) => void; children: React.ReactNode }) {
  return (
    <label className="grid gap-2 text-sm font-semibold text-stone-800">
      {label}
      <select value={value} onChange={(event) => onChange(event.target.value)} className="h-10 rounded-lg border border-stone-200 bg-white px-3 font-normal">
        {children}
      </select>
    </label>
  );
}

function RateInput({ label, value, onChange, type = "text", min, required = true }: { label: string; value: string | number; onChange: (value: string) => void; type?: string; min?: number; required?: boolean }) {
  return (
    <label className="grid gap-2 text-sm font-semibold text-stone-800">
      {label}
      <input required={required} type={type} min={min} step={type === "number" ? "any" : undefined} value={value} onChange={(event) => onChange(event.target.value)} className="h-11 rounded-lg border border-stone-200 px-4 font-normal" />
    </label>
  );
}