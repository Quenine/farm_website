import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
const execute = read("database/execute-shields-launch-reset.sql");
const preview = read("database/preview-shields-launch-reset.sql");
const verify = read("database/verify-shields-launch-reset.sql");
const seed = read("database/seed-shields-launch-campaigns.sql");
const docs = read("docs/SHIELDS_LAUNCH_RESET.md");
const shieldsEnv = read(".env.shields.example");
const nobleEnv = read(".env.example");

assert.doesNotMatch(execute, /\btruncate\b[\s\S]*\bcascade\b/i);
for (const table of [
  "products", "categories", "product_images", "product_media",
  "delivery_zones", "delivery_rates", "product_delivery_rates",
  "profiles", "app_settings", "web_push_subscriptions",
]) {
  assert.doesNotMatch(execute, new RegExp(`delete\\s+from\\s+(?:public\\.)?${table}\\b`, "i"));
}
assert.doesNotMatch(execute, /\bdelete\s+from\s+auth\.users\b/i);
assert.match(execute, /create temporary table shields_stock_snapshot/i);
assert.match(execute, /products\.stock_quantity changed/i);
assert.ok(execute.indexOf("delete from public.order_push_subscriptions") < execute.indexOf("delete from public.orders"));
assert.ok(execute.indexOf("delete from public.inventory_movements") < execute.indexOf("delete from public.order_items"));
assert.ok(execute.indexOf("delete from public.affiliate_conversions") < execute.indexOf("delete from public.affiliate_partners"));
assert.ok(execute.indexOf("delete from public.marketing_campaign_spend") < execute.indexOf("delete from public.marketing_campaigns"));
assert.ok(execute.indexOf("delete from public.marketing_prospect_activities") < execute.indexOf("delete from public.marketing_prospects"));
assert.match(execute, /v_reset_test_subscribers boolean := true/);
assert.match(execute, /RESET_SHIELDS_FARMS_LAUNCH_2026_07_26/);
assert.match(seed, /on conflict \(slug\) do update/i);

const slugs = [
  "fresh-essentials-whatsapp", "fresh-essentials-facebook",
  "fresh-essentials-instagram", "fresh-essentials-tiktok",
  "fresh-essentials-x", "irish-potatoes-whatsapp",
  "chicken-eggs-whatsapp", "kitchen-essentials-whatsapp",
  "business-supply-outreach",
];
for (const slug of slugs) {
  assert.match(seed, new RegExp(`'${slug}'`));
}
assert.match(seed, /https:\/\/shieldsfarms\.store\/go\//);
assert.match(preview, /pg_constraint/);
assert.match(verify, /READY FOR FIRST LIVE ORDER/);
assert.match(shieldsEnv, /CONTENT_INDEXING_ENABLED="false"/);
assert.match(shieldsEnv, /INDEXNOW_ENABLED="false"/);
assert.match(nobleEnv, /NEXT_PUBLIC_SITE_NAME="Noble Farms"/);
assert.match(docs, /separate Supabase projects/i);

const secretPattern = /\b(?:sk|pk)_(?:live|test)_[A-Za-z0-9]{16,}\b/;
for (const artifact of [execute, preview, verify, seed, docs]) {
  assert.doesNotMatch(artifact, secretPattern);
}

console.log("Shields launch-reset static checks passed.");
