import { redirect } from "next/navigation";
import { ApiError } from "@/lib/api";
import { getAuthContext } from "@/lib/auth-context";
import { isEngineer } from "@/constants/roles";
import { Topbar } from "@/components/shell/Topbar";
import { Card } from "@/components/ui/card";
import { MaintenanceModeControl } from "@/components/engineer/MaintenanceModeControl";
import { getMaintenanceState, type MaintenanceState } from "./actions";

/**
 * Maintenance mode console — the engineer's site-wide pause switch.
 *
 * This page has to stay reachable WHILE maintenance is on, which it does for
 * two independent reasons: the `(app)` layout skips its maintenance redirect for
 * engineers, and the backend exempts engineers from the pause on every
 * authenticated route. If either one alone held, this page would still load.
 *
 * Never cached — an engineer looking at this screen during an incident must be
 * seeing the real current state.
 */

export const dynamic = "force-dynamic";

// Utah time, matching the Logins and Surveys consoles.
function formatDateTime(d: string | null): string {
  if (!d) return "—";
  return new Date(d).toLocaleString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "America/Denver",
    timeZoneName: "short",
  });
}

export default async function EngineerMaintenancePage() {
  // Role gate (defense-in-depth): redirect non-engineers — and any authed-but-
  // unprovisioned user (getAuthContext throws → null) — to the dashboard.
  const gate = await getAuthContext().catch(() => null);
  if (!gate || !isEngineer(gate.roles)) redirect("/dashboard");

  let state: MaintenanceState | null = null;
  let error: ApiError | null = null;
  try {
    state = await getMaintenanceState();
  } catch (e) {
    error =
      e instanceof ApiError
        ? e
        : new ApiError(0, "Failed to load the maintenance state.");
  }

  return (
    <>
      <Topbar
        breadcrumb={[
          { label: "Engineer", href: "/engineer" },
          { label: "Maintenance mode" },
        ]}
      />
      <main className="flex-1 overflow-auto p-6">
        <h1 className="sr-only">Maintenance mode</h1>

        {error || !state ? (
          <Card className="p-10 text-center">
            <p className="text-sm font-semibold text-gray-900">
              {error?.status === 403
                ? "Engineer access required"
                : "Couldn’t load the maintenance state"}
            </p>
            <p className="mt-1 text-sm text-gray-500">
              {error?.status === 403
                ? "Maintenance mode is restricted to engineers."
                : (error?.message ?? "Try again in a moment.")}
            </p>
          </Card>
        ) : (
          <>
            <Card
              className={`p-5${
                state.enabled ? " border-danger-600" : ""
              }`}
            >
              <MaintenanceModeControl state={state} />
            </Card>

            {state.enabled ? (
              <p className="mt-3 max-w-2xl text-sm text-gray-500">
                Turned on {formatDateTime(state.enabled_at)}
                {state.enabled_by_email ? ` by ${state.enabled_by_email}` : ""}.
              </p>
            ) : null}

            <div className="mt-8 max-w-2xl">
              <h2 className="text-sm font-semibold text-gray-900">
                What this does
              </h2>
              <dl className="mt-3 space-y-3 text-sm text-gray-500">
                <div>
                  <dt className="font-medium text-gray-700">
                    Signs everyone out
                  </dt>
                  <dd>
                    Every account with a live session, except engineers, is
                    signed out within about 20 seconds. Those sessions are gone
                    for good — turning maintenance back off does not restore
                    them, so everyone signs in again.
                  </dd>
                </div>
                <div>
                  <dt className="font-medium text-gray-700">Blocks sign-in</dt>
                  <dd>
                    Non-engineers cannot sign in, and any request they make with
                    a token they already hold is refused. This is enforced by the
                    backend on every route, not just on the login screen.
                  </dd>
                </div>
                <div>
                  <dt className="font-medium text-gray-700">
                    Shows a maintenance page
                  </dt>
                  <dd>
                    Visitors get a plain “temporarily unavailable” page with your
                    message. It reveals nothing about why the site is down or who
                    took it down.
                  </dd>
                </div>
                <div>
                  <dt className="font-medium text-gray-700">
                    Leaves engineers alone
                  </dt>
                  <dd>
                    Engineers keep their session, keep full access, and can sign
                    in normally throughout — which is what guarantees this switch
                    can always be turned back off. Super admins are{" "}
                    <span className="font-medium text-gray-700">not</span>{" "}
                    exempt; only the engineer role is.
                  </dd>
                </div>
              </dl>
            </div>
          </>
        )}
      </main>
    </>
  );
}
