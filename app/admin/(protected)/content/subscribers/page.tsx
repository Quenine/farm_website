import { notFound } from "next/navigation";
import { AdminHeader } from "@/src/components/admin";
import { contentPublicConfig } from "@/src/config/site";

export default function SubscribersAdminPage() {
  if (!contentPublicConfig.subscriptionsEnabled) notFound();
  return <div><AdminHeader title="Subscribers" body="Protected subscriber handling for content updates. No automatic emails are sent in this batch." /><div className="rounded-lg bg-white p-5 text-sm leading-6 text-stone-700 shadow-sm"><p>Subscriber emails are never exposed publicly. Use database access or a protected export workflow after review. Current implementation records explicit consent, source path, topic, unsubscribe token, and status.</p></div></div>;
}
