import type { ProspectPlatform } from "../domain.ts";
import type { DemandBand } from "../scoring.ts";

export type DiscoveryChannel = {
  platform: ProspectPlatform;
  handleOrValue: string;
  profileUrl?: string;
  isPrimary?: boolean;
  sourceId?: string;
  evidence: Record<string, unknown>;
};

export type DiscoveryCandidate = {
  provider: string;
  providerSourceId?: string;
  sourceUrl: string;
  observedAt: string;
  campaignId: string;
  businessName: string;
  businessCategory: string;
  city: string;
  state?: string;
  country: string;
  publicDescription?: string;
  serviceAreaCities: string[];
  mostRecentPublicActivityAt?: string;
  recurringProduceDemandEvidence?: string;
  demandBand: DemandBand;
  isInactiveOrClosed: boolean;
  isConsumerOnly: boolean;
  channels: DiscoveryChannel[];
};

export type DiscoveryQuery = {
  campaignId: string;
  cursor?: string;
  limit?: number;
};

export type DiscoveryIssue = {
  candidateIndex: number;
  field?: string;
  message: string;
};

export type DiscoveryResult =
  | { ok: true; candidates: DiscoveryCandidate[]; nextCursor?: string }
  | { ok: false; candidates: DiscoveryCandidate[]; errors: DiscoveryIssue[] };

export interface ProspectDiscoveryProvider {
  readonly name: string;
  discover(query: DiscoveryQuery): Promise<DiscoveryResult>;
}

