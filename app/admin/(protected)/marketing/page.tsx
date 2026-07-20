import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export default function AdminMarketingPage() {
  redirect("/admin/marketing/overview");
}
