import { createClient } from "@supabase/supabase-js";
import fs from "node:fs";

function loadEnvFile(path) {
  if (!fs.existsSync(path)) return;
  const lines = fs.readFileSync(path, "utf8").split(/\r?\n/);
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#") || !trimmed.includes("=")) continue;
    const index = trimmed.indexOf("=");
    const key = trimmed.slice(0, index).trim();
    let value = trimmed.slice(index + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) value = value.slice(1, -1);
    if (process.env[key] === undefined) process.env[key] = value;
  }
}

loadEnvFile(".env.local");
loadEnvFile(".env");

function requiredEnv(name) {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(name + " is not configured.");
  return value;
}

function sanitize(value) {
  return String(value ?? "").replace(/(eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+)/g, "[redacted-token]").slice(0, 240);
}

const supabase = createClient(requiredEnv("NEXT_PUBLIC_SUPABASE_URL"), requiredEnv("SUPABASE_SERVICE_ROLE_KEY"), {
  auth: { autoRefreshToken: false, persistSession: false, detectSessionInUrl: false },
});

const probes = [
  ["Select content categories", () => supabase.from("content_categories").select("id,name,slug,description,seo_title,seo_description,sort_order,is_active,updated_at", { count: "exact" }).order("sort_order").order("name").limit(25)],
  ["Select content tags", () => supabase.from("content_tags").select("id,name,slug,description,is_active,updated_at", { count: "exact" }).order("updated_at", { ascending: false }).limit(25)],
  ["Select content authors", () => supabase.from("content_authors").select("id,name,slug,role_title,bio,avatar_url,avatar_alt,credentials_or_experience,is_active,updated_at", { count: "exact" }).order("updated_at", { ascending: false }).limit(25)],
  ["Select content sources", () => supabase.from("content_sources").select("id,title,publisher,url,source_type,publication_date,accessed_at,is_primary_source,is_active,updated_at", { count: "exact" }).order("updated_at", { ascending: false }).limit(25)],
  ["Select content videos", () => supabase.from("content_videos").select("id,post_id,platform,external_video_id,embed_url,watch_url,title,description,thumbnail_url,thumbnail_alt,duration_seconds,upload_date,transcript_markdown,chapters,is_active,updated_at,content_posts(title,slug)", { count: "exact" }).order("updated_at", { ascending: false }).limit(25)],
  ["Select content subscribers", () => supabase.from("content_subscribers").select("id,status,source_path,subscription_topic,consented_at,unsubscribed_at,created_at,updated_at", { count: "exact" }).order("created_at", { ascending: false }).limit(25)],
  ["Select affiliate partners", () => supabase.from("affiliate_partners").select("id,name,slug,website_url,affiliate_network,default_disclosure,is_active,updated_at", { count: "exact" }).order("updated_at", { ascending: false }).limit(25)],
  ["Select affiliate offers", () => supabase.from("affiliate_offers").select("id,partner_id,title,slug,short_description,destination_url,image_url,image_alt,button_label,display_price,currency,price_last_checked_at,available_regions,recommendation_basis,is_featured,is_active,updated_at,affiliate_partners(name,slug)", { count: "exact" }).order("updated_at", { ascending: false }).limit(25)],
  ["Count content posts", () => supabase.from("content_posts").select("id", { count: "exact", head: true })],
  ["Count category/post relationships", () => supabase.from("content_posts").select("category_id", { count: "exact", head: true })],
  ["Count tag/post relationships", () => supabase.from("content_post_tags").select("tag_id", { count: "exact", head: true })],
  ["Count source/post relationships", () => supabase.from("content_post_sources").select("source_id", { count: "exact", head: true })],
  ["Count partner/offer relationships", () => supabase.from("affiliate_offers").select("partner_id", { count: "exact", head: true })],
  ["Count offer/click relationships", () => supabase.from("affiliate_clicks").select("offer_id", { count: "exact", head: true })],
  ["Count offer/post relationships", () => supabase.from("content_post_affiliate_offers").select("offer_id", { count: "exact", head: true })],
  ["Read products needed by article editor", () => supabase.from("products").select("id,name,slug,price,unit,status,stock_quantity,product_media(url,alt_text,is_primary)", { count: "exact" }).order("name").limit(25)],
  ["Read orders containing content_attribution", () => supabase.from("orders").select("id,payment_status,content_attribution", { count: "exact" }).not("content_attribution", "is", null).limit(25)],
];

let failed = 0;
for (const [name, run] of probes) {
  const result = await run();
  const error = result.error;
  const count = result.count ?? result.data?.length ?? 0;
  if (error) failed += 1;
  console.log(JSON.stringify({
    probe: name,
    ok: !error,
    code: error?.code ?? null,
    message: sanitize(error?.message),
    details: sanitize(error?.details),
    hint: sanitize(error?.hint),
    rowCount: error ? null : count,
  }));
}

if (failed > 0) process.exit(1);
