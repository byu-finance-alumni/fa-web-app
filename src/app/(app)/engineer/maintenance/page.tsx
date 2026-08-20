import { redirect } from "next/navigation";
import { ApiError } from "@/lib/api";
import { readAuthContext } from "@/lib/auth-context";
import { AccessCheckError } from "@/components/shared/AccessCheckError";
import { isEngineer } from "@/constants/roles";
import { Topbar } from "@/components/shell/Topbar";
import { Card } from "@/components/ui/card";
import { MaintenanceModeControl } from "@/components/engineer/MaintenanceModeControl";
import { TestAlertChannels } from "@/components/engineer/TestAlertChannels";
import { AlertDeliveryControl } from "@/components/engineer/AlertDeliveryControl";
import { AlertTemplates } from "@/components/engineer/AlertTemplates";
import {
  getAlertDeliveryState,
  getMaintenanceState,
  type AlertDeliveryState,
  type MaintenanceState,
} from "./actions";
import { LoadError } from "@/components/shared/LoadError";

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
 *
 * WHAT IS NO LONGER HERE. The failed sign-in summary and the blocked-source
 * table used to sit beside the switch. Both are about the LOGIN rather than
 * about this control, and they now live on /engineer/login-failures next to the
 * attempts that produced them — one page to read about an attack, one page to
 * pause the site. Their reads moved with them; this page fetches only the
 * switch.
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
  // unprovisioned user (a real 401/403) — to the dashboard.
  // Split the two failures apart (#688). A 401/403 — or a successful read that
  // simply lacks the role — is the backend's answer, and the redirect below is
  // correct. An unreadable context (5xx, timeout, unreachable) is not an answer
  // at all: bouncing then strands a legitimate user on a dashboard that is
  // failing for the same reason, under a URL they never asked for, and the
  // report comes back as "the console vanished" instead of "the API is down".
  // `gate` stays null on anything but a verified-success read, so the page can
  // only render for someone we positively confirmed.
  const auth = await readAuthContext();
  if (auth.status === "unavailable") {
    return (
      <AccessCheckError
        status={auth.httpStatus}
        breadcrumb={[
          { label: "Engineer", href: "/engineer" },
          { label: "Maintenance mode" },
        ]}
      />
    );
  }
  const gate = auth.status === "ok" ? auth.ctx : null;
  if (!gate || !isEngineer(gate.roles)) redirect("/dashboard");

  // The only read this page makes, and its failure is held in its own variable
  // and rendered in place of the switch ALONE. The alert-channel card below is a
  // separate control with its own backend call, so an unreachable /maintenance
  // must not be able to take it off the screen — the same independence the two
  // tables used to have here, kept for what is left.
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

  // A second independent read, in its own variables: this one says WHERE an
  // alert would go, and an unhappy endpoint must not be able to take the
  // maintenance switch off the screen.
  let delivery: AlertDeliveryState | null = null;
  let deliveryError: ApiError | null = null;
  try {
    delivery = await getAlertDeliveryState();
  } catch (e) {
    deliveryError =
      e instanceof ApiError
        ? e
        : new ApiError(0, "Failed to load the alert delivery setting.");
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

        {/*
          One column, capped at the width the prose on this page already used.

          The two-column `xl` grid existed to stand a six-column table beside the
          switch. With the tables moved to Login failures there is nothing to put
          in a second column, and stretching a switch and four short paragraphs
          across a 27-inch monitor would give a half-empty screen and an
          unreadably long measure. `max-w-2xl` is exactly what the explanatory
          list was already constrained to, so this is the reading column the page
          always had with the scaffolding removed — and it matches the other
          engineer console pages, which are all a single column. It also settles
          the old grid's one oddity: nothing reorders on a phone any more,
          because there is only ever one order.
        */}
        <div className="max-w-2xl space-y-8">
          {/* Wrapped in its own element rather than spread into the stack: the
              switch block sets its own internal spacing (the `mt-3` timestamp
              sits tight under the card), and `space-y-8` on a shared parent
              would override it. */}
          <div>
            {error || !state ? (
              <LoadError
                status={error?.status ?? 0}
                noun="the maintenance state"
                title={
                  error?.status === 403 ? "Engineer access required" : undefined
                }
                message={
                  error?.status === 403
                    ? "Maintenance mode is restricted to engineers."
                    : undefined
                }
              />
            ) : (
              <>
                <Card
                  className={`p-5${state.enabled ? " border-danger-600" : ""}`}
                >
                  <MaintenanceModeControl state={state} />
                </Card>

                {state.enabled ? (
                  <p className="mt-3 text-sm text-gray-500">
                    Turned on {formatDateTime(state.enabled_at)}
                    {state.enabled_by_email
                      ? ` by ${state.enabled_by_email}`
                      : ""}
                    .
                  </p>
                ) : null}

                <div className="mt-8">
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
                        signed out within about 20 seconds. Those sessions are
                        gone for good — turning maintenance back off does not
                        restore them, so everyone signs in again.
                      </dd>
                    </div>
                    <div>
                      <dt className="font-medium text-gray-700">
                        Blocks sign-in
                      </dt>
                      <dd>
                        Non-engineers cannot sign in, and any request they make
                        with a token they already hold is refused. This is
                        enforced by the backend on every route, not just on the
                        login screen.
                      </dd>
                    </div>
                    <div>
                      <dt className="font-medium text-gray-700">
                        Shows a maintenance page
                      </dt>
                      <dd>
                        Visitors get a plain “temporarily unavailable” page with
                        your message. It reveals nothing about why the site is
                        down or who took it down.
                      </dd>
                    </div>
                    <div>
                      <dt className="font-medium text-gray-700">
                        Leaves engineers alone
                      </dt>
                      <dd>
                        Engineers keep their session, keep full access, and can
                        sign in normally throughout — which is what guarantees
                        this switch can always be turned back off. Super admins
                        are{" "}
                        <span className="font-medium text-gray-700">not</span>{" "}
                        exempt; only the engineer role is.
                      </dd>
                    </div>
                  </dl>
                </div>
              </>
            )}
          </div>

          {/* The three alerting controls, in the order the questions get
              asked: where does an alert go, do those channels answer, and what
              does it say. */}
          {delivery ? (
            <AlertDeliveryControl state={delivery} />
          ) : (
            <LoadError
              status={deliveryError?.status ?? 0}
              noun="the alert delivery setting"
            />
          )}
          <TestAlertChannels />
          <AlertTemplates />
        </div>
      </main>
    </>
  );
}
