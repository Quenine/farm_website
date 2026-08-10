import type { TerritoryMatchEvidence } from "../territory.ts";
import type { PublicContact } from "./production.ts";
import type { ResearchCandidate } from "./types.ts";

export const NIGERIA_OPPORTUNITY_SCORE_VERSION = "ng-revenue-v2" as const;

export type OpportunityFactor = {
  key: string;
  points: number;
  kind: "fact" | "inference";
  reason: string;
};

export type OpportunityAssessment = {
  score: number;
  scoreVersion: typeof NIGERIA_OPPORTUNITY_SCORE_VERSION;
  confidence: "high" | "medium" | "low";
  factors: OpportunityFactor[];
  facts: string[];
  inferences: string[];
  whyPursue: string;
  productAngles: string[];
  recommendedNextAction: string;
};

export function canBecomeOutreachReady(input:{baseReady:boolean;doNotContact?:boolean;currentCustomer?:boolean}) {
  return input.baseReady && !input.doNotContact && !input.currentCustomer;
}

export function reflectOwnerConfirmedContact(
  assessment: OpportunityAssessment,
  route?: PublicContact["route"],
) {
  if (assessment.factors.some((factor)=>factor.key==="do_not_contact"&&factor.points<0)) return assessment;
  const factors=assessment.factors.map((factor)=>factor.key==="public_contactability"
    ? {...factor,points:Math.max(13, factor.points),
      reason:"At least one direct public contact route was explicitly confirmed by the owner."}:factor);
  const confirmedRoute = route && route !== "website" ? route : null;
  return {...assessment,factors,score:Math.max(0,Math.min(100,factors.reduce((total,factor)=>total+factor.points,0))),
    confidence:assessment.confidence==="low"?"medium":assessment.confidence,
    recommendedNextAction:confirmedRoute
      ? `Owner should capture and qualify the prospect, then prepare an editable ${confirmedRoute} outreach draft.`
      : "Owner should capture and qualify the prospect, then prepare an editable manual outreach draft."};
}

const targetFit: Record<string, { category: number; produce: number; recurring: number; angle: string[] }> = {
  Restaurant: { category: 16, produce: 8, recurring: 6,
    angle: ["Reliable restaurant-grade vegetables", "Planned recurring fresh-produce delivery"] },
  Hotel: { category: 15, produce: 7, recurring: 6,
    angle: ["Consistent kitchen produce supply", "Scheduled delivery for food-service operations"] },
  Supermarket: { category: 15, produce: 8, recurring: 6,
    angle: ["Fresh produce for retail shelves", "Reliable replenishment and seasonal availability"] },
};

function preferredRoute(contacts: PublicContact[]) {
  const ordered = ["whatsapp", "phone", "instagram", "facebook", "email", "tiktok", "x", "youtube"];
  return contacts.filter((contact) => contact.route !== "website").sort((left, right) =>
    ordered.indexOf(left.route) - ordered.indexOf(right.route) ||
    Number(right.confidence === "verified") - Number(left.confidence === "verified")
  )[0];
}

