"use client";

import type { DuplicatePreviewDto } from "@/src/lib/sales-scout/server";
import { formatMatchLabel } from "@/src/lib/sales-scout/review";

type Resolution = { choice: "create_new" } | { choice: "attach_to_existing"; prospectId: string };
const humanize = (value: string) => value.replaceAll("_", " ");

export function CandidatePreview({ preview, pending, onCapture }: {
  preview: DuplicatePreviewDto;
  pending: boolean;
  onCapture: (resolution: Resolution) => void;
}) {
  const candidate=preview.normalizedCandidate;
  const score=preview.scorePreview;
  return <div className="mt-4 space-y-5">
    <section aria-labelledby="candidate-summary-heading"><h3 id="candidate-summary-heading" className="text-lg font-bold">Candidate summary</h3>
      <dl className="mt-2 grid gap-2 text-sm sm:grid-cols-2">
        <div><dt className="font-bold">Normalized business</dt><dd>{candidate.normalizedBusinessName}</dd></div>
        <div><dt className="font-bold">Original business</dt><dd>{candidate.businessName}</dd></div>
        <div><dt className="font-bold">Normalized location</dt><dd>{candidate.normalizedCity}, {candidate.normalizedCountry}</dd></div>
        <div><dt className="font-bold">Observed</dt><dd>{new Date(candidate.observedAt).toLocaleString()}</dd></div>
        <div><dt className="font-bold">Score</dt><dd>{score.score}/100 - {score.qualified?"Qualified":"Not qualified"}</dd></div>
        <div><dt className="font-bold">Rule version</dt><dd>{score.ruleVersion}</dd></div>
      </dl>
      <a href={candidate.sourceUrl} target="_blank" rel="noreferrer" className="mt-2 inline-block font-bold text-green-800 underline">Open public source</a>
    </section>

    <section aria-labelledby="candidate-channels-heading"><h3 id="candidate-channels-heading" className="text-lg font-bold">Channels</h3>
      <div className="mt-2 space-y-2">{candidate.channels.map(channel=><article key={`${channel.platform}:${channel.identityKey}`} className="rounded-lg border p-3 text-sm"><p className="font-bold capitalize">{channel.platform}{channel.isPrimary?" - Primary":""}</p><p>Public value: {channel.handleOrValue}</p><p>Normalized identity: <span className="font-mono">{channel.identityKey}</span></p>{channel.profileUrl?<a href={channel.profileUrl} target="_blank" rel="noreferrer" className="font-bold text-green-800 underline">Open public profile</a>:null}</article>)}</div>
    </section>

    <section aria-labelledby="candidate-qualification-heading"><h3 id="candidate-qualification-heading" className="text-lg font-bold">Qualification</h3>
      {score.qualificationFailures.length?<div className="mt-2"><h4 className="font-bold">Qualification failures</h4><ul className="list-disc pl-5 text-sm">{score.qualificationFailures.map(failure=><li key={failure}>{humanize(failure)}</li>)}</ul></div>:<p className="mt-2 text-sm text-green-800">No qualification failures.</p>}
      <div className="mt-3 space-y-2">{score.factors.map(factor=><article key={factor.key} className="rounded-lg bg-stone-50 p-3 text-sm"><p className="font-bold">{humanize(factor.key)}: {factor.points>0?"+":""}{factor.points} points</p><p>{factor.applied?"Applied":"Not applied"} - {factor.reason}</p></article>)}</div>
    </section>

    {preview.exactMatch?<section aria-labelledby="candidate-exact-heading"><h3 id="candidate-exact-heading" className="text-lg font-bold">Exact matches</h3><p className="mt-1 text-sm text-amber-800">Create new is unavailable. Attach to reuse the existing business history.</p><div className="mt-2 space-y-3">{preview.exactMatch.prospects.map(prospect=><article key={prospect.id} className="rounded-lg border border-amber-300 p-3 text-sm"><p className="font-bold">{formatMatchLabel(prospect)}</p><p>{prospect.businessCategory??"Category unavailable"} - {[prospect.city,prospect.country].filter(Boolean).join(", ")||"Location unavailable"}</p><p>Scout status: {prospect.scoutStatus??"Not enrolled"}; commercial stage: {prospect.commercialStage}</p><p>{prospect.alreadyEnrolled?"Already enrolled in Sales Scout":"Legacy CRM prospect"}</p><ul className="mt-1 list-disc pl-5">{preview.exactMatch?.reasons.map(reason=><li key={reason}>Exact identity: {reason}</li>)}</ul></article>)}</div></section>:null}

    {preview.softMatchWarnings.length?<section aria-labelledby="candidate-soft-heading"><h3 id="candidate-soft-heading" className="text-lg font-bold">Soft matches</h3><div className="mt-2 space-y-3">{preview.softMatchWarnings.map(warning=><article key={`${warning.prospectId}:${warning.reason}`} className="rounded-lg border p-3 text-sm"><p className="font-bold">{formatMatchLabel(warning.prospect)}</p><p>{warning.prospect.businessCategory??"Category unavailable"} - {[warning.prospect.city,warning.prospect.country].filter(Boolean).join(", ")||"Location unavailable"}</p><p>Scout status: {warning.prospect.scoutStatus??"Not enrolled"}; commercial stage: {warning.prospect.commercialStage}</p><p>Warning: {humanize(warning.reason)}</p></article>)}</div></section>:null}

    <div className="space-y-2">{preview.allowedResolutionChoices.map((choice)=><button key={choice.choice==="create_new"?"create_new":choice.prospectId} type="button" disabled={pending} onClick={()=>onCapture(choice)} className="block w-full rounded-full bg-green-800 px-4 py-2 font-bold text-white disabled:opacity-50">{choice.choice==="create_new"?"Create new prospect":`Attach to ${formatMatchLabel(choice.prospect)}`}</button>)}</div>
    <p className="text-xs text-stone-500">Attachment is always an explicit owner choice. No prospect is silently merged.</p>
  </div>;
}
