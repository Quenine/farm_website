"use client";

import { useState } from "react";

type Props = {
  src: string | null;
  alt: string;
  label: string;
  eager?: boolean;
};

export function safeBlogImageUrl(value: string | null) {
  const source = value?.trim();
  if (!source) return null;
  if (source.startsWith("/") && !source.startsWith("//")) return source;
  try {
    const url = new URL(source);
    return url.protocol === "https:" ? url.toString() : null;
  } catch {
    return null;
  }
}

export function BlogCardImage({ src, alt, label, eager = false }: Props) {
  const [failed, setFailed] = useState(false);
  const safeSrc = safeBlogImageUrl(src);

  return (
    <div className="relative aspect-video w-full overflow-hidden bg-gradient-to-br from-green-950 via-green-800 to-amber-100">
      {safeSrc && !failed ? (
        // Remote origins are intentionally not added to Next Image allowlists; published HTTPS URLs render directly.
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={safeSrc}
          alt={alt}
          loading={eager ? "eager" : "lazy"}
          onError={() => setFailed(true)}
          className="h-full w-full object-cover transition-transform duration-300 ease-out group-hover:scale-[1.025]"
        />
      ) : (
        <div data-blog-image-fallback className="absolute inset-0 flex items-end overflow-hidden p-5 text-amber-50">
          <div aria-hidden="true" className="absolute -right-8 -top-10 h-40 w-40 rounded-full border border-white/15" />
          <div aria-hidden="true" className="absolute bottom-7 right-8 h-16 w-24 -skew-x-12 rounded-t-full border-t border-white/20" />
          <span className="relative text-xs font-bold uppercase tracking-[0.18em] text-amber-100">Shields Farms · {label}</span>
        </div>
      )}
    </div>
  );
}
