import assert from "node:assert/strict";
import test from "node:test";
import {
  buildManualHandoff,
  generateDeterministicOutreachDraft,
  nextFollowUpAt,
  nextOutreachSequence,
  recommendOutreachChannels,
} from "../src/lib/sales-scout/outreach.ts";

const facts = {
  businessName: "Example Hotel",
  businessCategory: "Hotel",
  city: "Lagos",
  state: "Lagos",
  productScope: "fresh chicken and vegetables",
  deliverySummary: "Delivery depends on confirmed logistics",
};

test("deterministic initial draft contains no fabricated commercial promises", () => {
  const draft = generateDeterministicOutreachDraft({ sequenceNumber: 1, ...facts });
  assert.match(draft, /Shields Farms/);
  assert.match(draft, /who handles produce purchasing/i);
  assert.match(draft, /quantity, destination and logistics confirmation/i);
  assert.doesNotMatch(draft, /guaranteed|minimum order|in stock|free delivery|buyer name/i);
});

test("outreach sequencing waits for no-response and stops on terminal states", () => {
  assert.equal(nextOutreachSequence([]), 1);
  assert.equal(nextOutreachSequence([{ sequence_number: 1, status: "draft" }]), 1);
  assert.equal(nextOutreachSequence([{ sequence_number: 1, status: "approved" }]), null);
  assert.equal(nextOutreachSequence([{ sequence_number: 1, status: "sent" }]), null);
  assert.equal(nextOutreachSequence([{ sequence_number: 1, status: "no_response" }]), 2);
  assert.equal(nextOutreachSequence([
    { sequence_number: 1, status: "no_response" },
    { sequence_number: 2, status: "no_response" },
  ]), 3);
  for (const status of ["replied", "cancelled", "blocked"]) {
    assert.equal(nextOutreachSequence([{ sequence_number: 1, status }]), null);
  }
  assert.equal(nextOutreachSequence([
    { sequence_number: 1, status: "no_response" },
    { sequence_number: 2, status: "no_response" },
    { sequence_number: 3, status: "no_response" },
  ]), null);
  const sent = new Date("2026-08-02T00:00:00Z");
  assert.equal(nextFollowUpAt(1, sent)?.toISOString(), "2026-08-05T00:00:00.000Z");
  assert.equal(nextFollowUpAt(2, sent)?.toISOString(), "2026-08-06T00:00:00.000Z");
  assert.equal(nextFollowUpAt(3, sent), null);
});

test("channel recommendation and handoffs are safely encoded", () => {
  const channels = recommendOutreachChannels([
    { id: "1", platform: "email", handleOrValue: "sales@example.com", profileUrl: null, active: true },
    { id: "2", platform: "whatsapp", handleOrValue: "07032821293", profileUrl: null, active: true },
    { id: "3", platform: "website", handleOrValue: "https://example.com", profileUrl: "https://example.com", active: true },
  ]);
  assert.deepEqual(channels.map((item) => item.platform), ["whatsapp", "email"]);
  const message = "Hello & welcome?";
  assert.match(buildManualHandoff({
    platform: "whatsapp", value: "07032821293", profileUrl: null, message,
  }) ?? "", /text=Hello%20%26%20welcome%3F/);
  assert.match(buildManualHandoff({
    platform: "email", value: "sales@example.com", profileUrl: null, message,
  }) ?? "", /^mailto:/);
  assert.match(buildManualHandoff({
    platform: "phone", value: "07032821293", profileUrl: null, message,
  }) ?? "", /^tel:/);
});
