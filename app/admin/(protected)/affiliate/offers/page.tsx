import { notFound } from "next/navigation";
import { AdminHeader } from "@/src/components/admin";
import { contentPublicConfig } from "@/src/config/site";

export default function AffiliatePlaceholderPage() {
  if (!contentPublicConfig.affiliateEnabled) notFound();
  return <div><AdminHeader title="Affiliate setup" body="Create active partners and merchant-supplied offer links after the Shields content migration is applied." /><div className="rounded-lg bg-white p-5 text-sm leading-6 text-stone-700 shadow-sm"><p>Destination URLs are stored server-side and resolved through /recommend/[slug]. The redirect never accepts arbitrary destination URLs from users.</p></div></div>;
}
