import { notFound } from "next/navigation";
import { AdminHeader } from "@/src/components/admin";
import { AdminSubnav } from "@/src/components/content-admin/admin-subnav";
import { PostEditor } from "@/src/components/content-admin/post-admin";
import { contentPublicConfig } from "@/src/config/site";
import { loadAdminOptions } from "@/src/lib/content-admin";

export const dynamic = "force-dynamic";

export default async function NewPostPage() {
  if (!contentPublicConfig.hubEnabled) notFound();
  const options = await loadAdminOptions();
  return <div><AdminHeader title="Create Article" body="Save drafts freely, then publish explicitly when editorial requirements are met." /><AdminSubnav /><PostEditor post={null} options={options} /></div>;
}
