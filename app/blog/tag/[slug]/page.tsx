import { notFound } from "next/navigation";
import BlogPage, { generateMetadata as blogMetadata } from "@/app/blog/page";
import { contentPublicConfig } from "@/src/config/site";

export const dynamic = "force-dynamic";
export const generateMetadata = blogMetadata;

export default async function TagPage({ params, searchParams }: { params: Promise<{ slug: string }>; searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  if (!contentPublicConfig.hubEnabled) notFound();
  const { slug } = await params;
  const existing = await searchParams;
  return <BlogPage searchParams={Promise.resolve({ ...existing, tag: slug })} />;
}
