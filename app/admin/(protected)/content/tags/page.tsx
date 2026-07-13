import { notFound } from "next/navigation";
import { AdminHeader } from "@/src/components/admin";
import { AdminSubnav } from "@/src/components/content-admin/admin-subnav";
import { CrudManager, countOf } from "@/src/components/content-admin/crud-manager";
import { contentPublicConfig } from "@/src/config/site";
import { loadAdminEntity } from "@/src/lib/content-admin";

export const dynamic = "force-dynamic";

export default async function TagsPage() {
  if (!contentPublicConfig.hubEnabled) notFound();
  const data = await loadAdminEntity("tags");
  return <div><AdminHeader title="Tags" body="Manage content tags for topic clusters, filtering and internal navigation." /><AdminSubnav /><CrudManager entity="tags" title="Tags" createLabel="Create Tag" records={data.records} searchPlaceholder="Search tags" emptyTitle="No tags yet" emptyBody="Run the Shields taxonomy seed or create your first tag." fields={[{name:"name",label:"Name *",required:true},{name:"slug",label:"Slug *",required:true},{name:"description",label:"Description",type:"textarea"},{name:"is_active",label:"Active",type:"checkbox"}]} columns={[{key:"name",label:"Tag"},{key:"slug",label:"Slug"},{key:"content_post_tags",label:"Posts",render:(record)=>countOf(record,"content_post_tags")},{key:"is_active",label:"Status",render:(record)=>record.is_active ? "Active" : "Inactive"}]} /></div>;
}
