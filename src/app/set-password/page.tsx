import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { createClient } from "@/utils/supabase/server";
import { apiGet } from "@/lib/api";
import type { UserContext } from "@/types/alumni";
import { SetPasswordForm } from "@/components/auth/SetPasswordForm";

/**
 * Forced password-change screen. A clean, sign-in-style card with no app shell
 * (sidebar/nav) — like `/login`. Reached only when a user logged in with a temp
 * password (`must_change_password` true); the `(app)` layout redirects them here.
 *
 * This page lives OUTSIDE the `(app)` route group so it never renders that
 * layout — that's what keeps the forced redirect from looping. Here we make the
 * inverse check: if the flag is already cleared (false), bounce to the dashboard
 * so a normal user can never get stuck on this screen.
 */
export default async function SetPasswordPage() {
  const cookieStore = await cookies();
  const supabase = createClient(cookieStore);
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session) redirect("/login");

  // If the user doesn't actually need a password change, don't show this screen.
  // On any error fetching context (e.g. not yet provisioned), fall through and
  // let them set a password rather than trapping them here.
  let mustChange = true;
  try {
    const ctx = await apiGet<UserContext>("/auth/context");
    mustChange = ctx.must_change_password === true;
  } catch {
    mustChange = true;
  }
  if (!mustChange) redirect("/dashboard");

  return (
    <main className="flex min-h-screen">
      {/* Navy hero — desktop only. Mirrors the login screen. */}
      <div className="hidden flex-1 flex-col justify-end bg-navy-800 p-16 md:flex">
        <p className="text-sm font-semibold tracking-[0.2em] text-white">
          BYU FINANCE
        </p>
        <h1 className="mt-3 text-4xl font-semibold text-white">
          Alumni Database
        </h1>
        <p className="mt-3 max-w-md text-base text-brand-blue-300">
          Set a new password to finish setting up your account.
        </p>
      </div>

      {/* Set-password card — carded on a gray-50 panel, matching login. */}
      <div className="flex flex-1 items-center justify-center bg-gray-50 px-6 py-12">
        <div className="w-full max-w-md rounded-2xl border border-gray-300 bg-white p-8 shadow-sm">
          <div className="border-b border-gray-300">
            <span className="-mb-px inline-block border-b-2 border-navy-800 pb-3 text-base font-semibold text-navy-800">
              Set a new password
            </span>
          </div>

          <p className="mt-4 text-sm text-gray-700">
            Your account was created with a temporary password. Choose a new
            password to continue.
          </p>

          <SetPasswordForm />
        </div>
      </div>
    </main>
  );
}
