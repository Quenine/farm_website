import "server-only";

import type { Metadata } from "next";
import { contentPublicConfig, siteConfig } from "@/src/config/site";

function serverBool(name: string, fallback: boolean) {
  const value = process.env[name]?.trim().toLowerCase();
  if (!value) return fallback;
  return ["1", "true", "yes", "on"].includes(value);
}

export const contentConfig = {
  ...contentPublicConfig,
  indexingEnabled: serverBool("CONTENT_INDEXING_ENABLED", false),
  indexNowEnabled: serverBool("INDEXNOW_ENABLED", false),
  indexNowKey: process.env.INDEXNOW_KEY?.trim() ?? "",
};

export function contentRobots(): Metadata["robots"] {
  return contentConfig.indexingEnabled
    ? { index: true, follow: true }
    : { index: false, follow: false };
}

export function contentMetadata(input: {
  title: string;
  description: string;
  path: string;
  image?: string | null;
}): Metadata {
  const canonical = `${siteConfig.url.replace(/\/$/, "")}${input.path}`;
  return {
    title: input.title,
    description: input.description,
    alternates: { canonical },
    robots: contentRobots(),
    openGraph: {
      type: "article",
      title: input.title,
      description: input.description,
      url: canonical,
      siteName: siteConfig.name,
      images: input.image ? [input.image] : [siteConfig.logoPath],
    },
    twitter: {
      card: "summary_large_image",
      title: input.title,
      description: input.description,
      images: input.image ? [input.image] : [siteConfig.logoPath],
    },
  };
}

export function rssDiscoveryEnabled() {
  return contentConfig.hubEnabled && contentConfig.indexingEnabled;
}

export function indexNowCanSubmit() {
  return contentConfig.indexingEnabled && contentConfig.indexNowEnabled && Boolean(contentConfig.indexNowKey);
}
