const shieldsCanonicalDomains = new Set([
  "shieldsfarms.store",
  "www.shieldsfarms.store",
]);

export function isSalesScoutDeploymentEnabled(input: {
  enabledFlag: boolean;
  canonicalHostname: string;
}) {
  return (
    input.enabledFlag &&
    shieldsCanonicalDomains.has(input.canonicalHostname.trim().toLowerCase())
  );
}

