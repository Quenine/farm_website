import { manualCandidateInputSchema } from "../schemas.ts";
import type {
  DiscoveryCandidate,
  DiscoveryIssue,
  DiscoveryResult,
} from "./types.ts";

export function createManualDiscoveryResult(rows: readonly unknown[]): DiscoveryResult {
  const candidates: DiscoveryCandidate[] = [];
  const errors: DiscoveryIssue[] = [];
  rows.forEach((row, candidateIndex) => {
    const parsed = manualCandidateInputSchema.safeParse(row);
    if (parsed.success) {
      candidates.push({ ...parsed.data, provider: "manual" });
      return;
    }
    parsed.error.issues.forEach((issue) => {
      errors.push({
        candidateIndex,
        field: issue.path.join(".") || undefined,
        message: issue.message,
      });
    });
  });
  return errors.length ? { ok: false, candidates, errors } : { ok: true, candidates };
}

export function createManualDiscoveryProvider(rows: readonly unknown[]) {
  return {
    name: "manual",
    async discover(): Promise<DiscoveryResult> {
      return createManualDiscoveryResult(rows);
    },
  };
}
