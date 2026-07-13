import { notFound } from "next/navigation";
import { AdminHeader } from "@/src/components/admin";
import { AdminSubnav } from "@/src/components/content-admin/admin-subnav";
import { CrudManager } from "@/src/components/content-admin/crud-manager";
import { contentPublicConfig } from "@/src/config/site";
import { loadAdminEntity } from "@/src/lib/content-admin";

export const dynamic = "force-dynamic";

export default async function CategoriesPage() {
  if (!contentPublicConfig.hubEnabled) notFound();
  const data = await loadAdminEntity("categories");
  return <div><AdminHeader title="Categories" body="Manage content categories, SEO labels and sort order." /><AdminSubnav /><CrudManager entity="categories" title="Categories" createLabel="Create Category" records={data.records} searchPlaceholder="Search categories" emptyTitle="No categories yet" emptyBody="Run the Shields taxonomy seed or create your first category." loadError={data.error} fields={[{name:"name",label:"Name *",required:true},{name:"slug",label:"Slug *",required:true},{name:"description",label:"Description",type:"textarea"},{name:"seo_title",label:"SEO title"},{name:"seo_description",label:"SEO description",type:"textarea"},{name:"sort_order",label:"Sort order",type:"number"},{name:"is_active",label:"Active",type:"checkbox"}]} columns={[{key:"name",label:"Category"},{key:"slug",label:"Slug"},{key:"sort_order",label:"Sort"},{key:"content_posts",label:"Posts",render:(record)=>String(record.post_count ?? 0)},{key:"is_active",label:"Status",render:(record)=>record.is_active ? "Active" : "Inactive"}]} /></div>;
}
