import { notFound } from "next/navigation";
import { AdminHeader } from "@/src/components/admin";
import { AdminSubnav } from "@/src/components/content-admin/admin-subnav";
import { CrudManager } from "@/src/components/content-admin/crud-manager";
import { contentPublicConfig } from "@/src/config/site";
import { loadAdminEntity, loadAdminOptions } from "@/src/lib/content-admin";

export const dynamic = "force-dynamic";

export default async function VideosPage() {
  if (!contentPublicConfig.hubEnabled) notFound();
  const [data, options] = await Promise.all([loadAdminEntity("videos"), loadAdminOptions()]);
  const posts = [{ value: "", label: "Choose post" }, ...options.posts.map((post) => ({ value: String(post.id), label: String(post.title) }))];
  return <div><AdminHeader title="Videos" body="Manage video companion metadata. Do not download or scrape videos." /><AdminSubnav /><CrudManager entity="videos" title="Videos" createLabel="Add Video" records={data.records} searchPlaceholder="Search videos" emptyTitle="No videos yet" emptyBody="Add YouTube or direct external video metadata for published companion pages." fields={[{name:"post_id",label:"Related post *",type:"select",required:true,options:posts},{name:"platform",label:"Platform",type:"select",options:[{value:"youtube",label:"YouTube"},{value:"direct_external",label:"Direct external"}]},{name:"external_video_id",label:"External video ID"},{name:"embed_url",label:"Embed URL",type:"url"},{name:"watch_url",label:"Watch URL",type:"url"},{name:"title",label:"Title *",required:true},{name:"description",label:"Description",type:"textarea"},{name:"thumbnail_url",label:"Thumbnail URL",type:"url"},{name:"thumbnail_alt",label:"Thumbnail alt text"},{name:"duration_seconds",label:"Duration seconds",type:"number"},{name:"upload_date",label:"Upload date",type:"date"},{name:"transcript_markdown",label:"Transcript Markdown",type:"textarea"},{name:"chapters",label:"Chapters JSON",type:"textarea"},{name:"is_active",label:"Active",type:"checkbox"}]} columns={[{key:"title",label:"Video"},{key:"platform",label:"Platform"},{key:"content_posts",label:"Post",render:(record)=>Array.isArray(record.content_posts) ? (record.content_posts[0] as {title?:string})?.title : (record.content_posts as {title?:string}|undefined)?.title},{key:"upload_date",label:"Upload date"},{key:"is_active",label:"Status",render:(record)=>record.is_active ? "Active" : "Inactive"}]} /></div>;
}
