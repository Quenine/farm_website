import "server-only";

import { createHash } from "node:crypto";
import webpush from "web-push";
import { siteConfig } from "@/src/config/site";
import { createAdminSupabaseClient } from "@/src/lib/supabase/admin";

export type OperationalNotificationInput = {
  type: "order" | "inquiry" | "payment" | "inventory" | "delivery" | "system";
  severity: "info" | "success" | "warning" | "critical";
  event: string;
  title: string;
  message: string;
  targetUrl?: string;
  entityType?: string;
  entityId?: string;
  metadata?: Record<string, string | number | boolean | null>;
};

export type SafePushPayload = { title: string; body: string; url: string; tag: string };

function site() { return siteConfig.domain; }
function safePath(value?: string) { return value?.startsWith("/") && !value.startsWith("//") ? value.slice(0, 500) : "/admin"; }
function dedupe(input: OperationalNotificationInput) {
  return createHash("sha256").update([site(), input.type, input.event, input.entityId ?? "site"].join(":")).digest("hex");
}

function configurePush() {
  const subject = process.env.VAPID_SUBJECT?.trim();
  const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY?.trim();
  const privateKey = process.env.VAPID_PRIVATE_KEY?.trim();
  if (process.env.PUSH_NOTIFICATIONS_ENABLED?.trim().toLowerCase() !== "true" || !subject || !publicKey || !privateKey) return false;
  webpush.setVapidDetails(subject, publicKey, privateKey);
  return true;
}

export async function createOperationalNotification(input: OperationalNotificationInput) {
  try {
    const supabase = createAdminSupabaseClient();
    const row = {
      site: site(), type: input.type, severity: input.severity, title: input.title.slice(0, 160),
      message: input.message.slice(0, 500), target_url: safePath(input.targetUrl), entity_type: input.entityType ?? null,
      entity_id: input.entityId ?? null, dedupe_key: dedupe(input), metadata: input.metadata ?? {},
    };
    const { data, error } = await supabase.from("app_notifications").upsert(row, { onConflict: "site,dedupe_key", ignoreDuplicates: true }).select("id").maybeSingle();
    if (error) throw new Error(error.code || "insert_failed");
    if (data?.id) void fanOutAdminPush({ title: input.title, body: input.message, url: row.target_url, tag: `${input.type}-${input.event}-${input.entityId ?? "site"}` });
    return { ok: true, id: data?.id ?? null };
  } catch (error) {
    console.error("[Operational Notification Failed]", { type: input.type, event: input.event, reason: error instanceof Error ? error.message.slice(0, 80) : "unknown" });
    return { ok: false, id: null };
  }
}

async function fanOutAdminPush(payload: SafePushPayload) {
  if (!configurePush()) return;
  const supabase = createAdminSupabaseClient();
  const { data } = await supabase.from("web_push_subscriptions").select("id,endpoint,p256dh,auth_key,failure_count").eq("site", site()).eq("context", "admin").eq("enabled", true).is("revoked_at", null).limit(100);
  await Promise.allSettled(((data ?? []) as Array<{ id: string; endpoint: string; p256dh: string; auth_key: string; failure_count: number }>).map(async (subscription) => {
    try {
      await webpush.sendNotification({ endpoint: subscription.endpoint, keys: { p256dh: subscription.p256dh, auth: subscription.auth_key } }, JSON.stringify(payload), { TTL: 300 });
      await supabase.from("web_push_subscriptions").update({ last_success_at: new Date().toISOString(), failure_count: 0 }).eq("id", subscription.id);
    } catch (error) {
      const status = typeof error === "object" && error && "statusCode" in error ? Number((error as { statusCode?: number }).statusCode) : 0;
      if (status === 404 || status === 410) await supabase.from("web_push_subscriptions").update({ enabled: false, revoked_at: new Date().toISOString() }).eq("id", subscription.id);
      else await supabase.from("web_push_subscriptions").update({ failure_count: Math.min(100, subscription.failure_count + 1) }).eq("id", subscription.id);
      console.error("[Web Push Delivery Failed]", { context: "admin", status, category: status === 404 || status === 410 ? "revoked" : "controlled_failure" });
    }
  }));
}

export async function sendCustomerOrderPush(orderId: string, status: string, reference: string) {
  try {
    if (!configurePush()) return false;
    const supabase = createAdminSupabaseClient();
    const { data } = await supabase.from("order_push_subscriptions").select("web_push_subscriptions(id,endpoint,p256dh,auth_key,failure_count,enabled,revoked_at)").eq("order_id", orderId);
    const payload: SafePushPayload = { title: `Your ${siteConfig.name} order was updated`, body: "Your delivery status has been updated.", url: `/track-order?reference=${encodeURIComponent(reference)}`, tag: `order-status-${orderId}` };
    await Promise.allSettled((data ?? []).map(async (row: Record<string, unknown>) => {
      const raw = Array.isArray(row.web_push_subscriptions) ? row.web_push_subscriptions[0] : row.web_push_subscriptions;
      const subscription = raw as { id: string; endpoint: string; p256dh: string; auth_key: string; failure_count: number; enabled: boolean; revoked_at: string | null } | null;
      if (!subscription?.enabled || subscription.revoked_at) return;
      try {
        await webpush.sendNotification({ endpoint: subscription.endpoint, keys: { p256dh: subscription.p256dh, auth: subscription.auth_key } }, JSON.stringify(payload), { TTL: 3600 });
        await supabase.from("web_push_subscriptions").update({ last_success_at: new Date().toISOString(), failure_count: 0 }).eq("id", subscription.id);
      } catch (error) {
        const code = typeof error === "object" && error && "statusCode" in error ? Number((error as { statusCode?: number }).statusCode) : 0;
        await supabase.from("web_push_subscriptions").update(code === 404 || code === 410 ? { enabled: false, revoked_at: new Date().toISOString() } : { failure_count: Math.min(100, subscription.failure_count + 1) }).eq("id", subscription.id);
      }
    }));
    return true;
  } catch {
    console.error("[Web Push Delivery Failed]", { context: "customer", status: 0, category: "controlled_failure" });
    return false;
  }
}

export function endpointHash(endpoint: string) {
  return createHash("sha256").update(endpoint).digest("hex");
}
