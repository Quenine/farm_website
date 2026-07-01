/* eslint-disable @next/next/no-img-element */
"use client";

import { useState } from "react";
import { Play, Sprout } from "lucide-react";
import { siteConfig } from "@/src/config/site";
import type { Product } from "@/src/types";

function BrandedPlaceholder({ label = `${siteConfig.name} supply` }: { label?: string }) {
  return (
    <div className="grid h-full min-h-[180px] w-full place-items-center bg-[linear-gradient(135deg,#ecfccb,#fef3c7)] text-green-950">
      <div className="text-center">
        <Sprout className="mx-auto text-green-800" size={34} />
        <p className="mt-3 text-xs font-bold uppercase tracking-[0.18em] text-amber-800">
          {label}
        </p>
      </div>
    </div>
  );
}

export function ProductMediaThumbnail({ product }: { product: Product }) {
  const [failed, setFailed] = useState(false);
  const media = product.primaryMedia;

  if (!media || failed) {
    return <BrandedPlaceholder />;
  }

  if (media.mediaType === "video") {
    return (
      <div className="relative h-full min-h-[180px] w-full overflow-hidden bg-green-950 text-white">
        <video className="h-full w-full object-cover" src={media.url} muted playsInline />
        <div className="absolute inset-0 grid place-items-center bg-green-950/25">
          <span className="grid size-12 place-items-center rounded-full bg-white/90 text-green-900">
            <Play size={20} fill="currentColor" />
          </span>
        </div>
      </div>
    );
  }

  return (
    <img
      src={media.url}
      alt={media.altText || `${product.name} from ${siteConfig.name}`}
      className="h-full min-h-[180px] w-full object-cover"
      onError={() => setFailed(true)}
    />
  );
}

export function ProductMediaGallery({ product }: { product: Product }) {
  const media = product.media ?? [];
  const [activeId, setActiveId] = useState(media[0]?.id ?? null);
  const [failedIds, setFailedIds] = useState<string[]>([]);
  const active = media.find((item) => item.id === activeId) ?? media[0] ?? null;

  const failed = active ? failedIds.includes(active.id) : false;

  return (
    <div className="rounded-lg bg-[linear-gradient(135deg,#fef3c7,#dcfce7)] p-4 shadow-sm">
      <div className="overflow-hidden rounded-lg bg-white/70">
        <div className="aspect-square">
          {!active || failed ? (
            <BrandedPlaceholder label={product.category} />
          ) : active.mediaType === "video" ? (
            <video
              key={active.id}
              src={active.url}
              controls
              className="h-full w-full object-cover"
            />
          ) : (
            <img
              key={active.id}
              src={active.url}
              alt={active.altText || `${product.name} from ${siteConfig.name}`}
              className="h-full w-full object-cover"
              onError={() => setFailedIds((current) => [...current, active.id])}
            />
          )}
        </div>
      </div>
      {active?.caption ? (
        <p className="mt-3 text-sm font-semibold text-green-950">{active.caption}</p>
      ) : null}
      {media.length > 1 ? (
        <div className="mt-4 grid grid-cols-4 gap-3 sm:grid-cols-5">
          {media.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => setActiveId(item.id)}
              className={`relative overflow-hidden rounded-lg border bg-white ${
                item.id === active?.id ? "border-green-800" : "border-green-900/10"
              }`}
              aria-label={`Show ${item.mediaType} for ${product.name}`}
            >
              <div className="aspect-square">
                {item.mediaType === "video" ? (
                  <div className="grid h-full place-items-center bg-green-950 text-white">
                    <Play size={18} fill="currentColor" />
                  </div>
                ) : failedIds.includes(item.id) ? (
                  <BrandedPlaceholder label={siteConfig.name} />
                ) : (
                  <img
                    src={item.url}
                    alt={item.altText || `${product.name} thumbnail`}
                    className="h-full w-full object-cover"
                    onError={() => setFailedIds((current) => [...current, item.id])}
                  />
                )}
              </div>
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}


