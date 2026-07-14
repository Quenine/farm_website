import { notFound } from "next/navigation";
import { AdminHeader } from "@/src/components/admin";
import { AdminSubnav } from "@/src/components/content-admin/admin-subnav";
import { CrudManager } from "@/src/components/content-admin/crud-manager";
import { contentPublicConfig } from "@/src/config/site";
import { loadAdminEntity } from "@/src/lib/content-admin";

export const dynamic = "force-dynamic";

export default async function AuthorsPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  if (!contentPublicConfig.hubEnabled) notFound();
  const filters = await searchParams;
  const data = await loadAdminEntity("authors", filters);
  return <div><AdminHeader title="Authors" body="Manage editorial author profiles, experience notes and active status." /><AdminSubnav /><CrudManager entity="authors" title="Authors" createLabel="Create Author" records={data.records} filters={filters} count={data.count} page={data.page} pageSize={data.pageSize} totalPages={data.totalPages} searchPlaceholder="Search authors" emptyTitle="No authors have been created yet." emptyBody="Create an author before publishing Shields Farms articles." loadError={data.error} fields={[{name:"name",label:"Name *",required:true},{name:"slug",label:"Slug *",required:true},{name:"role_title",label:"Role title"},{name:"bio",label:"Bio",type:"textarea"},{name:"credentials_or_experience",label:"Credentials or experience",type:"textarea",help:"Do not invent credentials."},{name:"avatar_url",label:"Avatar image URL",type:"url"},{name:"avatar_alt",label:"Avatar alt text"},{name:"social_links",label:"Social links JSON",type:"textarea"},{name:"is_active",label:"Active",type:"checkbox"}]} columns={[{key:"name",label:"Author"},{key:"slug",label:"Slug"},{key:"role_title",label:"Role"},{key:"post_count",label:"Posts",format:"number"},{key:"is_active",label:"Status",format:"status"}]} /></div>;
}
