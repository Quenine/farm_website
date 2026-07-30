import assert from "node:assert/strict";
import test from "node:test";
import { handoverStatuses, outreachStatuses, prospectPlatforms, scoutStatuses } from "../src/lib/sales-scout/domain.ts";
import {
  canonicalizeWebsiteHostname, normalizeBusinessName, normalizeLocationComparison,
  normalizeNigerianPhone, normalizeSocialIdentity,
} from "../src/lib/sales-scout/normalization.ts";
import {
  salesScoutScoringRuleVersion, scoreSalesScoutProspect,
  type SalesScoutScoringInput,
} from "../src/lib/sales-scout/scoring.ts";
import {
  calculateNextFollowUpDueDate, canAttemptOutreach, hasReachedMaximumAttempts,
  isFutureOutreachCancelled, sentAttemptCount,
} from "../src/lib/sales-scout/follow-ups.ts";
import { isSalesScoutDeploymentEnabled } from "../src/lib/sales-scout/access-policy.ts";
import { createManualDiscoveryProvider, createManualDiscoveryResult } from "../src/lib/sales-scout/discovery/manual.ts";
import { findSoftMatchWarnings, prepareDiscoveryCandidate } from "../src/lib/sales-scout/ingestion.ts";
import { discoveryCandidateSchema } from "../src/lib/sales-scout/schemas.ts";
import { campaignStatusSchema, doNotContactSchema, formatSalesScoutTimelineEvent, allowedResolutionChoices, parseQueueFilters, reviewTransitionSchema } from "../src/lib/sales-scout/review.ts";
import { qualificationFactsSchema } from "../src/lib/sales-scout/schemas.ts";

test("domain constants contain approved immutable values", () => {
  assert.deepEqual(scoutStatuses, ["new", "researching", "qualified", "disqualified", "engaged", "converted", "closed", "do_not_contact"]);
  assert.equal(outreachStatuses.length, 7);
  assert.equal(handoverStatuses.length, 6);
  assert.deepEqual(prospectPlatforms.slice(0, 5), ["instagram", "facebook", "tiktok", "x", "youtube"]);
  assert.equal(Object.isFrozen(scoutStatuses), true);
});

test("normalizes social handles and profile URLs", () => {
  assert.deepEqual(normalizeSocialIdentity(" @Shield_Farms ", "instagram"), { platform: "instagram", identity: "shield_farms" });
  assert.deepEqual(normalizeSocialIdentity("https://instagram.com/Shields.Farms/?hl=en#bio"), { platform: "instagram", identity: "shields.farms" });
  assert.deepEqual(normalizeSocialIdentity("https://x.com/ShieldsFarms/"), { platform: "x", identity: "shieldsfarms" });
  assert.deepEqual(normalizeSocialIdentity("https://twitter.com/ShieldsFarms?lang=en"), { platform: "x", identity: "shieldsfarms" });
  assert.equal(normalizeSocialIdentity("https://instagram.com/p/abc123"), null);
  assert.equal(normalizeSocialIdentity("https://x.com/user/status/123"), null);
  assert.equal(normalizeSocialIdentity("not a handle", "instagram"), null);
});

test("normalizes Nigerian telephone forms and rejects malformed values", () => {
  for (const value of ["07032821293", "7032821293", "2347032821293", "+2347032821293", "0703 282-1293", "(0703) 282 1293"])
    assert.equal(normalizeNigerianPhone(value), "+2347032821293");
  assert.equal(normalizeNigerianPhone("07032"), null);
  assert.equal(normalizeNigerianPhone("+234 703 282 1293 ext 2"), null);
  assert.equal(normalizeNigerianPhone("12345678901"), null);
});

test("normalizes website, business, and location identities", () => {
  assert.equal(canonicalizeWebsiteHostname("https://WWW.Example.COM:443/menu?q=1#top"), "example.com");
  assert.equal(canonicalizeWebsiteHostname("http://example.com:80/path/"), "example.com");
  assert.equal(canonicalizeWebsiteHostname("https://instagram.com/shields"), null);
  assert.equal(canonicalizeWebsiteHostname("not a website"), null);
  assert.equal(normalizeBusinessName("  Àdì's—Kitchen, LIMITED  "), "àdì s kitchen");
  assert.equal(normalizeBusinessName("Farm Trading House"), "farm trading house");
  assert.equal(normalizeLocationComparison(" Abuja,  FCT "), "abuja fct");
});

