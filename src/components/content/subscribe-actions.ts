"use server";

import { randomBytes, createHash } from "node:crypto";
import { z } from "zod";
import { contentPublicConfig } from "@/src/config/site";
import { createAdminSupabaseClient } from "@/src/lib/supabase/admin";
import { hasAdminSupabaseConfig } from "@/src/lib/supabase/config";

const buckets = new Map<string, number[]>();
const windowMs = 10 * 60 * 1000;
const maxAttempts = 5;

const schema = z.object({
  email: z.string().trim().email().max(254),
  topic: z.string().trim().max(120).optional(),
  sourcePath: z.string().trim().max(300).optional(),
  consent: z.literal("on", { error: "Consent is required." }),
  website: z.string().max(0).optional(),
});

export type SubscribeState = { ok: boolean; message: string };

function limited(key: string) {
  const now = Date.now();
  const recent = (buckets.get(key) ?? []).filter((stamp) => now - stamp < windowMs);
  if (recent.length >= maxAttempts) return true;
  recent.push(now);
  buckets.set(key, recent);
  return false;
}

function tokenFor(email: string) {
  return createHash("sha256").update(`${email}:${randomBytes(24).toString("hex")}`).digest("hex");
}

export async function subscribeToContentUpdates(_previous: SubscribeState, formData: FormData): Promise<SubscribeState> {
  if (!contentPublicConfig.subscriptionsEnabled) {
    return { ok: false, message: "Subscriptions are not enabled for this site." };
  }
  if (!hasAdminSupabaseConfig()) {
    return { ok: false, message: "Subscription storage is not configured yet." };
  }
  const raw = Object.fromEntries(formData.entries());
  const parsed = schema.safeParse(raw);
  if (!parsed.success) {
    return { ok: false, message: parsed.error.issues[0]?.message ?? "Enter a valid email and consent." };
  }
  if (parsed.data.website) return { ok: true, message: "Thanks. Your request has been received." };
  const email = parsed.data.email.toLowerCase();
  if (limited(email)) return { ok: false, message: "Please wait a few minutes before trying again." };

  const supabase = createAdminSupabaseClient();
  const payload = {
    email,
    status: "active",
    source_path: parsed.data.sourcePath || null,
    subscription_topic: parsed.data.topic || "Agribusiness updates",
    consent_text: "I agree to receive agribusiness updates from this site. I can unsubscribe later.",
    consented_at: new Date().toISOString(),
    unsubscribe_token: tokenFor(email),
    attribution: null,
  };
  const { error } = await supabase.from("content_subscribers").upsert(payload, { onConflict: "email" });
  if (error) {
    if (["42P01", "42703", "PGRST204", "PGRST205"].includes(error.code ?? "")) {
      return { ok: false, message: "Subscription tables are not migrated yet." };
    }
    return { ok: false, message: "We could not save your subscription right now." };
  }
  return { ok: true, message: "You are subscribed. No messages will be sent until updates are configured." };
}
