import Link from "next/link";
import { notFound } from "next/navigation";
import { AdminHeader } from "@/src/components/admin";
import { contentPublicConfig } from "@/src/config/site";

export default function AffiliateAdminPage() {
  if (!contentPublicConfig.affiliateEnabled) notFound();
  return <div><AdminHeader title="Affiliate Publisher" body="Manage external merchant partners and offers used inside editorial content. This is publisher-side only, not an affiliate-member programme." /><div className="grid gap-4 md:grid-cols-2"><Link href="/admin/affiliate/partners" className="rounded-lg bg-white p-5 font-bold text-green-950 shadow-sm">Affiliate partners</Link><Link href="/admin/affiliate/offers" className="rounded-lg bg-white p-5 font-bold text-green-950 shadow-sm">Affiliate offers</Link></div><div className="mt-6 rounded-lg bg-amber-50 p-4 text-sm leading-6 text-amber-950">Do not enter commission claims, payout balances, or merchant conversion data unless a future merchant integration is explicitly added.</div></div>;
}
