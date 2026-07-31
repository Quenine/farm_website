import Link from "next/link";
import { notFound } from "next/navigation";
import {
  CaptureCandidateForm,
  DismissCandidateForm,
} from "@/src/components/sales-scout/discovery-candidate-actions";
import { requireAdmin } from "@/src/lib/admin-auth";
import {
  isSalesScoutDiscoveryEnabled,
  isSalesScoutEnabled,
} from "@/src/lib/sales-scout/access";
import {
  getSalesScoutDiscoveryCandidate,
  previewStagedSalesScoutCandidate,
} from "@/src/lib/sales-scout/discovery/server";

export const dynamic = "force-dynamic";

export default async function DiscoveryCandidatePage({
  params,
}: {
  params: Promise<{ candidateId: string }>;
}) {
  await requireAdmin();
  if (!isSalesScoutEnabled() || !isSalesScoutDiscoveryEnabled()) notFound();

  const { candidateId } = await params;
  const detail = await getSalesScoutDiscoveryCandidate(candidateId);
  const candidate = detail.candidate;
  let preview: Awaited<ReturnType<typeof previewStagedSalesScoutCandidate>> | null = null;
  let previewError: string | null = null;

  if (detail.readiness.candidate) {
    try {
      preview = await previewStagedSalesScoutCandidate(candidateId);
    } catch (error) {
      previewError = error instanceof Error ? error.name : "DISCOVERY_PREVIEW_FAILED";
    }
  }

  const isFinal = ["captured", "dismissed"].includes(candidate.status);
  const facts = [
    ["Provider category", candidate.provider_category],
    ["Mapped category", candidate.mapped_campaign_category],
    ["Address", candidate.full_address],
    ["Location", [candidate.city, candidate.state, candidate.country_code].filter(Boolean).join(", ")],
    ["Coordinates", candidate.latitude != null ? `${candidate.latitude}, ${candidate.longitude}` : null],
    ["Phone", candidate.public_phone],
    ["Website", candidate.public_website],
    ["Rating", candidate.rating_value != null ? `${candidate.rating_value} (${candidate.rating_count ?? 0})` : null],
    ["Claimed", candidate.claimed_indication == null ? null : String(candidate.claimed_indication)],
    ["Operating status", candidate.operating_status],
    ["First seen", candidate.first_seen_at],
    ["Last seen", candidate.last_seen_at],
    ["Seen count", String(candidate.seen_count)],
  ];

  return (
    <main className="space-y-5 p-6">
      <Link
        href={`/admin/marketing/sales-scout/discover?campaignId=${candidate.scout_campaign_id}`}
        className="text-green-800"
      >
        ← Discovery
      </Link>

      <section className="rounded-xl border bg-white p-5">
        <h1 className="text-3xl font-bold">{candidate.business_name}</h1>
        <p>{candidate.provider} · {candidate.provider_source_id}</p>
        {candidate.provider_source_url ? (
          <a href={candidate.provider_source_url} target="_blank" rel="noreferrer" className="text-green-800 underline">
            Provider evidence
          </a>
        ) : null}
        <p className="mt-3">{candidate.description ?? "No provider description."}</p>
        <dl className="mt-4 grid gap-3 sm:grid-cols-2">
          {facts.map(([label, value]) => (
            <div key={label}>
              <dt className="font-semibold">{label}</dt>
              <dd>{value || "—"}</dd>
            </div>
          ))}
        </dl>
        <p className="mt-3">Category IDs: {(candidate.provider_category_ids ?? []).join(", ") || "—"}</p>
        <p>Additional categories: {(candidate.additional_categories ?? []).join(", ") || "—"}</p>
      </section>

      <section className="rounded-xl border bg-white p-5">
        <h2 className="text-xl font-bold">Review and matching</h2>
        <p>Staged status: {candidate.status}</p>
        <p>Exact CRM prospect: {detail.exactProspect?.businessName ?? "None"}</p>
        <p>Captured CRM prospect: {detail.capturedProspect?.businessName ?? "None"}</p>
        {detail.readiness.blockers.map((blocker) => <p key={blocker}>{blocker}</p>)}
        {(candidate.mapping_issues ?? []).map((issue) => <p key={issue}>{issue}</p>)}
      </section>

      <section className="rounded-xl border bg-white p-5">
        <h2 className="text-xl font-bold">Membership history</h2>
        {detail.history.map((membership) => (
          <p key={membership.discovery_run_id}>
            {new Date(membership.created_at).toLocaleString("en-NG")} · exact {String(membership.is_exact_duplicate)}
            {" · "}warnings {membership.soft_match_warning_count}
          </p>
        ))}
      </section>

      {previewError ? (
        <p className="rounded border border-amber-300 bg-amber-50 p-3">
          Preview unavailable. Reference: {previewError}
        </p>
      ) : null}

      {!isFinal && preview ? (
        <section className="rounded-xl border bg-white p-5">
          <h2 className="text-xl font-bold">Capture</h2>
          {preview.allowedResolutionChoices.map((choice) => (
            <CaptureCandidateForm
              key={JSON.stringify(choice)}
              candidateId={candidateId}
              choice={choice}
            />
          ))}
        </section>
      ) : null}

      {!isFinal ? <DismissCandidateForm candidateId={candidateId} /> : null}
      {candidate.status === "dismissed" ? <p>Dismissed: {candidate.dismissal_reason}</p> : null}
    </main>
  );
}