const base: SalesScoutScoringInput = {
  campaignCity: "Lagos", campaignCountry: "Nigeria", businessCategory: "Restaurant",
  allowedCampaignCategories: ["Restaurant", "Caterer", "Hotel", "Supermarket", "Food Vendor"],
  businessCity: "Lagos", businessCountry: "Nigeria", serviceAreaCities: [],
  mostRecentPublicActivityAt: "2026-04-02T12:00:00.000Z",
  hasRecurringProduceDemandEvidence: true, publicContactRoutes: ["instagram"],
  demandBand: "high", isInactiveOrClosed: false, isConsumerOnly: false,
  doNotContact: false, scoredAt: "2026-07-01T12:00:00.000Z",
};

test("scoring is deterministic, clamped, and complete", () => {
  const first = scoreSalesScoutProspect(base);
  assert.equal(first.score, 100);
  assert.equal(first.qualified, true);
  assert.equal(first.ruleVersion, salesScoutScoringRuleVersion);
  assert.equal(first.factors.length, 9);
  assert.deepEqual(first, scoreSalesScoutProspect({ ...base }));
});

test("qualifies at the exact score threshold", () => {
  const result = scoreSalesScoutProspect({
    ...base, mostRecentPublicActivityAt: null,
    hasRecurringProduceDemandEvidence: false, demandBand: "medium",
  });
  assert.equal(result.score, 60);
  assert.equal(result.qualified, true);
});

test("handles generic campaign geography and service evidence", () => {
  const wrongCity = scoreSalesScoutProspect({ ...base, businessCity: "Ibadan" });
  assert.equal(wrongCity.factors.find((factor) => factor.key === "outside_campaign_geography")?.points, -25);
  assert.equal(wrongCity.qualified, false);
  const servesCity = scoreSalesScoutProspect({ ...base, businessCity: "Ibadan", serviceAreaCities: ["Lagos"] });
  assert.equal(servesCity.qualified, true);
  assert.equal(servesCity.factors.find((factor) => factor.key === "outside_campaign_geography")?.points, 0);
  assert.equal(scoreSalesScoutProspect({ ...base, campaignCity: "Abuja", businessCity: "Abuja" }).qualified, true);
});

test("qualification rejects inactive, consumer-only, and do-not-contact prospects", () => {
  const inactive = scoreSalesScoutProspect({ ...base, isInactiveOrClosed: true });
  assert.equal(inactive.score, 60);
  assert.ok(inactive.qualificationFailures.includes("inactive_or_closed"));
  assert.ok(scoreSalesScoutProspect({ ...base, isConsumerOnly: true }).qualificationFailures.includes("consumer_only"));
  const suppressed = scoreSalesScoutProspect({ ...base, doNotContact: true });
  assert.equal(suppressed.score, 100);
  assert.equal(suppressed.qualified, false);
  assert.ok(suppressed.qualificationFailures.includes("do_not_contact"));
});

test("includes the exact ninety-day activity boundary", () => {
  assert.equal(scoreSalesScoutProspect(base).factors.find((factor) => factor.key === "recent_public_activity")?.points, 15);
  const outside = scoreSalesScoutProspect({ ...base, mostRecentPublicActivityAt: "2026-04-02T11:59:59.999Z" });
  assert.equal(outside.factors.find((factor) => factor.key === "recent_public_activity")?.points, 0);
});

test("calculates UTC calendar-day follow-up dates across DST boundaries", () => {
  assert.equal(calculateNextFollowUpDueDate(1, "2026-03-07T23:30:00-05:00"), "2026-03-11T04:30:00.000Z");
  assert.equal(calculateNextFollowUpDueDate(2, "2026-10-31T23:30:00-04:00"), "2026-11-08T03:30:00.000Z");
  assert.equal(calculateNextFollowUpDueDate(3, "2026-01-01T00:00:00Z"), null);
});

test("counts confirmed sends and enforces sequence and attempt limits", () => {
  const drafts = [{ sequence: 1, status: "draft" as const }, { sequence: 2, status: "approved" as const }];
  assert.equal(sentAttemptCount(drafts), 0);
  assert.equal(canAttemptOutreach({ sequence: 1, attempts: drafts, scoutStatus: "qualified", doNotContact: false, hasReply: false }).allowed, true);
  assert.equal(canAttemptOutreach({ sequence: 2, attempts: drafts, scoutStatus: "qualified", doNotContact: false, hasReply: false }).reason, "previous_sequence_not_sent");
  const sent = [1, 2, 3].map((sequence) => ({ sequence, status: "sent" as const }));
  assert.equal(hasReachedMaximumAttempts(sent), true);
  assert.equal(canAttemptOutreach({ sequence: 3, attempts: sent, scoutStatus: "qualified", doNotContact: false, hasReply: false }).reason, "maximum_attempts_reached");
  assert.equal(canAttemptOutreach({ sequence: 4, attempts: [], scoutStatus: "qualified", doNotContact: false, hasReply: false }).reason, "invalid_sequence");
});

