import { notFound } from "next/navigation";
import { AdminHeader } from "@/src/components/admin";
import { AdminSubnav } from "@/src/components/content-admin/admin-subnav";
import { CrudManager } from "@/src/components/content-admin/crud-manager";
import { contentPublicConfig } from "@/src/config/site";
import { loadAdminEntity } from "@/src/lib/content-admin";

export const dynamic = "force-dynamic";

export default async function SourcesPage() {
  if (!contentPublicConfig.hubEnabled) notFound();
  const data = await loadAdminEntity("sources");
  const sourceTypes = ["government","academic","manufacturer","industry_body","merchant","original_interview","original_field_observation","news","other"].map((value) => ({ value, label: value.replaceAll("_", " ") }));
  return <div><AdminHeader title="Sources" body="Manage citations, primary sources and internal source notes. Internal notes never appear publicly." /><AdminSubnav /><CrudManager entity="sources" title="Sources" createLabel="Create Source" records={data.records} searchPlaceholder="Search sources" emptyTitle="No sources have been added yet." emptyBody="Create sources to support articles and recommendations." loadError={data.error} fields={[{name:"title",label:"Title *",required:true},{name:"publisher",label:"Publisher"},{name:"url",label:"URL *",type:"url",required:true},{name:"source_type",label:"Source type *",type:"select",required:true,options:sourceTypes},{name:"publication_date",label:"Publication date",type:"date"},{name:"accessed_at",label:"Accessed date",type:"date"},{name:"is_primary_source",label:"Primary source",type:"checkbox"},{name:"internal_note",label:"Internal note",type:"textarea"},{name:"is_active",label:"Active",type:"checkbox"}]} columns={[{key:"title",label:"Source"},{key:"publisher",label:"Publisher"},{key:"source_type",label:"Type"},{key:"post_count",label:"Used by posts",format:"number"},{key:"is_active",label:"Status",format:"status"}]} /></div>;
}
