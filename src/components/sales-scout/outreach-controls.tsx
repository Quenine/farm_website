"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  approveOutreachAction,
  markOutreachSentAction,
  recordOutreachOutcomeAction,
  saveOutreachDraftAction,
} from "@/app/admin/(protected)/marketing/sales-scout/actions";
import {
  buildManualHandoff,
  generateDeterministicOutreachDraft,
  nextOutreachSequence,
  recommendOutreachChannels,
} from "@/src/lib/sales-scout/outreach";

type Channel = {
  id: string;
  platform: string;
  handle_or_value: string;
  profile_url: string | null;
  is_active: boolean;
  verified_at: string | null;
  evidence: unknown;
};
type Outreach = {
  id: string;
  channel_id: string;
  sequence_number: number;
  status: string;
  draft_text: string | null;
  approved_text: string | null;
  sent_text: string | null;
  sent_at: string | null;
  due_at: string | null;
  reply_summary: string | null;
};

function channelConfidence(channel: Channel | undefined) {
  if (!channel) return "plausible";
  if (channel.verified_at) return "verified";
  const evidence = channel.evidence;
  return evidence && typeof evidence === "object" &&
    "confidence" in evidence && evidence.confidence === "verified"
    ? "verified" : "plausible";
}

export function OutreachControls({
  prospect,
  campaign,
  channels,
  outreaches,
}: {
  prospect: Record<string, unknown>;
  campaign: { productScope: string | null; deliverySummary: string | null };
  channels: Channel[];
  outreaches: Outreach[];
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [message, setMessage] = useState("");
  const recommended = useMemo(() => recommendOutreachChannels(channels.map((channel) => ({
    id: channel.id,
    platform: channel.platform,
    handleOrValue: channel.handle_or_value,
    profileUrl: channel.profile_url,
    active: channel.is_active,
  }))), [channels]);
  const currentDraft = outreaches.find((item) => item.status === "draft");
  const approved = outreaches.find((item) => item.status === "approved");
  const pendingSent = outreaches.find((item) => item.status === "sent");
  const terminal = [...outreaches].reverse().find((item) =>
    ["replied", "cancelled", "blocked"].includes(item.status));
  const sequence = nextOutreachSequence(outreaches);
  const initialChannelId = currentDraft?.channel_id ?? recommended[0]?.id ?? "";
  const generated = sequence ? generateDeterministicOutreachDraft({
    sequenceNumber: sequence,
    businessName: String(prospect.business_name),
    businessCategory: String(prospect.business_category ?? "business"),
    city: String(prospect.city ?? ""),
    state: prospect.state ? String(prospect.state) : null,
    productScope: campaign.productScope,
    deliverySummary: campaign.deliverySummary,
  }) : "";
  const workflowKey = JSON.stringify([
    currentDraft?.id ?? null,
    currentDraft?.channel_id ?? null,
    currentDraft?.draft_text ?? null,
    sequence,
  ]);
  const resetDraftState = {
    key: workflowKey,
    channelId: currentDraft?.channel_id ?? initialChannelId,
    draft: currentDraft?.draft_text ?? generated,
  };
  const [draftState, setDraftState] = useState(resetDraftState);
  const activeDraftState = draftState.key === workflowKey ? draftState : resetDraftState;
  const channelId = activeDraftState.channelId;
  const draft = activeDraftState.draft;
  const setChannelId = (nextChannelId: string) => {
    setDraftState({ ...activeDraftState, channelId: nextChannelId });
  };
  const setDraft = (nextDraft: string) => {
    setDraftState({ ...activeDraftState, draft: nextDraft });
  };
  const reviewKey = `${approved?.id ?? ""}:${approved?.channel_id ?? ""}`;
  const [reviewState, setReviewState] = useState({ key: reviewKey, reviewed: false });
  const contactReviewed = reviewState.key === reviewKey && reviewState.reviewed;
  const setContactReviewed = (reviewed: boolean) => {
    setReviewState({ key: reviewKey, reviewed });
  };
  const run = (operation: () => Promise<{ ok: boolean; message: string }>) =>
    start(async () => {
      const result = await operation();
      setMessage(result.message);
      if (result.ok) router.refresh();
    });
  const selected = recommended.find((channel) => channel.id === channelId);
  const approvedChannel = approved
    ? recommended.find((channel) => channel.id === approved.channel_id)
    : undefined;
  const approvedSourceChannel = approved
    ? channels.find((channel) => channel.id === approved.channel_id)
    : undefined;
  const plausibleContact = Boolean(approvedChannel &&
    channelConfidence(approvedSourceChannel) === "plausible");
  const handoff = approved && approvedChannel
    ? buildManualHandoff({
      platform: approvedChannel.platform,
      value: approvedChannel.handleOrValue,
      profileUrl: approvedChannel.profileUrl,
      message: approved.approved_text ?? "",
    })
    : null;
  const handoffAllowed = Boolean(handoff && (!plausibleContact || contactReviewed));
  const approvedText = approved?.approved_text ?? "";
  const copyApprovedText = () => {
    if (!approvedText || !navigator.clipboard) {
      setMessage("Approved message copy is unavailable in this browser.");
      return;
    }
    void navigator.clipboard.writeText(approvedText).then(
      () => setMessage("Approved message copied."),
      () => setMessage("Approved message copy is unavailable in this browser."),
    );
  };

  if (prospect.do_not_contact_at) {
    return <section className="rounded-xl bg-red-100 p-5">
      <h2 className="text-xl font-bold">Outreach blocked</h2>
      <p>Do-not-contact suppression cannot be bypassed or removed here.</p>
    </section>;
  }

  return <section className="space-y-4 rounded-xl border bg-white p-5">
    <h2 className="text-xl font-bold">Human-controlled outreach</h2>
    <p>No message is sent automatically. Opening a handoff does not mark anything sent.</p>

    {sequence && !approved && !pendingSent && selected ? <>
      <label className="block font-bold">Channel
        <select value={channelId} onChange={(event) => setChannelId(event.target.value)}
          className="mt-1 h-11 w-full rounded border px-3">
          {recommended.map((channel) =>
            <option key={channel.id} value={channel.id}>
              {channel.platform}: {channel.handleOrValue}
            </option>)}
        </select>
      </label>
      <p className="font-bold">Draft {sequence} of 3</p>
      <textarea value={draft} onChange={(event) => setDraft(event.target.value)}
        maxLength={4000} className="min-h-40 w-full rounded border p-3"/>
      <div className="flex flex-wrap gap-2">
        <button disabled={pending} onClick={() => run(async () => {
          const form = new FormData();
          form.set("prospectId", String(prospect.id));
          form.set("channelId", selected.id);
          form.set("sequenceNumber", String(sequence));
          form.set("draftText", draft);
          return saveOutreachDraftAction(form);
        })} className="rounded-full border px-4 py-2 font-bold">
          {currentDraft ? "Save draft changes" : "Save editable draft"}
        </button>
        {currentDraft ? <button disabled={pending} onClick={() => run(async () => {
          const form = new FormData();
          form.set("outreachId", currentDraft.id);
          form.set("approvedText", draft);
          return approveOutreachAction(form);
        })} className="rounded-full bg-green-800 px-4 py-2 font-bold text-white">
          Approve draft
        </button> : null}
      </div>
    </> : null}

    {approved ? <div className="rounded border border-amber-300 bg-amber-50 p-4">
      <h3 className="font-bold">Approved manual handoff</h3>
      <p className="mt-2 whitespace-pre-wrap rounded border bg-white p-3">{approvedText}</p>
      <button type="button" onClick={copyApprovedText}
        className="mt-2 rounded-full border px-4 py-2 font-bold">
        Copy approved message
      </button>
      {plausibleContact ? <>
        <p className="mt-2 font-bold">Public contact — review before use</p>
        <label className="mt-2 flex gap-2">
          <input type="checkbox" checked={contactReviewed}
            onChange={(event) => setContactReviewed(event.target.checked)}/>
          I reviewed the public evidence and confirm this contact is appropriate for this handoff.
        </label>
      </> : null}
      {approvedChannel?.platform === "phone" ? <p className="mt-2 text-sm">
        Call opener: {approvedText}
      </p> : null}
      {handoffAllowed ? <a href={handoff ?? undefined}
        target={handoff?.startsWith("http") ? "_blank" : undefined}
        rel="noreferrer"
        className="mt-2 inline-block rounded-full bg-green-800 px-4 py-2 font-bold text-white">
        Open {approvedChannel?.platform} handoff
      </a> : <p className="mt-2">
        {plausibleContact
          ? "Confirm your review before opening this plausible public contact."
          : "The approved outreach channel has no supported handoff."}
      </p>}
      <p className="mt-2 text-sm">
        Social profiles open separately; WhatsApp and email handoffs are prefilled. You must press Send or place the call yourself.
      </p>
      <label className="mt-3 block font-bold">Sender account label
        <input id="senderLabel" className="mt-1 h-11 w-full rounded border px-3"
          placeholder="e.g. Shields Farms WhatsApp"/>
      </label>
      <label className="mt-2 flex gap-2">
        <input id="sentConfirmed" type="checkbox"/>
        I confirm I manually sent this exact message.
      </label>
      <button disabled={pending} onClick={() => {
        const label = (document.getElementById("senderLabel") as HTMLInputElement).value;
        const confirmed = (document.getElementById("sentConfirmed") as HTMLInputElement).checked;
        run(async () => {
          const form = new FormData();
          form.set("outreachId", approved.id);
          form.set("sentText", approved.approved_text ?? "");
          form.set("senderAccountLabel", label);
          form.set("confirmed", confirmed ? "yes" : "no");
          return markOutreachSentAction(form);
        });
      }} className="mt-2 rounded-full border border-green-800 px-4 py-2 font-bold">
        Mark sent after manual send
      </button>
    </div> : null}

    {pendingSent ? <p className="rounded border bg-stone-50 p-3">
      Outreach {pendingSent.sequence_number} was sent.
      {pendingSent.due_at
        ? " Follow-up is scheduled for " + new Date(pendingSent.due_at).toLocaleString("en-NG") + "."
        : " No further follow-up is scheduled."}
    </p> : null}
    {terminal ? <p className="rounded border bg-stone-50 p-3">
      Outreach workflow is {terminal.status}. No new draft is available.
    </p> : null}
    {!sequence && !approved && !pendingSent && !terminal
      ? <p>Maximum of three outreach attempts reached.</p>
      : null}

    {outreaches.filter((item) => item.status === "sent").map((item) =>
      <form key={item.id} action={(form) => run(() => recordOutreachOutcomeAction(form))}
        className="grid gap-2 rounded border p-4">
        <input type="hidden" name="outreachId" value={item.id}/>
        <b>Record outcome for outreach {item.sequence_number}</b>
        <select name="outcome" className="h-11 rounded border px-3">
          {["interested", "warm", "neutral", "not_interested", "opt_out", "irrelevant",
            "wants_pricing", "wants_product_list", "wants_call", "referred", "no_response",
            "cancelled"].map((outcome) => <option key={outcome}>{outcome}</option>)}
        </select>
        <textarea name="summary" required maxLength={2000}
          placeholder="Reply or outcome summary" className="min-h-20 rounded border p-3"/>
        <input name="commercialSignal" maxLength={500}
          placeholder="Next recommended action or commercial signal"
          className="h-11 rounded border px-3"/>
        <button disabled={pending} className="rounded-full border px-4 py-2 font-bold">
          Record outcome
        </button>
      </form>)}
    {message ? <p role="status" className="font-bold">{message}</p> : null}
  </section>;
}
