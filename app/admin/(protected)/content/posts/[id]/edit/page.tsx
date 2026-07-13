import { notFound } from "next/navigation";
import { AdminHeader } from "@/src/components/admin";
import { AdminSubnav } from "@/src/components/content-admin/admin-subnav";
import { PostEditor } from "@/src/components/content-admin/post-admin";
import { contentPublicConfig } from "@/src/config/site";
import { loadAdminOptions, loadPostForEdit } from "@/src/lib/content-admin";

export const dynamic = "force-dynamic";

export default async function EditPostPage({ params }: { params: Promise<{ id: string }> }) {
  if (!contentPublicConfig.hubEnabled) notFound();
  const { id } = await params;
  const [post, options] = await Promise.all([loadPostForEdit(id), loadAdminOptions()]);
  if (!post) notFound();
  return <div><AdminHeader title="Edit Article" body="Preview, revise, publish, unpublish or archive this protected content record." /><AdminSubnav /><PostEditor post={post} options={options} /></div>;
}
