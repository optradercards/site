import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { isAdmin } from "@/lib/admin";
import AdminsManager from "@/components/admin/AdminsManager";

export const metadata: Metadata = {
  title: "Admins - Admin - OP Trader",
  description: "Manage platform admins",
};

export default async function AdminUsersPage() {
  const adminCheck = await isAdmin();
  if (!adminCheck) {
    redirect("/login?error_type=unauthorized&returnUrl=/admin/admins");
  }

  const supabase = await createClient();

  const [{ data: { user } }, { data: admins, error }, { data: isSuperAdmin }] = await Promise.all([
    supabase.auth.getUser(),
    supabase.rpc("list_platform_admins"),
    supabase.rpc("is_super_admin"),
  ]);

  if (error) {
    console.error("Error loading admins:", error);
  }

  return (
    <AdminsManager
      admins={admins ?? []}
      isSuperAdmin={isSuperAdmin === true}
      currentUserId={user?.id ?? ""}
    />
  );
}
