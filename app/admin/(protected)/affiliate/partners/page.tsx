import { notFound } from "next/navigation";
import { AdminHeader } from "@/src/components/admin";
import { AdminSubnav } from "@/src/components/content-admin/admin-subnav";
import { CrudManager } from "@/src/components/content-admin/crud-manager";
import { contentPublicConfig } from "@/src/config/site";
import { loadAdminEntity } from "@/src/lib/content-admin";

export const dynamic = "force-dynamic";

export default async function PartnersPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  if (!contentPublicConfig.affiliateEnabled) notFound();
  const filters = await searchParams;
  const data = await loadAdminEntity("partners", filters);
  return <div><AdminHeader title="Affiliate Partners" body="Manage external merchant partners. This is publisher-side only, not a member programme." /><AdminSubnav type="affiliate" /><CrudManager entity="partners" title="Partners" createLabel="Create Partner" records={data.records} filters={filters} count={data.count} page={data.page} pageSize={data.pageSize} totalPages={data.totalPages} searchPlaceholder="Search partners" emptyTitle="No affiliate partners have been added yet." emptyBody="Create a partner before adding merchant-supplied affiliate offers." loadError={data.error} fields={[{name:"name",label:"Name *",required:true},{name:"slug",label:"Slug *",required:true},{name:"website_url",label:"Website URL *",type:"url",required:true},{name:"affiliate_network",label:"Affiliate network"},{name:"default_disclosure",label:"Default disclosure",type:"textarea"},{name:"internal_notes",label:"Internal notes",type:"textarea",help:"Admin-only. Never public."},{name:"is_active",label:"Active",type:"checkbox"}]} columns={[{key:"name",label:"Partner"},{key:"website_url",label:"Website"},{key:"affiliate_network",label:"Network"},{key:"offer_count",label:"Offers",format:"number"},{key:"is_active",label:"Status",format:"status"}]} /></div>;
}
