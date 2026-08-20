import Link from "next/link";
import { redirect } from "next/navigation";
import { apiGet, ApiError } from "@/lib/api";
import { readAuthContext } from "@/lib/auth-context";
import { AccessCheckError } from "@/components/shared/AccessCheckError";
import { LoadError } from "@/components/shared/LoadError";
import { Topbar } from "@/components/shell/Topbar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { RevokeSession } from "@/components/engineer/RevokeSession";
import { isEngineer, roleLabel } from "@/constants/roles";
import { formatAge, sessionTone } from "@/lib/sessionAge";

/**
 * LOCAL TYPES — replace with the generated ones once the backend lands on dev.
 *
 * `api.gen.ts` is generated from the API's OpenAPI schema and must never be
 * hand-edited, and GET /admin/sessions does not exist in the deployed schema
 * yet. After fa-web-api's `feat/engineer-session-management` is merged to dev,
 * regenerate and swap these for `components["schemas"]["ActiveSessionRow"]` and
 * `components["schemas"]["ActiveSessionPage"]` (the revoke response is
 * `SessionRevokeResult`, used in ./actions.ts).
 */
interface ActiveSessionRow {
  session_id: string;
  user_id: number | null;
  email: string | null;
  roles: string[];
  account_active: boolean;
  created_at: string;
  last_active_at: string;
  refreshed_at: string | null;
  age_seconds: number;
  idle_seconds: number;
  is_current: boolean;
  is_account_active_session: boolean;
}

interface ActiveSessionPage {
  items: ActiveSessionRow[];
  total: number;
  limit: number;
  offset: number;
}

const LIMIT = 50;

// Times are shown in Utah time (Mountain). America/Denver tracks MST/MDT
// automatically, and timeZoneName: "short" stamps each row with the active
// abbreviation so it is unambiguous. Same treatment as the Logins tab.
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

// Age is the point of this screen, so it is the one cell that changes colour.
// The text carries the meaning on its own ("5 weeks"); the tone only reinforces
// it, so nothing is encoded by colour alone (UX-UI.md).
const AGE_VARIANT = {
  fresh: "neutral",
  watch: "warning",
  stale: "danger",
} as const;

type SP = { offset?: string };

/**
 * Engineer-only Sessions tab: every LIVE Supabase session, oldest first.
 *
 * WHY THIS SCREEN EXISTS. Supabase sessions run for up to 400 days by default
 * and the app's idle timeout is browser-memory only (api #684, investigated and
 * deliberately left as is), so a session opened weeks ago is still a live
 * credential. Seeing one used to mean querying `auth.sessions` by hand against
 * production, and ending one meant writing a DELETE.
 *
 * Gated to engineers in the UI (the sidebar link is engineer-only, and the
 * /engineer/* route group is gated in engineer/layout.tsx); the backend
 * re-enforces RequireEngineer on GET /admin/sessions and on both revoke routes.
 */
