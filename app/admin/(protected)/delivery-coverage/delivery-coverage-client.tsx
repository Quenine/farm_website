"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  CoverageChecker,
  isOrderableProduct,
  sourceToLabel,
  toDeliveryProduct,
  type CoverageFilter,
  type ProductWithId,
} from "@/app/admin/(protected)/delivery-rates/product-delivery-rates-client";
import { AdminHeader } from "@/src/components/admin";
import {
  findMatchingProductDeliveryRate,
  supportsDeliveryMethod,
  type MatchingRateSource,
} from "@/src/lib/delivery-calculator";
import { getNigeriaCities, mergeUniqueSorted, nigeriaStateNames } from "@/src/lib/nigeria-locations";
import type { Product, ProductDeliveryRate } from "@/src/types";

export function DeliveryCoverageClient({
  initialRates,
  products,
}: {
  initialRates: ProductDeliveryRate[];
  products: Product[];
}) {
  const router = useRouter();
  const selectableProducts = useMemo(
    () => products.filter((product): product is ProductWithId => Boolean(product.id)),
    [products],
  );
  const states = useMemo(
    () => mergeUniqueSorted([...nigeriaStateNames, ...initialRates.map((rate) => rate.state)]),
    [initialRates],
  );
  const [coverageFilter, setCoverageFilter] = useState<CoverageFilter>({
    state: "Oyo",
    city: "Iseyin",
    deliveryMethod: "home_delivery",
  });
  const coverageCities = useMemo(
    () => mergeUniqueSorted([
      ...getNigeriaCities(coverageFilter.state),
      ...initialRates.filter((rate) => rate.state === coverageFilter.state).map((rate) => rate.city),
      "All",
    ]),
    [coverageFilter.state, initialRates],
  );
  const coverageRows = useMemo(
    () => selectableProducts.filter(isOrderableProduct).map((product) => {
      const deliveryProduct = toDeliveryProduct(product);
      const supportsMethod = supportsDeliveryMethod(deliveryProduct, coverageFilter.deliveryMethod);
      const match = supportsMethod
        ? findMatchingProductDeliveryRate({
            rates: initialRates,
            productId: product.id,
            state: coverageFilter.state,
            city: coverageFilter.city,
            deliveryMethod: coverageFilter.deliveryMethod,
          })
        : { rate: null, source: "missing" as MatchingRateSource };
      const sourceLabel = supportsMethod ? sourceToLabel(match.source) : "Missing";
      const status = !supportsMethod ? "Method unsupported" : match.rate ? "Ready" : "Missing rate";

      return { product, supportsMethod, match, sourceLabel, status };
    }),
    [coverageFilter, initialRates, selectableProducts],
  );

  const openRateBuilder = (product: ProductWithId, city: string) => {
    const params = new URLSearchParams({ product: product.id });
    if (coverageFilter.state) params.set("state", coverageFilter.state);
    if (city) params.set("city", city);
    if (coverageFilter.deliveryMethod) params.set("method", coverageFilter.deliveryMethod);
    router.push(`/admin/delivery-rates?${params.toString()}`);
  };

  return (
    <>
      <AdminHeader
        title="Delivery Coverage"
        body="Check whether every orderable product has a matching product delivery rate for a destination and delivery method."
      />
      <div className="mb-4 rounded-lg border border-green-100 bg-white p-4 text-sm leading-6 text-stone-700 shadow-sm">
        <p className="font-bold text-green-950">Destination readiness rule</p>
        <p>
          Before accepting online orders for a destination, every orderable product must have an active Product Delivery Rate for that destination and delivery method, or an All-city fallback.
        </p>
      </div>
      <CoverageChecker
        rows={coverageRows}
        states={states}
        cities={coverageCities}
        filter={coverageFilter}
        onFilterChange={setCoverageFilter}
        onAddRate={(product) => openRateBuilder(product, coverageFilter.city)}
        onAddFallback={(product) => openRateBuilder(product, "All")}
      />
    </>
  );
}
