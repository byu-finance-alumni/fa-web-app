import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { createClient } from "@/utils/supabase/server";
import { Sidebar } from "@/components/shell/Sidebar";
import { MobileNav } from "@/components/shell/MobileNav";
import { SessionTimeout } from "@/components/auth/SessionTimeout";
import { PreviewBanner } from "@/components/engineer/PreviewBanner";
import { apiGet } from "@/lib/api";
import type { UserContext } from "@/types/alumni";
import { highestRole, isEngineer, roleLabel } from "@/constants/roles";
import { asPreviewRole, PREVIEW_COOKIE } from "@/lib/preview";
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
  let mustChangePassword = false;
  let userIsEngineer = false;
  try {
    const ctx = await apiGet<UserContext>("/auth/context");
    mustChangePassword = ctx.must_change_password === true;
    // Resolve the user's single highest role for role-aware nav (engineer is
    // the top of the ladder). See @/constants/roles.
    role = highestRole(ctx.roles);
    userIsEngineer = isEngineer(ctx.roles);
  } catch {
    // 403 = authenticated but not yet provisioned in the users table.
  }

  // Preview-as-role (#165): only an engineer may preview, and only as a role
  // strictly below engineer, so previewing never grants access — it just renders
  // the shell as that lower role. The cookie is httpOnly and validated here; a
  // persistent banner makes the state obvious with a one-click exit.
  const previewRole = userIsEngineer
    ? asPreviewRole(cookieStore.get(PREVIEW_COOKIE)?.value)
    : null;
  const effectiveRole = previewRole ?? role;

  // Force a temp-password user to set a new password before they can use any
  // app screen. `/set-password` lives OUTSIDE this `(app)` route group, so it
  // never renders this layout — that's what prevents a redirect loop. The
  // `/set-password` page itself re-bounces to /dashboard once the flag clears.
  // `redirect()` must run outside the try/catch above: it works by throwing a
  // control-flow signal that a catch would otherwise swallow.
  if (mustChangePassword) redirect("/set-password");

  return (
    <ToastProvider>
      <SessionTimeout />
      <div className="flex h-screen overflow-hidden bg-canvas">
        {/* While previewing, the sidebar reflects the previewed role (engineer
            tools disappear); the engineer exits via the always-visible banner. */}
        <Sidebar email={user.email ?? ""} role={effectiveRole} />
        {/* min-h-0 lets the inner <main className="flex-1 overflow-auto"> on each
            page actually cap its height and scroll. A flex child defaults to
            min-height:auto, so without this a page whose content is taller than
            the viewport grows past the column and gets clipped by overflow-hidden
            instead of scrolling (E8: vocabulary unreachable below the last
            section). Applied here so every (app) page inherits the fix. */}
        <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden pb-16 md:pb-0">
          {previewRole && <PreviewBanner roleLabel={roleLabel(previewRole)} />}
          {children}
        </div>
        <MobileNav />
      </div>
    </ToastProvider>
  );
}
