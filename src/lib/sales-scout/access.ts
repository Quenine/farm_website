import "server-only";

import { envFlag } from "@/src/lib/content-features";
import { siteConfig } from "@/src/config/site";
import { isSalesScoutDeploymentEnabled } from "./access-policy";

export function isSalesScoutEnabled() {
  return isSalesScoutDeploymentEnabled({
    enabledFlag: envFlag(process.env.SALES_SCOUT_ENABLED),
    canonicalHostname: siteConfig.domain,
  });
}

export function requireSalesScoutEnabled() {
  if (!isSalesScoutEnabled()) {
    throw new SalesScoutUnavailableError();
  }
}

export class SalesScoutUnavailableError extends Error {
  constructor() {
    super("Sales Scout is unavailable.");
    this.name = "SalesScoutUnavailableError";
  }
}

