import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { createClient } from "@/utils/supabase/server";
import { Sidebar } from "@/components/shell/Sidebar";
import { MobileNav } from "@/components/shell/MobileNav";
import { apiGet } from "@/lib/api";
import type { UserContext } from "@/types/alumni";
import { ToastProvider } from "@/components/ui/Toast";

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
  // Read-only session read — do NOT call getUser() here. The middleware already
  // verified the session and persisted any rotated cookies for this request.
  // getUser() in a Server Component (which cannot write cookies) would trigger
  // another token refresh whose rotated refresh token is dropped, leaving the
  // browser holding an already-used token — and logging the user out on the
  // next navigation (notably the Back button after idle). Mirrors the same
  // fix already applied in lib/api.ts (authHeaders).
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session) redirect("/login");
  const user = session.user;

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
    <ToastProvider>
      <div className="flex h-screen overflow-hidden bg-gray-100">
        <Sidebar email={user.email ?? ""} role={role} />
        <div className="flex min-w-0 flex-1 flex-col overflow-hidden pb-16 md:pb-0">
          {children}
        </div>
        <MobileNav />
      </div>
    </ToastProvider>
  );
}
