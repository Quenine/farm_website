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
