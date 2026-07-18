import { AdminShell } from "@/src/components/admin-shell";
import { requireAdmin } from "@/src/lib/admin-auth";

export default async function ProtectedAdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await requireAdmin();
  return <AdminShell>{children}</AdminShell>;
}
