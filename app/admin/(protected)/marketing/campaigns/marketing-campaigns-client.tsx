"use client";

import { useState, useTransition } from "react";
import { QrCode } from "lucide-react";
import { saveCampaignAction, toggleCampaignAction } from "@/app/admin/(protected)/marketing/campaigns/actions";
import { MarketingUrlPanel } from "@/app/admin/(protected)/marketing/campaigns/marketing-url-panel";
import { AdminHeader, AdminTable, StatusBadge } from "@/src/components/admin";
import { siteConfig } from "@/src/config/site";
import { campaignTargetUrl, type MarketingCampaign } from "@/src/lib/marketing-campaigns-shared";
import { formatNaira } from "@/src/lib/format";

const emptyForm = {
  name: "",
  slug: "",
  channel: "WhatsApp",
  source: "whatsapp",
  medium: "organic-social",
  campaignName: "",
  content: "",
  term: "",
  targetPath: "/shop",
  startsAt: "",
  endsAt: "",
  isActive: true,
};

type CampaignForm = typeof emptyForm & { id?: string };

function trackedUrl(campaign: MarketingCampaign) {
  return `${siteConfig.url.replace(/\/$/, "")}/go/${campaign.slug}`;
}

export function MarketingCampaignsClient({ initialCampaigns }: { initialCampaigns: MarketingCampaign[] }) {
  const [campaigns, setCampaigns] = useState(initialCampaigns);
  const [form, setForm] = useState<CampaignForm>(emptyForm);
  const [editing, setEditing] = useState(false);
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<"all" | "active" | "inactive">("all");
  const [message, setMessage] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const visible = campaigns.filter((campaign) => {
    const haystack = [campaign.name, campaign.slug, campaign.channel, campaign.source, campaign.medium, campaign.campaignName].join(" ").toLowerCase();
    if (query && !haystack.includes(query.toLowerCase())) return false;
    if (status === "active" && !campaign.isActive) return false;
    if (status === "inactive" && campaign.isActive) return false;
    return true;
  });
  const totalClicks = campaigns.reduce((sum, campaign) => sum + (campaign.clickCount ?? 0), 0);
  const paidRevenue = campaigns.reduce((sum, campaign) => sum + (campaign.attributedPaidRevenue ?? 0), 0);

  const save = (event: React.FormEvent) => {
    event.preventDefault();
    setMessage(null);
    startTransition(async () => {
      const result = await saveCampaignAction(form);
      setMessage(result.message ?? (result.success ? "Campaign saved." : "Unable to save campaign."));
      if (result.success) window.location.reload();
    });
  };

  const edit = (campaign: MarketingCampaign) => {
    setForm({
      id: campaign.id,
      name: campaign.name,
      slug: campaign.slug,
      channel: campaign.channel,
      source: campaign.source,
      medium: campaign.medium,
      campaignName: campaign.campaignName,
      content: campaign.content ?? "",
      term: campaign.term ?? "",
      targetPath: campaign.targetPath,
      startsAt: campaign.startsAt?.slice(0, 16) ?? "",
      endsAt: campaign.endsAt?.slice(0, 16) ?? "",
      isActive: campaign.isActive,
    });
    setEditing(true);
  };

  const toggle = (campaign: MarketingCampaign) => {
    startTransition(async () => {
      const result = await toggleCampaignAction(campaign.id, !campaign.isActive);
      if (result.success) setCampaigns((current) => current.map((item) => item.id === campaign.id ? { ...item, isActive: !item.isActive } : item));
      else setMessage(result.message ?? "Unable to update campaign.");
    });
  };

  return (
    <>
      <AdminHeader title="Marketing Campaigns" body="Create tracked organic campaign links, review clicks, and attribute orders without changing checkout totals." />
      <MarketingUrlPanel />
      {message ? <div className="mb-4 rounded-lg border border-green-200 bg-green-50 p-4 text-sm font-semibold text-green-800">{message}</div> : null}
      <div className="mb-5 grid gap-4 md:grid-cols-4">
        <Summary label="Campaign clicks" value={String(totalClicks)} />
        <Summary label="Attributed orders" value={String(campaigns.reduce((sum, campaign) => sum + (campaign.attributedOrderCount ?? 0), 0))} />
        <Summary label="Paid orders" value={String(campaigns.reduce((sum, campaign) => sum + (campaign.attributedPaidOrderCount ?? 0), 0))} />
        <Summary label="Paid revenue" value={formatNaira(paidRevenue)} />
      </div>
      <div className="mb-5 rounded-lg bg-white p-4 shadow-sm">
        <div className="grid gap-3 md:grid-cols-3">
          <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search campaigns" className="h-11 rounded-lg border border-stone-200 px-3 text-sm" />
          <select value={status} onChange={(event) => setStatus(event.target.value as typeof status)} className="h-11 rounded-lg border border-stone-200 px-3 text-sm">
            <option value="all">All statuses</option>
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
          </select>
          <button type="button" onClick={() => { setForm(emptyForm); setEditing(true); }} className="h-11 rounded-full bg-green-800 px-4 text-sm font-bold text-white">Create campaign</button>
        </div>
        <p className="mt-3 text-xs leading-5 text-stone-600">Examples: WhatsApp flyer, WhatsApp Status, Instagram organic, Facebook organic, Restaurant outreach, Printed flyer QR.</p>
      </div>
      {editing ? (
        <form onSubmit={save} className="mb-5 grid gap-3 rounded-lg bg-white p-5 shadow-sm md:grid-cols-2">
          <CampaignInput label="Campaign name" value={form.name} onChange={(name) => setForm({ ...form, name })} />
          <CampaignInput label="Slug" value={form.slug} onChange={(slug) => setForm({ ...form, slug })} />
          <CampaignInput label="Channel" value={form.channel} onChange={(channel) => setForm({ ...form, channel })} />
          <CampaignInput label="Source" value={form.source} onChange={(source) => setForm({ ...form, source })} />
          <CampaignInput label="Medium" value={form.medium} onChange={(medium) => setForm({ ...form, medium })} />
          <CampaignInput label="Campaign identifier" value={form.campaignName} onChange={(campaignName) => setForm({ ...form, campaignName })} />
          <CampaignInput label="Content" required={false} value={form.content} onChange={(content) => setForm({ ...form, content })} />
          <CampaignInput label="Term" required={false} value={form.term} onChange={(term) => setForm({ ...form, term })} />
          <CampaignInput label="Target page" value={form.targetPath} onChange={(targetPath) => setForm({ ...form, targetPath })} />
          <CampaignInput label="Start date" required={false} type="datetime-local" value={form.startsAt} onChange={(startsAt) => setForm({ ...form, startsAt })} />
          <CampaignInput label="End date" required={false} type="datetime-local" value={form.endsAt} onChange={(endsAt) => setForm({ ...form, endsAt })} />
          <label className="flex items-center gap-3 rounded-lg border border-stone-200 p-3 text-sm font-semibold"><input type="checkbox" checked={form.isActive} onChange={(event) => setForm({ ...form, isActive: event.target.checked })} /> Active</label>
          <div className="flex gap-2 md:col-span-2">
            <button disabled={isPending} className="h-11 rounded-full bg-green-800 px-5 text-sm font-bold text-white">Save campaign</button>
            <button type="button" onClick={() => setEditing(false)} className="h-11 rounded-full border border-stone-300 px-5 text-sm font-bold">Cancel</button>
          </div>
        </form>
      ) : null}
      {campaigns.length === 0 ? <div className="rounded-lg bg-white p-6 text-sm text-stone-600 shadow-sm">No campaigns yet. Create campaign links and use them in WhatsApp, flyers, or outreach before data appears.</div> : null}
      <AdminTable
        headers={["Campaign", "Tracked URL", "UTM target", "Clicks", "Attributed", "Revenue", "Status", "Actions"]}
        rows={visible.map((campaign) => [
          <span key="name" className="font-bold text-green-950">{campaign.name}<span className="block text-xs font-semibold text-stone-500">{campaign.channel}</span></span>,
          <button key="copy" type="button" onClick={() => navigator.clipboard?.writeText(trackedUrl(campaign))} className="text-left text-xs font-bold text-green-800">{trackedUrl(campaign)}</button>,
          <span key="utm" className="text-xs">{campaignTargetUrl(campaign)}</span>,
          String(campaign.clickCount ?? 0),
          `${campaign.attributedPaidOrderCount ?? 0} paid / ${campaign.attributedOrderCount ?? 0} total`,
          formatNaira(campaign.attributedPaidRevenue ?? 0),
          <StatusBadge key="status" status={campaign.isActive ? "Active" : "Inactive"} />,
          <div key="actions" className="flex flex-wrap gap-2">
            <button type="button" onClick={() => edit(campaign)} className="h-8 rounded-full bg-green-50 px-3 text-xs font-bold text-green-800">Edit</button>
            <button type="button" onClick={() => toggle(campaign)} className="h-8 rounded-full bg-amber-50 px-3 text-xs font-bold text-amber-800">{campaign.isActive ? "Deactivate" : "Activate"}</button>
            <a href={`/api/marketing/qr/${campaign.slug}`} target="_blank" className="inline-flex h-8 items-center gap-1 rounded-full bg-stone-100 px-3 text-xs font-bold text-stone-700"><QrCode size={14} /> SVG</a>
          </div>,
        ])}
      />
    </>
  );
}

function Summary({ label, value }: { label: string; value: string }) {
  return <div className="rounded-lg bg-white p-4 shadow-sm"><p className="text-xs font-semibold text-stone-500">{label}</p><p className="mt-2 text-2xl font-bold text-green-950">{value}</p></div>;
}

function CampaignInput({ label, value, onChange, type = "text", required = true }: { label: string; value: string; onChange: (value: string) => void; type?: string; required?: boolean }) {
  return <label className="grid gap-2 text-sm font-semibold text-stone-800">{label}<input required={required} type={type} value={value} onChange={(event) => onChange(event.target.value)} className="h-11 rounded-lg border border-stone-200 px-3 text-sm font-normal" /></label>;
}




