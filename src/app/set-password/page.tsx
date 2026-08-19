import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { createClient } from "@/utils/supabase/server";
import { getAuthContext } from "@/lib/auth-context";
import { SetPasswordForm } from "@/components/auth/SetPasswordForm";
import { Card, CardContent, CardHeader } from "@/components/ui/card";

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
  //
  // This is the one gate in the app that is SAFE to leave as a single catch
  // (#688), because its restrictive outcome is the fall-through, not the
  // redirect: `mustChange` starts true, and the only thing that can move the
  // user on is a successful read that says the flag is already cleared. A 403
  // (not yet provisioned), a 5xx and an unreachable API all land on the
  // password form, which holds no alumni data and traps nobody — submitting it
  // clears the flag and the app opens up. Redirecting on a fault instead would
  // be the failure mode worth fixing, and it cannot happen here.
  let mustChange = true;
  try {
    mustChange = (await getAuthContext()).must_change_password === true;
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
        <Card className="w-full max-w-md">
          <CardHeader className="border-b border-gray-200">
            <h1 className="text-lg font-semibold text-gray-900">
              Set a new password
            </h1>
          </CardHeader>

          <CardContent className="pt-5">
            <p className="text-sm text-gray-700">
              Your account was created with a temporary password. Choose a new
              password to continue.
            </p>

            <SetPasswordForm email={session.user.email ?? ""} />
          </CardContent>
        </Card>
      </div>
    </main>
  );
}
