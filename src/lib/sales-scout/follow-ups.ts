import type { OutreachStatus, ScoutStatus } from "./domain.ts";

export const maximumOutreachSequence = 3;
const terminalScoutStatuses = new Set<ScoutStatus>([
  "disqualified", "converted", "closed", "do_not_contact",
]);
export type OutreachAttempt = { sequence: number; status: OutreachStatus };
export type OutreachEligibility = {
  allowed: boolean;
  reason: "allowed" | "invalid_sequence" | "suppressed" | "reply_recorded"
    | "maximum_attempts_reached" | "sequence_already_sent" | "previous_sequence_not_sent";
};

export function isProspectSuppressed(status: ScoutStatus, doNotContact: boolean) {
  return doNotContact || terminalScoutStatuses.has(status);
}
export function sentAttemptCount(attempts: readonly OutreachAttempt[]) {
  return attempts.filter(({ status }) => status === "sent" || status === "replied").length;
}
export function hasReachedMaximumAttempts(attempts: readonly OutreachAttempt[]) {
  return sentAttemptCount(attempts) >= maximumOutreachSequence;
}
export function isFutureOutreachCancelled(input: {
  scoutStatus: ScoutStatus; doNotContact: boolean; hasReply: boolean;
}) {
  return input.hasReply || isProspectSuppressed(input.scoutStatus, input.doNotContact);
}
export function canAttemptOutreach(input: {
  sequence: number;
  attempts: readonly OutreachAttempt[];
  scoutStatus: ScoutStatus;
  doNotContact: boolean;
  hasReply: boolean;
}): OutreachEligibility {
  if (!Number.isInteger(input.sequence) || input.sequence < 1 || input.sequence > 3)
    return { allowed: false, reason: "invalid_sequence" };
  if (isProspectSuppressed(input.scoutStatus, input.doNotContact))
    return { allowed: false, reason: "suppressed" };
  if (input.hasReply) return { allowed: false, reason: "reply_recorded" };
  if (hasReachedMaximumAttempts(input.attempts))
    return { allowed: false, reason: "maximum_attempts_reached" };
  if (input.attempts.some(({ sequence, status }) =>
    sequence === input.sequence && (status === "sent" || status === "replied")))
    return { allowed: false, reason: "sequence_already_sent" };
  if (input.sequence > 1 && !input.attempts.some(({ sequence, status }) =>
    sequence === input.sequence - 1 && (status === "sent" || status === "replied")))
    return { allowed: false, reason: "previous_sequence_not_sent" };
  return { allowed: true, reason: "allowed" };
}

// Calendar days use the UTC calendar while preserving UTC time of day. Results
// therefore do not depend on the server locale or daylight-saving transitions.
export function calculateNextFollowUpDueDate(
  confirmedSequence: number,
  confirmedSentAt: string | Date,
): string | null {
  if (confirmedSequence === 3) return null;
  if (confirmedSequence !== 1 && confirmedSequence !== 2)
    throw new Error("Confirmed outreach sequence must be 1, 2, or 3.");
  const sentAt = new Date(confirmedSentAt);
  if (Number.isNaN(sentAt.getTime())) throw new Error("Invalid confirmed send timestamp.");
  const dueAt = new Date(sentAt);
  dueAt.setUTCDate(dueAt.getUTCDate() + (confirmedSequence === 1 ? 3 : 7));
  return dueAt.toISOString();
}
