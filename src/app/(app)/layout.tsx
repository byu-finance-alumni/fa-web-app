import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { createClient } from "@/utils/supabase/server";
import { Sidebar } from "@/components/shell/Sidebar";
import { apiGet } from "@/lib/api";
import type { UserContext } from "@/types/alumni";

/**
 * App shell layout: navy sidebar + content area, with auth enforced.
 * Middleware already gates unauthenticated access; we re-verify here and
 * resolve the user's highest role from the backend for role-aware nav.
 */
export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const cookieStore = await cookies();
  const supabase = createClient(cookieStore);
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  let role = "";
  try {
    const ctx = await apiGet<UserContext>("/auth/context");
    const roles = ctx.roles ?? [];
    role = roles.includes("super_admin")
      ? "super_admin"
      : roles.includes("full_access")
        ? "full_access"
        : roles.includes("view_only")
          ? "view_only"
          : "";
  } catch {
    // 403 = authenticated but not yet provisioned in the users table.
  }

  return (
    <div className="flex min-h-screen bg-gray-100">
      <Sidebar email={user.email ?? ""} role={role} />
      <div className="flex min-w-0 flex-1 flex-col">{children}</div>
    </div>
  );
}
