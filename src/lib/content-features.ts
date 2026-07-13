export type ContentFeatures = {
  contentHubEnabled: boolean;
  affiliateContentEnabled: boolean;
  contentToolsEnabled: boolean;
  contentSubscriptionsEnabled: boolean;
  contentIndexingEnabled: boolean;
};

export function envFlag(value: string | undefined | null) {
  const normalized = value?.trim().toLowerCase();
  return normalized === "true" || normalized === "1";
}

export function getContentFeatures(): ContentFeatures {
  return {
    contentHubEnabled: envFlag(process.env.NEXT_PUBLIC_CONTENT_HUB_ENABLED),
    affiliateContentEnabled: envFlag(process.env.NEXT_PUBLIC_AFFILIATE_CONTENT_ENABLED),
    contentToolsEnabled: envFlag(process.env.NEXT_PUBLIC_CONTENT_TOOLS_ENABLED),
    contentSubscriptionsEnabled: envFlag(process.env.NEXT_PUBLIC_CONTENT_SUBSCRIPTIONS_ENABLED),
    contentIndexingEnabled: envFlag(process.env.CONTENT_INDEXING_ENABLED),
  };
}
