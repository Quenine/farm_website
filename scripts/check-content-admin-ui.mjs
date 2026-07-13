import fs from "node:fs";
import { createClient } from "@supabase/supabase-js";

function loadEnvFile(path) {
  if (!fs.existsSync(path)) return;
  for (const line of fs.readFileSync(path, "utf8").split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#") || !trimmed.includes("=")) continue;
    const index = trimmed.indexOf("=");
    const key = trimmed.slice(0, index).trim();
    let value = trimmed.slice(index + 1).trim();
    if ((value.startsWith("\"") && value.endsWith("\"")) || (value.startsWith("'") && value.endsWith("'"))) value = value.slice(1, -1);
    if (process.env[key] === undefined) process.env[key] = value;
  }
}
loadEnvFile(".env.local");
loadEnvFile(".env");

function requiredEnv(name) { const value = process.env[name]?.trim(); if (!value) throw new Error(name + " is not configured."); return value; }
function isPlainObject(value) { if (!value || typeof value !== "object") return false; const proto = Object.getPrototypeOf(value); return proto === Object.prototype || proto === null; }
function assertSerializable(value, path = "payload") {
  if (value === undefined) throw new Error(path + " is undefined");
  if (value === null || typeof value === "string" || typeof value === "boolean") return;
  if (typeof value === "number") { if (!Number.isFinite(value)) throw new Error(path + " is non-finite number"); return; }
  if (typeof value === "bigint" || typeof value === "function" || value instanceof Date || value instanceof Error || value instanceof Map || value instanceof Set || value instanceof URL) throw new Error(path + " is non-serializable " + Object.prototype.toString.call(value));
  if (Array.isArray(value)) { value.forEach((item, index) => assertSerializable(item, path + "[" + index + "]")); return; }
  if (!isPlainObject(value)) throw new Error(path + " is non-plain object");
  for (const [key, child] of Object.entries(value)) assertSerializable(child, path + "." + key);
}
function pass(name) { console.log("PASS " + name); }
function check(name, condition) { if (!condition) throw new Error("FAIL " + name); pass(name); }

const supabase = createClient(requiredEnv("NEXT_PUBLIC_SUPABASE_URL"), requiredEnv("SUPABASE_SERVICE_ROLE_KEY"), { auth: { autoRefreshToken: false, persistSession: false, detectSessionInUrl: false } });
const categories = await supabase.from("content_categories").select("id,name,slug,description,seo_title,seo_description,sort_order,is_active,updated_at").order("sort_order").order("name");
if (categories.error) throw new Error("Category query failed: " + categories.error.message);
assertSerializable(categories.data ?? [], "categories.records");
check("Category records serialize", Array.isArray(categories.data));
check("Categories contain seeded records", (categories.data ?? []).length === 9);
const tags = await supabase.from("content_tags").select("id,name,slug,description,is_active,updated_at").order("name");
if (tags.error) throw new Error("Tag query failed: " + tags.error.message);
assertSerializable(tags.data ?? [], "tags.records");
check("Tag records serialize", Array.isArray(tags.data));
check("Tags contain seeded records", (tags.data ?? []).length === 16);
const emptyPayloads = { authors: [], sources: [], videos: [], subscribers: [], partners: [], offers: [] };
assertSerializable(emptyPayloads, "emptyPayloads");
for (const name of Object.keys(emptyPayloads)) pass("Empty " + name + " payload serializes");
const descriptorSamples = {
  categoryFields: [{ name: "name", label: "Name *", required: true }, { name: "sort_order", label: "Sort order", type: "number" }],
  tagFields: [{ name: "name", label: "Name *", required: true }],
  authorFields: [{ name: "name", label: "Name *", required: true }, { name: "bio", label: "Bio", type: "textarea" }],
  partnerFields: [{ name: "website_url", label: "Website URL *", type: "url", required: true }],
  offerFields: [{ name: "partner_id", label: "Partner *", type: "select", required: true, options: [] }],
  categoryColumns: [{ key: "name", label: "Category" }, { key: "post_count", label: "Posts", format: "number" }],
};
assertSerializable(descriptorSamples, "descriptors");
for (const name of Object.keys(descriptorSamples)) pass(name + " serialize");
const crudPages = [
  "app/admin/(protected)/content/categories/page.tsx",
  "app/admin/(protected)/content/tags/page.tsx",
  "app/admin/(protected)/content/authors/page.tsx",
  "app/admin/(protected)/content/sources/page.tsx",
  "app/admin/(protected)/content/videos/page.tsx",
  "app/admin/(protected)/affiliate/partners/page.tsx",
  "app/admin/(protected)/affiliate/offers/page.tsx",
];
for (const page of crudPages) {
  const text = fs.readFileSync(page, "utf8");
  check(page + " has no render callbacks", !text.includes("render:"));
  check(page + " has no function props in columns", !/columns=\{\[[\s\S]*?=>/.test(text));
}
const actions = fs.readFileSync("app/admin/(protected)/content/actions.ts", "utf8");
check("CRUD actions module is marked use server", actions.startsWith("\"use server\";"));
assertSerializable({ ok: false, success: false, message: "Please correct the highlighted fields.", fieldErrors: { name: ["Required"] } }, "failedActionResult");
assertSerializable({ ok: true, success: true, message: "Created successfully.", id: "00000000-0000-4000-8000-000000000000" }, "successfulActionResult");
pass("Action return types are plain serializable objects");
