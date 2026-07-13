import { notFound } from "next/navigation";
import { AdminHeader } from "@/src/components/admin";
import { AdminSubnav } from "@/src/components/content-admin/admin-subnav";
import { PostsList } from "@/src/components/content-admin/post-admin";
import { contentPublicConfig } from "@/src/config/site";
import { loadAdminEntity } from "@/src/lib/content-admin";

export const dynamic = "force-dynamic";

export default async function PostsPage() {
  if (!contentPublicConfig.hubEnabled) notFound();
  const data = await loadAdminEntity("posts");
  return <div><AdminHeader title="Posts" body="Create, review, publish, unpublish and archive agribusiness content." /><AdminSubnav /><PostsList posts={data.records} /></div>;
}
