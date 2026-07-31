"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireAdmin } from "@/src/lib/admin-auth";
import { requireSalesScoutDiscoveryEnabled } from "@/src/lib/sales-scout/access";
import {
  captureStagedSalesScoutCandidate,
  dismissSalesScoutDiscoveryCandidate,
  runSalesScoutDiscovery,
  SalesScoutDiscoveryError,
} from "@/src/lib/sales-scout/discovery/server";

export type DiscoveryActionState = {
  ok: boolean;
  message: string;
  reference?: string;
  data?: Record<string, unknown>;
};

export const initialDiscoveryActionState: DiscoveryActionState = { ok: false, message: "" };
const uuid = z.uuid();

async function guard() {
  await requireAdmin();
  requireSalesScoutDiscoveryEnabled();
}

function refresh(candidateId?: string) {
  revalidatePath("/admin/marketing/sales-scout");
  revalidatePath("/admin/marketing/sales-scout/discover");
  if (candidateId) revalidatePath(`/admin/marketing/sales-scout/discover/${candidateId}`);
}

function safeFailure(error: unknown, fallback: string): DiscoveryActionState {
  const reference = error instanceof SalesScoutDiscoveryError ? error.reference : fallback;
  console.error("Sales Scout discovery action failed", {
    reference,
    name: error instanceof Error ? error.name : "UnknownError",
  });
  return { ok: false, message: "The operation could not be completed.", reference };
}

export async function runDiscoveryAction(
  _state: DiscoveryActionState,
  formData: FormData,
): Promise<DiscoveryActionState> {
  try {
    await guard();
    z.literal("yes").parse(formData.get("confirmed"));
    const campaignId = uuid.parse(formData.get("campaignId"));
    const summary = await runSalesScoutDiscovery({ campaignId });
    refresh();
    return {
      ok: true,
      message: "Discovery completed. No outreach was sent.",
      data: { ...summary },
    };
  } catch (error) {
    return safeFailure(error, "DISCOVERY_RUN_ACTION");
  }
}

export async function dismissDiscoveryCandidateAction(
  _state: DiscoveryActionState,
  formData: FormData,
): Promise<DiscoveryActionState> {
  try {
    await guard();
    const value = z
      .object({
        candidateId: uuid,
        reason: z.string().trim().min(3).max(500),
      })
      .parse(Object.fromEntries(formData));
    const result = await dismissSalesScoutDiscoveryCandidate(value);
    refresh(value.candidateId);
    return {
      ok: true,
      message: result.idempotent ? "Candidate was already dismissed." : "Candidate dismissed.",
      data: { candidateId: value.candidateId },
    };
  } catch (error) {
    return safeFailure(error, "DISCOVERY_DISMISS_ACTION");
  }
}

export async function captureDiscoveryCandidateAction(
  _state: DiscoveryActionState,
  formData: FormData,
): Promise<DiscoveryActionState> {
  try {
    await guard();
    const candidateId = uuid.parse(formData.get("candidateId"));
    const resolution = JSON.parse(z.string().max(2000).parse(formData.get("resolution"))) as unknown;
    const result = await captureStagedSalesScoutCandidate({ candidateId, resolution });
    refresh(candidateId);
    return {
      ok: true,
      message: "Candidate captured.",
      data: { candidateId, prospectId: result.prospectId },
    };
  } catch (error) {
    return safeFailure(error, "DISCOVERY_CAPTURE_ACTION");
  }
}
