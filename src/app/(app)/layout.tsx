import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { createClient } from "@/utils/supabase/server";
import { Sidebar } from "@/components/shell/Sidebar";
import { MobileNav } from "@/components/shell/MobileNav";
import { SessionTimeout } from "@/components/auth/SessionTimeout";
import { SessionGuard } from "@/components/auth/SessionGuard";
import { PointerEventsGuard } from "@/components/shell/PointerEventsGuard";
import { PreviewBanner } from "@/components/engineer/PreviewBanner";
import { getAuthContext } from "@/lib/auth-context";
import { getMaintenanceStatus } from "@/lib/maintenance";
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
  let canVocabReal = false;
  let realCapabilities: readonly string[] = [];
  let userName = "";
  try {
    const ctx = await getAuthContext();
    mustChangePassword = ctx.must_change_password === true;
    // Resolve the user's single highest role for role-aware nav (engineer is
    // the top of the ladder). See @/constants/roles.
    role = highestRole(ctx.roles);
    userIsEngineer = isEngineer(ctx.roles);
    // Capability-driven access for the vocabulary editor: true for the engineer
    // and for any role granted `vocab_admin` in the permission editor. Read from
    // the effective capabilities the backend resolves on /auth/context.
    canVocabReal = (ctx.capabilities ?? []).includes("vocab_admin");
    // The full effective capability list drives the per-section nav items that
    // fa-web-api #379 split out of the blanket `alumni.full` capability (Import,
    // Update, Tasks, Data quality, Needs Surveying, Pay It Forward, Activity).
    realCapabilities = ctx.capabilities ?? [];
    // Display name for the sidebar footer (falls back to email if unset).
    userName = [ctx.first_name, ctx.last_name].filter(Boolean).join(" ");
  } catch {
    // 403 = authenticated but not yet provisioned in the users table.
  }

  // Maintenance mode: while the engineer's site-wide pause is on, every
  // non-engineer gets the maintenance page instead of the app shell. The backend
  // is the real enforcement (every data route 503s and their session has already
  // been ended); this is what makes that legible instead of a wall of failed
  // requests.
  //
  // ENGINEERS ARE SKIPPED ENTIRELY — they are exempt from the pause and are the
  // only role that can turn it off, so bouncing them here would hide the very
  // console they need. Note the `getMaintenanceStatus` call is deliberately
  // AFTER `userIsEngineer` is resolved, and short-circuits: an engineer does not
  // even ask.
  //
  // `redirect()` must run outside the try/catch above — it throws a control-flow
  // signal a catch would swallow. `getMaintenanceStatus` fails open, so a
  // backend hiccup can never strand users on the maintenance page.
  if (!userIsEngineer && (await getMaintenanceStatus()).enabled) {
    redirect("/maintenance");
  }

  // Preview-as-role (#165): only an engineer may preview, and only as a role
  // strictly below engineer, so previewing never grants access — it just renders
  // the shell as that lower role. The cookie is httpOnly and validated here; a
  // persistent banner makes the state obvious with a one-click exit.
  const previewRole = userIsEngineer
    ? asPreviewRole(cookieStore.get(PREVIEW_COOKIE)?.value)
    : null;
  const effectiveRole = previewRole ?? role;
  // While previewing a lower role we can't know that role's granted capabilities
  // (the context carries the engineer's own), so hide the capability-gated
  // Vocabulary item during preview rather than leak it. A real sign-in by a
  // granted role still resolves its own capabilities and shows the item.
  const canVocab = previewRole ? false : canVocabReal;
  // Same reasoning for every other capability-gated nav item: while previewing
  // we hold the ENGINEER's capabilities, not the previewed role's, so showing
  // them would misrepresent what that role sees. Empty = hidden.
  const capabilities = previewRole ? [] : realCapabilities;

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
      <SessionGuard />
      <PointerEventsGuard />
      {/* While previewing a role, frame the whole viewport in a thick amber
          border so it's impossible to forget you're not seeing your own account
          (#256). Pairs with the solid PreviewBanner below. */}
      <div
        className={`flex h-full overflow-hidden bg-canvas${
          previewRole ? " ring-4 ring-inset ring-warning-500" : ""
        }`}
      >
        {/* While previewing, the sidebar reflects the previewed role (engineer
            tools disappear); the engineer exits via the always-visible banner. */}
        <Sidebar
          email={user.email ?? ""}
          name={userName}
          role={effectiveRole}
          canVocab={canVocab}
          capabilities={capabilities}
        />
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