test("reply, do-not-contact, and terminal statuses cancel future outreach", () => {
  assert.equal(isFutureOutreachCancelled({ scoutStatus: "engaged", doNotContact: false, hasReply: true }), true);
  assert.equal(isFutureOutreachCancelled({ scoutStatus: "qualified", doNotContact: true, hasReply: false }), true);
  for (const scoutStatus of ["disqualified", "converted", "closed"] as const) {
    assert.equal(isFutureOutreachCancelled({ scoutStatus, doNotContact: false, hasReply: false }), true);
    assert.equal(canAttemptOutreach({ sequence: 1, attempts: [], scoutStatus, doNotContact: false, hasReply: false }).reason, "suppressed");
  }
});

const campaign = {
  campaignId: "11111111-1111-4111-8111-111111111111", city: "Lagos", state: "Lagos", country: "Nigeria",
  targetCategories: ["Restaurant", "Caterer", "Hotel", "Supermarket", "Food Vendor"],
};
const candidate = {
  sourceUrl: "https://www.instagram.com/scout_kitchen/", observedAt: "2026-07-29T12:00:00+01:00",
  campaignId: campaign.campaignId, businessName: "Scout Kitchen Limited", businessCategory: "Restaurant",
  city: "Lagos", state: "Lagos", country: "Nigeria", serviceAreaCities: [],
  mostRecentPublicActivityAt: "2026-07-20T12:00:00+01:00",
  recurringProduceDemandEvidence: "Public menu shows recurring fresh-produce use.",
  demandBand: "medium" as const, isInactiveOrClosed: false, isConsumerOnly: false,
  channels: [{ platform: "instagram" as const, handleOrValue: "@Scout_Kitchen",
    profileUrl: "https://www.instagram.com/scout_kitchen/", isPrimary: true, sourceId: "manual-row-1",
    evidence: { label: "public profile" } }],
};

test("manual discovery reports row-level schema errors without network work", async () => {
  const result = createManualDiscoveryResult([{ ...candidate }, { ...candidate, sourceUrl: "", observedAt: "not-a-time", channels: [] }]);
  assert.equal(result.ok, false);
  assert.equal(result.candidates.length, 1);
  if (!result.ok) {
    assert.ok(result.errors.some((issue) => issue.candidateIndex === 1 && issue.field === "sourceUrl"));
    assert.ok(result.errors.some((issue) => issue.candidateIndex === 1 && issue.field === "observedAt"));
    assert.ok(result.errors.some((issue) => issue.candidateIndex === 1 && issue.field === "channels"));
  }
  const provider = createManualDiscoveryProvider([candidate]);
  assert.equal(provider.name, "manual");
  assert.equal((await provider.discover()).ok, true);
});

test("candidate preparation normalizes, collapses duplicates, and scores campaign-city presence", () => {
  const prepared = prepareDiscoveryCandidate({ ...candidate, provider: "manual", channels: [
    candidate.channels[0], { ...candidate.channels[0], handleOrValue: "scout_kitchen", isPrimary: false },
  ] }, campaign);
  assert.equal(prepared.channels.length, 1);
  assert.equal(prepared.channels[0].identityKey, "scout_kitchen");
  assert.equal(prepared.channels[0].isPrimary, true);
  assert.deepEqual(prepared.exactLookupKeys, ["instagram:scout_kitchen"]);
  assert.equal(prepared.score.qualified, true);
  assert.equal(prepared.score.ruleVersion, "ng-city-b2b-v1");
  assert.equal(Array.isArray(prepared.score.factors), true);
  assert.ok(prepared.score.factors.some((factor) => factor.key === "campaign_city_presence" && factor.applied));
});

test("candidate preparation rejects a campaign mismatch before persistence", () => {
  assert.throws(() => prepareDiscoveryCandidate({
    ...candidate,
    provider: "manual",
    campaignId: "44444444-4444-4444-8444-444444444444",
  }, campaign), /does not match the selected campaign/);
});

test("candidate preparation rejects conflicting primary identities", () => {
  assert.throws(() => prepareDiscoveryCandidate({ ...candidate, provider: "manual", channels: [
    candidate.channels[0], { ...candidate.channels[0], handleOrValue: "@different_scout",
      profileUrl: "https://www.instagram.com/different_scout/", sourceId: "manual-row-2" },
  ] }, campaign), /conflicting primary channels/);
});

