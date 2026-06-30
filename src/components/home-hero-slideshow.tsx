/* eslint-disable @next/next/no-img-element */
"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";

type HeroSlideImage = {
  url: string;
  alt: string;
};

export function HeroSlideshowPanel({
  images,
  children,
}: {
  images: HeroSlideImage[];
  children: ReactNode;
}) {
  const [activeIndex, setActiveIndex] = useState(0);
  const [failedUrls, setFailedUrls] = useState<string[]>([]);
  const [reducedMotion, setReducedMotion] = useState(false);

  const visibleImages = useMemo(
    () => images.filter((image) => !failedUrls.includes(image.url)).slice(0, 5),
    [failedUrls, images],
  );

  useEffect(() => {
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    const updatePreference = () => setReducedMotion(media.matches);
    updatePreference();
    media.addEventListener("change", updatePreference);
    return () => media.removeEventListener("change", updatePreference);
  }, []);

  useEffect(() => {
    if (reducedMotion || visibleImages.length <= 1) return;
    const interval = window.setInterval(() => {
      setActiveIndex((current) => (current + 1) % visibleImages.length);
    }, 6500);
    return () => window.clearInterval(interval);
  }, [reducedMotion, visibleImages.length]);

  const displayIndex = visibleImages.length > 0 ? activeIndex % visibleImages.length : 0;

  return (
    <div className="rounded-lg bg-green-950 p-6 text-white shadow-xl">
      <div className="relative grid min-h-[360px] overflow-hidden rounded-lg bg-[linear-gradient(135deg,#fff7ed_0%,#dcfce7_45%,#fde68a_100%)] p-6 text-green-950">
        {visibleImages.length > 0 ? (
          <div className="absolute inset-0" aria-hidden="true">
            {visibleImages.map((image, index) => (
              <img
                key={image.url}
                src={image.url}
                alt=""
                loading={index === 0 ? "eager" : "lazy"}
                decoding="async"
                onError={() =>
                  setFailedUrls((current) =>
                    current.includes(image.url) ? current : [...current, image.url],
                  )
                }
                className={`hero-slideshow-image absolute inset-0 h-full w-full object-cover ${
                  index === displayIndex ? "is-active" : ""
                }`}
              />
            ))}
          </div>
        ) : null}
        <div className="absolute inset-0 bg-[linear-gradient(135deg,rgba(20,83,45,0.48),rgba(254,243,199,0.44)_48%,rgba(20,83,45,0.56))]" />
        <div className="absolute inset-0 bg-green-950/10 backdrop-blur-[1px]" />
        <div className="relative z-10 grid place-items-center">{children}</div>
      </div>
    </div>
  );
}