export default async function SessionsPage({
  searchParams,
}: {
  searchParams: Promise<SP>;
}) {
  // Role gate (defense-in-depth), identical to the neighbouring engineer tabs.
  // Split the two failures apart (#688): a 401/403 — or a successful read that
  // simply lacks the role — is the backend's answer and the redirect is right.
  // An unreadable context (5xx, timeout, unreachable) is not an answer at all,
  // and bouncing would strand a legitimate user on a dashboard failing for the
  // same reason. `gate` stays null on anything but a verified-success read.
  const auth = await readAuthContext();
  if (auth.status === "unavailable") {
    return (
      <AccessCheckError
        status={auth.httpStatus}
        breadcrumb={[
          { label: "Engineer", href: "/engineer" },
          { label: "Sessions" },
        ]}
      />
    );
  }
  const gate = auth.status === "ok" ? auth.ctx : null;
  if (!gate || !isEngineer(gate.roles)) redirect("/dashboard");
  const meId: number | null = gate.user_id;

  const sp = await searchParams;
  const offset = Math.max(0, Number(sp.offset ?? "0") || 0);

  let data: ActiveSessionPage | null = null;
  let error: ApiError | null = null;
  try {
    data = await apiGet<ActiveSessionPage>(
      `/admin/sessions?limit=${LIMIT}&offset=${offset}`,
    );
  } catch (e) {
    error =
      e instanceof ApiError ? e : new ApiError(0, "Failed to load sessions.");
  }

  const rows = data?.items ?? null;
  const staleCount = rows?.filter((r) => sessionTone(r.age_seconds) === "stale")
    .length;
  const from = data && data.total > 0 ? offset + 1 : 0;
  const to = data ? Math.min(offset + LIMIT, data.total) : 0;
  const hasPrev = offset > 0;
  const hasNext = data ? offset + LIMIT < data.total : false;
  const pageHref = (newOffset: number) =>
    newOffset > 0
      ? `/engineer/sessions?offset=${newOffset}`
      : "/engineer/sessions";

  return (
    <>
      <Topbar
        breadcrumb={[
          { label: "Engineer", href: "/engineer" },
          { label: "Sessions" },
        ]}
      />
      <main className="flex-1 overflow-auto p-6">
        <h1 className="sr-only">Active sessions</h1>
        <p className="mb-4 max-w-2xl text-sm text-gray-500">
          Everyone signed in right now, <span className="font-medium text-gray-700">oldest
          first</span>. Sign-ins stay valid for a long time on their own, so a
          session can sit open for weeks — revoking one deletes the sign-in so it
          can never be refreshed and stops the token already in the browser
          within seconds. Times are shown in{" "}
          <span className="font-medium text-gray-700">Utah time (Mountain)</span>.
        </p>

        {/* The headline the screen exists to deliver: how many have been open
            longer than a working week. Shown only when there is something to
            say, so a healthy list stays quiet rather than carrying a "0" alarm.
            First page only — the list is oldest-first, so every stale session is
            on it, and "they are at the top of the list" would be a lie further
            in. */}
        {rows && staleCount && offset === 0 ? (
          <Card className="mb-4 border-danger-600/30 bg-danger-50 p-4">
            <p className="text-sm text-danger-600">
              <span className="font-semibold">
                {staleCount} session{staleCount === 1 ? " has" : "s have"} been
                open for more than a week.
              </span>{" "}
              {staleCount === 1 ? "It is" : "They are"} at the top of the list.
            </p>
          </Card>
        ) : null}

        {error ? (
          <LoadError
            status={error.status}
            noun="the active sessions"
            title={error.status === 403 ? "Engineer access required" : undefined}
            message={
              error.status === 403
                ? "Active sessions are restricted to engineers."
                : undefined
            }
          />
        ) : rows && rows.length === 0 ? (
          // Quiet, not alarming: nobody signed in is a perfectly normal state
          // and reads as reassurance rather than a failure. An empty page that
          // is merely PAST the end of the list says so instead, so a stale
          // offset never reads as "everyone is signed out".
          <Card className="p-10 text-center text-sm text-gray-500">
            {data!.total === 0 ? (
              <>
                No one is signed in right now. Sessions appear here as people log
                in.
              </>
            ) : (
              <>
                Nothing on this page.{" "}
                <Link
                  href="/engineer/sessions"
                  className="font-medium text-brand-blue-600 hover:underline"
                >
                  Back to the first page
                </Link>
                .
              </>
            )}
          </Card>
        ) : (
          <>
            {/* Mobile: stacked cards */}
            <div className="space-y-2 md:hidden">
              {rows!.map((r) => (
                <Card key={r.session_id} className="p-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-gray-900">
                        {r.email ?? "Unrecognised account"}
                        {r.is_current ? (
                          <span className="ml-1.5 text-xs font-medium text-brand-blue-600">
                            (this device)
                          </span>
                        ) : null}
                      </p>
                      <p className="mt-1 text-xs text-gray-500">
                        {r.roles.map(roleLabel).join(", ") || "No role"}
                      </p>
                    </div>
                    <Badge variant={AGE_VARIANT[sessionTone(r.age_seconds)]}>
                      {formatAge(r.age_seconds)}
                    </Badge>
                  </div>
                  <p className="mt-2 text-xs text-gray-500">
                    Started {formatDateTime(r.created_at)}
                  </p>
                  <p className="mt-1 text-xs text-gray-500">
                    Last active {formatDateTime(r.last_active_at)}
                  </p>
                  <div className="mt-3 flex gap-2">
                    <RevokeSession
                      scope="session"
                      sessionId={r.session_id}
                      userId={r.user_id}
                      email={r.email}
                      ageSeconds={r.age_seconds}
                      isCurrent={r.is_current}
                      isOwnAccount={meId !== null && r.user_id === meId}
                    />
                    <RevokeSession
                      scope="user"
                      sessionId={r.session_id}
                      userId={r.user_id}
                      email={r.email}
                      ageSeconds={r.age_seconds}
                      isCurrent={r.is_current}
                      isOwnAccount={meId !== null && r.user_id === meId}
                    />
                  </div>
                </Card>
              ))}
            </div>

            {/* Desktop: table */}
            <Card className="hidden overflow-hidden p-0 md:block">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-200 bg-gray-50 text-left text-xs font-semibold text-gray-500">
                    <th className="px-4 py-3">User</th>
                    <th className="w-32 px-4 py-3">Role</th>
                    <th className="w-56 px-4 py-3">Started (Utah)</th>
                    <th className="w-56 px-4 py-3">Last active (Utah)</th>
                    <th className="w-28 px-4 py-3">Age</th>
                    <th className="w-48 px-4 py-3 text-right">
                      <span className="sr-only">Actions</span>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {rows!.map((r) => {
                    const tone = sessionTone(r.age_seconds);
                    const mine = meId !== null && r.user_id === meId;
                    return (
                      <tr
                        key={r.session_id}
                        className={`border-b border-gray-200 last:border-0 hover:bg-gray-50 ${
                          tone === "stale" ? "bg-danger-50/40" : ""
                        }`}
                      >
                        <td className="px-4 py-3 text-gray-700">
                          {r.email ?? "Unrecognised account"}
                          {r.is_current ? (
                            <span className="ml-1.5 text-xs font-medium text-brand-blue-600">
                              (this device)
                            </span>
                          ) : null}
                          {r.user_id === null ? (
                            <Badge variant="warning" className="ml-2">
                              no app account
                            </Badge>
                          ) : null}
                          {!r.account_active && r.user_id !== null ? (
                            <Badge variant="muted" className="ml-2">
                              deactivated
                            </Badge>
                          ) : null}
                        </td>
                        <td className="px-4 py-3 text-gray-700">
                          {r.roles.map(roleLabel).join(", ") || "—"}
                        </td>
                        <td className="px-4 py-3 text-gray-700">
                          {formatDateTime(r.created_at)}
                        </td>
                        <td className="px-4 py-3 text-gray-700">
                          {formatDateTime(r.last_active_at)}
                        </td>
                        <td className="px-4 py-3">
                          <Badge variant={AGE_VARIANT[tone]}>
                            {formatAge(r.age_seconds)}
                          </Badge>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex justify-end gap-2">
                            <RevokeSession
                              scope="session"
                              sessionId={r.session_id}
                              userId={r.user_id}
                              email={r.email}
                              ageSeconds={r.age_seconds}
                              isCurrent={r.is_current}
                              isOwnAccount={mine}
                            />
                            <RevokeSession
                              scope="user"
                              sessionId={r.session_id}
                              userId={r.user_id}
                              email={r.email}
                              ageSeconds={r.age_seconds}
                              isCurrent={r.is_current}
                              isOwnAccount={mine}
                            />
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </Card>

            <div className="mt-3 flex items-center justify-between text-sm text-gray-500">
              <span className="tabular-nums">
                Showing {from}–{to} of {data!.total}
              </span>
              <div className="flex gap-2">
                <PageLink
                  href={pageHref(offset - LIMIT)}
                  enabled={hasPrev}
                  label="‹ Prev"
                />
                <PageLink
                  href={pageHref(offset + LIMIT)}
                  enabled={hasNext}
                  label="Next ›"
                />
              </div>
            </div>
          </>
        )}
      </main>
    </>
  );
}

function PageLink({
  href,
  enabled,
  label,
}: {
  href: string;
  enabled: boolean;
  label: string;
}) {
  return enabled ? (
    <Button asChild variant="secondary">
      <Link href={href}>{label}</Link>
    </Button>
  ) : (
    <Button variant="secondary" disabled>
      {label}
    </Button>
  );
}