test("soft duplicate warnings are deterministic and do not silently merge", () => {
  const prepared = prepareDiscoveryCandidate({ ...candidate, provider: "manual" }, campaign);
  assert.deepEqual(findSoftMatchWarnings(prepared, [{ id: "22222222-2222-4222-8222-222222222222",
    businessName: "Scout Kitchen Ltd", businessCategory: "Restaurant", city: "Lagos", country: "Nigeria" }]),
  [{ prospectId: "22222222-2222-4222-8222-222222222222", reason: "same_name_location" }]);
});

test("candidate schema rejects server-owned fields", () => {
  for (const serverOwned of [{ actorId: "33333333-3333-4333-8333-333333333333" }, { score: 100 },
    { doNotContactAt: "2026-07-29T12:00:00+01:00" }]) {
    assert.equal(discoveryCandidateSchema.safeParse({ ...candidate, provider: "manual", ...serverOwned }).success, false);
  }
});

test("rollout policy requires the private flag and an exact Shields hostname", () => {
  assert.equal(isSalesScoutDeploymentEnabled({ enabledFlag: true, canonicalHostname: "shieldsfarms.store" }), true);
  assert.equal(isSalesScoutDeploymentEnabled({ enabledFlag: true, canonicalHostname: "www.shieldsfarms.store" }), true);
  assert.equal(isSalesScoutDeploymentEnabled({ enabledFlag: false, canonicalHostname: "shieldsfarms.store" }), false);
  assert.equal(isSalesScoutDeploymentEnabled({ enabledFlag: true, canonicalHostname: "noblefarms.example" }), false);
});

test("queue filters parse and enforce pagination bounds", () => {
  assert.deepEqual(parseQueueFilters({ page: "2", pageSize: "50", sort: "highest_score", minimumScore: "60" }), { page: 2, pageSize: 50, sort: "highest_score", minimumScore: 60 });
  assert.equal(parseQueueFilters({}).page, 1);
  assert.throws(() => parseQueueFilters({ pageSize: "51" }));
  assert.throws(() => parseQueueFilters({ page: "0" }));
});

test("review and campaign schemas enforce owner-controlled statuses", () => {
  assert.equal(reviewTransitionSchema.safeParse({ prospectId: campaign.campaignId, targetStatus: "researching" }).success, true);
  assert.equal(reviewTransitionSchema.safeParse({ prospectId: campaign.campaignId, targetStatus: "disqualified" }).success, false);
  assert.equal(reviewTransitionSchema.safeParse({ prospectId: campaign.campaignId, targetStatus: "engaged" }).success, false);
  assert.equal(campaignStatusSchema.safeParse({ campaignId: campaign.campaignId, status: "paused" }).success, true);
  assert.equal(campaignStatusSchema.safeParse({ campaignId: campaign.campaignId, status: "deleted" }).success, false);
});

test("suppression and qualification schemas reject incomplete or server-owned input", () => {
  assert.equal(doNotContactSchema.safeParse({ prospectId: campaign.campaignId, reason: "", source: "owner" }).success, false);
  assert.equal(doNotContactSchema.safeParse({ prospectId: campaign.campaignId, reason: "Owner decision", source: "" }).success, false);
  const facts = { prospectId: campaign.campaignId, campaignId: campaign.campaignId, businessCategory: "Restaurant", city: "Lagos", state: "Lagos", country: "Nigeria", serviceAreaCities: [], mostRecentPublicActivityAt: null, recurringProduceDemandEvidence: null, demandBand: "medium", isInactiveOrClosed: false, isConsumerOnly: false, sourceUrl: "https://example.com", locationEvidence: {} };
  assert.equal(qualificationFactsSchema.safeParse({ ...facts, score: 100 }).success, false);
  assert.equal(qualificationFactsSchema.safeParse({ ...facts, actorId: campaign.campaignId }).success, false);
});

test("timeline labels and duplicate choices are safe and explicit", () => {
  assert.equal(formatSalesScoutTimelineEvent({ event: "scout_scored", secret: "ignored" }), "Qualification updated");
  assert.equal(formatSalesScoutTimelineEvent({ event: "unknown_event" }), "Sales Scout activity");
  assert.deepEqual(allowedResolutionChoices({ exactIds: ["one"], softIds: ["two"] }), [{ choice: "attach_to_existing", prospectId: "one" }]);
  assert.deepEqual(allowedResolutionChoices({ exactIds: [], softIds: ["two"] }), [{ choice: "create_new" }, { choice: "attach_to_existing", prospectId: "two" }]);
});
