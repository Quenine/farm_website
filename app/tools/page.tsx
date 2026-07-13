import { notFound } from "next/navigation";
import { ContentSubscribeForm } from "@/src/components/content/subscribe-form";
import { EggSalesMarginCalculator, PoultryFeedEstimator } from "@/src/components/content/tools";
import { PageShell, SectionHeader } from "@/src/components/ui";
import { contentPublicConfig, siteConfig } from "@/src/config/site";
import { contentMetadata } from "@/src/lib/content-config";

export async function generateMetadata() { return contentMetadata({ title: `${siteConfig.name} Farm Tools`, description: "Transparent farm calculators for feed requirements and egg sales margins.", path: "/tools" }); }

export default function ToolsPage() {
  if (!contentPublicConfig.toolsEnabled) notFound();
  return <PageShell><section className="mx-auto max-w-5xl px-4 py-12 sm:px-6 lg:px-8"><SectionHeader eyebrow="Tools" title="Practical farm calculators" body="Use transparent estimates for planning. Inputs are calculated locally and are not saved." /><div className="mt-8 grid gap-6"><PoultryFeedEstimator /><EggSalesMarginCalculator /></div><div className="mt-10"><ContentSubscribeForm sourcePath="/tools" /></div></section></PageShell>;
}
