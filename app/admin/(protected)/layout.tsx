import { AdminShell } from "@/src/components/admin-shell";
import { requireAdmin } from "@/src/lib/admin-auth";
import type { Metadata } from "next";
export const metadata:Metadata={manifest:"/admin/manifest.webmanifest"};

export default async function ProtectedAdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await requireAdmin();
  return <AdminShell>{children}</AdminShell>;
}
