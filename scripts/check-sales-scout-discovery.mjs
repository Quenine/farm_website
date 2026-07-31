import assert from "node:assert/strict";
import fs from "node:fs";

const files = [
  "src/lib/sales-scout/discovery/server.ts",
  "src/lib/sales-scout/discovery/dataforseo.ts",
  "src/lib/sales-scout/discovery/helpers.ts",
  "app/admin/(protected)/marketing/sales-scout/discover/actions.ts",
  "app/admin/(protected)/marketing/sales-scout/discover/page.tsx",
  "app/admin/(protected)/marketing/sales-scout/discover/[candidateId]/page.tsx",
  "src/components/sales-scout/discovery-run-form.tsx",
  "src/components/sales-scout/discovery-candidate-actions.tsx",
];

const source = files.map((file) => fs.readFileSync(file, "utf8")).join("\n");
const orchestration = fs.readFileSync("src/lib/sales-scout/discovery/server.ts", "utf8");
assert.doesNotMatch(source, /eslint-disable[^\n]*no-explicit-any/);
assert.doesNotMatch(source, /\bany\b/);
assert.doesNotMatch(source, /catch\s*\([^)]*\)\s*\{\s*\}/);
assert.doesNotMatch(source, /from\(["']marketing_prospects["']\)\s*\.insert/);
assert.doesNotMatch(source, /NEXT_PUBLIC_[A-Z0-9_]*DISCOVERY/);
assert.doesNotMatch(source, /NEXT_PUBLIC_[A-Z0-9_]*DATAFORSEO/);
for (const match of orchestration.matchAll(/from\("marketing_sales_scout_discovery_candidates"\)\s*\.select\("([^"]+)"/g)) {
  assert.ok(!match[1].split(",").includes("description"));
}
const providerGuardIndex = orchestration.indexOf("if(!isDataForSeoBusinessListingsConfigured())");
assert.ok(providerGuardIndex >= 0 && providerGuardIndex < orchestration.indexOf("start_sales_scout_discovery_run"));
assert.match(source, /requireSalesScoutDiscoveryEnabled/);
assert.match(source, /useActionState/);
assert.match(source, /useFormStatus/);
assert.match(source, /DataForSEO charge/);
assert.ok(fs.existsSync("tests/sales-scout-discovery.test.ts"));
console.log("Sales Scout discovery static audit passed.");