export function assessNigeriaOpportunity(input: {
  candidate: ResearchCandidate;
  contacts: PublicContact[];
  territoryMatch: TerritoryMatchEvidence;
  duplicate?: boolean;
  currentCustomer?: boolean;
  doNotContact?: boolean;
}): OpportunityAssessment {
  const { candidate, contacts, territoryMatch } = input;
  const fit = targetFit[candidate.requestedCategory] ??
    { category: 7, produce: 3, recurring: 3, angle: [] };
  const directContacts = contacts.filter((contact) => contact.route !== "website");
  const verifiedContacts = directContacts.filter((contact) =>
    contact.confidence === "verified").length;
  const contactPoints = verifiedContacts >= 2
    ? 16 : verifiedContacts === 1
      ? 13 : directContacts.length >= 2 ? 11 : directContacts.length ? 8 : 0;
  const businessSpecificEvidenceFields = new Set([
    "businessName", "phone", "email", "whatsapp", "instagram", "facebook", "tiktok",
    "x", "youtube", "website", "address", "publicDescription", "schemaType",
    "multiLocation", "cateringService", "commercialScale", "institutionalSupply",
  ]);
  const businessSpecificSources = new Set(candidate.evidence
    .filter((item) =>
      item.verificationStatus === "verified" &&
      businessSpecificEvidenceFields.has(item.field))
    .map((item) => item.source));
  const evidencePoints = Math.min(8, businessSpecificSources.size * 2);
  const multiLocation = candidate.evidence.some((item) =>
    item.field === "multiLocation" && item.verificationStatus === "verified" &&
    !["false", "no", "0"].includes(item.value.toLowerCase()));
  const cateringService = candidate.evidence.some((item) =>
    item.field === "cateringService" && item.verificationStatus === "verified" &&
    !["false", "no", "0"].includes(item.value.toLowerCase()));
  const otherCommercialScale = candidate.evidence.some((item) =>
    ["commercialScale", "institutionalSupply"].includes(item.field) &&
    item.verificationStatus === "verified" &&
    !["false", "no", "0"].includes(item.value.toLowerCase()));
  const factors: OpportunityFactor[] = [
    { key: "target_category_fit", points: fit.category, kind: "fact",
      reason: `${candidate.requestedCategory} is a configured Shields Farms target category.` },
    { key: "fresh_produce_relevance", points: fit.produce, kind: "inference",
      reason: `${candidate.requestedCategory} operations generally use fresh produce; no purchasing volume is assumed.` },
    { key: "recurring_purchase_likelihood", points: fit.recurring, kind: "inference",
      reason: `${candidate.requestedCategory} operations generally replenish food inputs; procurement behaviour is not verified.` },
    { key: "territory_delivery_fit", points: territoryMatch.matched ? 18 : 0, kind: "fact",
      reason: territoryMatch.matched ? `Business identity is matched to the campaign territory by ${territoryMatch.basis.replaceAll("_", " ")}.` : "Campaign territory is not verified." },
    { key: "public_contactability", points: contactPoints, kind: "fact",
      reason: verifiedContacts ? `${verifiedContacts} verified direct public contact route(s) are available.` : directContacts.length ? `${directContacts.length} plausible direct public contact route(s) require owner review.` : "No direct public contact route is available." },
    { key: "evidence_quality", points: evidencePoints, kind: "fact",
      reason: `Verified business-specific evidence is retained from ${businessSpecificSources.size} source type(s); reference-only pages do not add points.` },
    { key: "multi_location_scale_proxy", points: multiLocation ? 12 : 0, kind: "inference",
      reason: multiLocation ? "Public evidence indicates multiple locations, a limited scale proxy." : "No verified multi-location signal is available." },
    { key: "catering_service_scale_proxy", points: cateringService ? 6 : 0, kind: "inference",
      reason: cateringService ? "Verified public evidence indicates a catering service, a limited commercial-scale proxy." : "No verified catering-service signal is available." },
    { key: "other_commercial_scale_proxy", points: otherCommercialScale ? 6 : 0, kind: "inference",
      reason: otherCommercialScale ? "Verified public evidence supports an additional commercial-scale signal." : "No additional verified commercial-scale signal is available." },
    { key: "duplicate_or_customer", points: input.currentCustomer ? -60 : input.duplicate ? -10 : 0, kind: "fact",
      reason: input.currentCustomer ? "Existing customer state makes new-prospect pursuit inappropriate." : input.duplicate ? "An existing CRM identity requires owner review before pursuit." : "No exact CRM duplicate is recorded." },
    { key: "do_not_contact", points: input.doNotContact ? -100 : 0, kind: "fact",
      reason: input.doNotContact ? "Do-not-contact suppression blocks outreach." : "No do-not-contact suppression is recorded." },
  ];
  const score = Math.max(0, Math.min(100, factors.reduce((total, factor) => total + factor.points, 0)));
  const route = preferredRoute(contacts);
  const confidence = territoryMatch.matched && verifiedContacts && businessSpecificSources.size >= 2
    ? "high" : territoryMatch.matched && directContacts.length ? "medium" : "low";
  const productAngles = fit.angle.length ? fit.angle : ["Confirm produce needs before proposing products"];
  const recommendedNextAction = input.doNotContact
    ? "Do not contact; retain suppression."
    : input.currentCustomer
      ? "Review the existing customer relationship instead of creating new outreach."
      : !route
        ? "Research one credible public WhatsApp, phone, Instagram, Facebook, or email route; use an official website only to investigate a contact form."
        : route.confidence === "plausible"
          ? `Owner should verify the ${route.route} evidence, then capture and qualify the prospect.`
          : `Owner should review, capture, and prepare an editable ${route.route} outreach draft.`;
  return {
    score,
    scoreVersion: NIGERIA_OPPORTUNITY_SCORE_VERSION,
    confidence,
    factors,
    facts: [
      `${candidate.requestedCategory} in ${candidate.city ?? candidate.requestedTerritory.city}, ${candidate.state ?? candidate.requestedTerritory.state}.`,
      `${directContacts.length} evidence-backed direct public contact route(s) found.`,
      territoryMatch.matched ? "Campaign territory match verified." : "Campaign territory match not verified.",
    ],
    inferences: [
      `${candidate.requestedCategory} operations may have recurring fresh-produce needs.`,
      "The score prioritizes research and is not a purchase-probability estimate.",
    ],
    whyPursue: score >= 75
      ? `Strong evidence-backed commercial fit with ${directContacts.length ? "a usable direct public route" : "contact research still needed"}.`
      : score >= 45
        ? "Relevant local business with a bounded evidence gap to resolve before pursuit."
        : "Low-priority until identity, contactability, or CRM eligibility concerns are resolved.",
    productAngles,
    recommendedNextAction,
  };
}
