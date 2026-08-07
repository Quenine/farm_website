import type { TerritoryMatchEvidence } from "../territory.ts";
import type { PublicContact } from "./production.ts";
import type { ResearchCandidate } from "./types.ts";

export const NIGERIA_OPPORTUNITY_SCORE_VERSION = "ng-revenue-v1" as const;

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

export function reflectOwnerConfirmedContact(assessment:OpportunityAssessment) {
  if (assessment.factors.some((factor)=>factor.key==="do_not_contact"&&factor.points<0)) return assessment;
  const factors=assessment.factors.map((factor)=>factor.key==="public_contactability"
    ? {...factor,points:15,reason:"At least one public contact route was explicitly confirmed by the owner."}:factor);
  return {...assessment,factors,score:Math.max(0,Math.min(100,factors.reduce((total,factor)=>total+factor.points,0))),
    confidence:assessment.confidence==="low"?"medium":assessment.confidence,
    recommendedNextAction:"Owner should capture and qualify the prospect, then prepare an editable manual outreach draft."};
}

const targetFit: Record<string, { category: number; produce: number; recurring: number; angle: string[] }> = {
  Restaurant: { category: 25, produce: 20, recurring: 15,
    angle: ["Reliable restaurant-grade vegetables", "Planned recurring fresh-produce delivery"] },
  Hotel: { category: 23, produce: 17, recurring: 14,
    angle: ["Consistent kitchen produce supply", "Scheduled delivery for food-service operations"] },
  Supermarket: { category: 22, produce: 18, recurring: 13,
    angle: ["Fresh produce for retail shelves", "Reliable replenishment and seasonal availability"] },
};

function preferredRoute(contacts: PublicContact[]) {
  const ordered = ["whatsapp", "phone", "instagram", "facebook", "email", "website"];
  return [...contacts].sort((left, right) => {
    const confidence = Number(right.confidence === "verified") - Number(left.confidence === "verified");
    return confidence || ordered.indexOf(left.route) - ordered.indexOf(right.route);
  })[0];
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
  const fit = targetFit[candidate.requestedCategory] ?? { category: 8, produce: 5, recurring: 4, angle: [] };
  const verifiedContacts = contacts.filter((contact) => contact.confidence === "verified").length;
  const contactPoints = verifiedContacts ? 15 : contacts.length ? 10 : 0;
  const distinctSources = new Set(candidate.evidence
    .filter((item) => item.verificationStatus !== "rejected")
    .map((item) => item.source)).size;
  const evidencePoints = Math.min(10, distinctSources * 3);
  const multiLocation = candidate.evidence.some((item) =>
    item.field === "multiLocation" && item.verificationStatus === "verified");
  const factors: OpportunityFactor[] = [
    { key: "target_category_fit", points: fit.category, kind: "fact",
      reason: `${candidate.requestedCategory} is a configured Shields Farms target category.` },
    { key: "fresh_produce_relevance", points: fit.produce, kind: "inference",
      reason: `${candidate.requestedCategory} operations generally use fresh produce; no purchasing volume is assumed.` },
    { key: "recurring_purchase_likelihood", points: fit.recurring, kind: "inference",
      reason: `${candidate.requestedCategory} operations generally replenish food inputs; procurement behaviour is not verified.` },
    { key: "territory_delivery_fit", points: territoryMatch.matched ? 15 : 0, kind: "fact",
      reason: territoryMatch.matched ? `Business identity is matched to the campaign territory by ${territoryMatch.basis.replaceAll("_", " ")}.` : "Campaign territory is not verified." },
    { key: "public_contactability", points: contactPoints, kind: "fact",
      reason: verifiedContacts ? `${verifiedContacts} verified public contact route(s) are available.` : contacts.length ? `${contacts.length} plausible public contact route(s) require owner review.` : "No usable public contact route is available." },
    { key: "evidence_quality", points: evidencePoints, kind: "fact",
      reason: `Evidence is retained from ${distinctSources} public source type(s).` },
    { key: "multi_location_scale_proxy", points: multiLocation ? 5 : 0, kind: "inference",
      reason: multiLocation ? "Public evidence indicates multiple locations, a limited scale proxy." : "No verified multi-location signal is available." },
    { key: "duplicate_or_customer", points: input.currentCustomer ? -60 : input.duplicate ? -10 : 0, kind: "fact",
      reason: input.currentCustomer ? "Existing customer state makes new-prospect pursuit inappropriate." : input.duplicate ? "An existing CRM identity requires owner review before pursuit." : "No exact CRM duplicate is recorded." },
    { key: "do_not_contact", points: input.doNotContact ? -100 : 0, kind: "fact",
      reason: input.doNotContact ? "Do-not-contact suppression blocks outreach." : "No do-not-contact suppression is recorded." },
  ];
  const score = Math.max(0, Math.min(100, factors.reduce((total, factor) => total + factor.points, 0)));
  const route = preferredRoute(contacts);
  const confidence = territoryMatch.matched && verifiedContacts && distinctSources >= 2
    ? "high" : territoryMatch.matched && contacts.length ? "medium" : "low";
  const productAngles = fit.angle.length ? fit.angle : ["Confirm produce needs before proposing products"];
  const recommendedNextAction = input.doNotContact
    ? "Do not contact; retain suppression."
    : input.currentCustomer
      ? "Review the existing customer relationship instead of creating new outreach."
      : !route
        ? "Research one credible public phone, WhatsApp, Instagram, Facebook, email, or website route."
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
      `${contacts.length} evidence-backed public contact route(s) found.`,
      territoryMatch.matched ? "Campaign territory match verified." : "Campaign territory match not verified.",
    ],
    inferences: [
      `${candidate.requestedCategory} operations may have recurring fresh-produce needs.`,
      "The score prioritizes research and is not a purchase-probability estimate.",
    ],
    whyPursue: score >= 70
      ? `Strong target-category and territory fit with ${contacts.length ? "a usable public route" : "contact research still needed"}.`
      : score >= 45
        ? "Relevant local business with a bounded evidence gap to resolve before pursuit."
        : "Low-priority until identity, contactability, or CRM eligibility concerns are resolved.",
    productAngles,
    recommendedNextAction,
  };
}
