import Link from "next/link";
import { ApiError } from "@/lib/api";
import { readAuthContext } from "@/lib/auth-context";
import { AccessCheckError } from "@/components/shared/AccessCheckError";
import { Topbar } from "@/components/shell/Topbar";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { redirect } from "next/navigation";
import { isEngineer } from "@/constants/roles";
import { getLoginFailures, type LoginFailurePage, type LoginFailureRow } from "./actions";
import { LoadError } from "@/components/shared/LoadError";

const LIMIT = 50;

// All times are shown in Utah time (Mountain). America/Denver tracks MST/MDT
// automatically, and timeZoneName: "short" stamps each row with the active
// abbreviation (MST/MDT) so it's unambiguous. Matches the Logins tab exactly.
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

// "Provo, UT, US" from whatever parts are present, or "—" when no geo was
// captured (e.g. local dev, or attempts recorded before location tracking).
function formatLocation(r: LoginFailureRow): string {
  const parts = [r.city, r.region, r.country].filter(Boolean);
  return parts.length ? parts.join(", ") : "—";
}

type SP = { offset?: string };

/**
 * Engineer-only Login failures tab: the FAILED sign-in attempts recorded by the
 * login flow (bad password, unknown email, locked account, etc.). Gated to
 * engineers in the UI (the sidebar link is engineer-only too) and the backend
 * re-enforces RequireEngineer on GET /admin/login-failures. The attempted email
 * is snapshotted per attempt and may not belong to any account (a probe/typo).
 */
export default async function LoginFailuresPage({
  searchParams,
}: {
  searchParams: Promise<SP>;
}) {
  // Role gate (defense-in-depth): login failures are engineer-only. The
  // /engineer/* route group is already gated in engineer/layout.tsx; this
  // page-level check is belt-and-suspenders. Redirect non-engineers — and any
  // authed-but-unprovisioned user (a real 401/403) — to the
  // dashboard rather than rendering a dead-end shell. The backend re-enforces
  // RequireEngineer on GET /admin/login-failures.
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
          { label: "Login failures" },
        ]}
      />
    );
  }
  const gate = auth.status === "ok" ? auth.ctx : null;
  if (!gate || !isEngineer(gate.roles)) redirect("/dashboard");

  const sp = await searchParams;
  const offset = Math.max(0, Number(sp.offset ?? "0") || 0);

  let data: LoginFailurePage | null = null;
  let error: ApiError | null = null;
  try {
    data = await getLoginFailures(LIMIT, offset);
  } catch (e) {
    error =
      e instanceof ApiError ? e : new ApiError(0, "Failed to load login failures.");
  }

  const rows = data?.items ?? null;
  const from = data && data.total > 0 ? offset + 1 : 0;
  const to = data ? Math.min(offset + LIMIT, data.total) : 0;
  const hasPrev = offset > 0;
  const hasNext = data ? offset + LIMIT < data.total : false;
  const pageHref = (newOffset: number) =>
    newOffset > 0
      ? `/engineer/login-failures?offset=${newOffset}`
      : "/engineer/login-failures";

  return (
    <>
      <Topbar
        breadcrumb={[
          { label: "Engineer", href: "/engineer" },
          { label: "Login failures" },
        ]}
      />
      <main className="flex-1 overflow-auto p-6">
        <h1 className="sr-only">Login failures</h1>
        <div className="mb-4 flex items-start justify-between gap-4">
          <p className="max-w-2xl text-sm text-gray-500">
            Every failed sign-in attempt with a captured location, newest first.
            The attempted email is snapshotted as typed and may not belong to any
            account (a probe or typo). Times are shown in{" "}
            <span className="font-medium text-gray-700">Utah time (Mountain)</span>;
            location is approximate (IP-based).
          </p>
        </div>

        {error ? (
          <LoadError
            status={error.status}
            noun="the login failures"
            title={error.status === 403 ? "Engineer access required" : undefined}
            message={
              error.status === 403
                ? "The login-failure history is restricted to engineers."
                : undefined
            }
          />
        ) : rows && rows.length === 0 ? (
          <Card className="p-10 text-center text-sm text-gray-500">
            No failed logins recorded. They’ll appear here when a sign-in fails.
          </Card>
        ) : (
          <>
            {/* Mobile: stacked cards */}
            <div className="space-y-2 md:hidden">
              {rows!.map((r) => (
                <Card key={r.login_failure_id} className="p-3">
                  <p className="text-sm font-medium text-gray-900">{r.email}</p>
                  <p className="mt-1 text-xs text-gray-500">
                    {formatDateTime(r.occurred_at)}
                    {r.reason ? ` · ${r.reason}` : ""}
                  </p>
                  <p className="mt-1 text-xs text-gray-500">
                    {formatLocation(r)}
                    {r.ip_address ? ` · ${r.ip_address}` : ""}
                  </p>
                </Card>
              ))}
            </div>

            {/* Desktop: table */}
            <Card className="hidden overflow-hidden p-0 md:block">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-200 bg-gray-50 text-left text-xs font-semibold text-gray-500">
                    <th className="w-56 px-4 py-3">Date / time (Utah)</th>
                    <th className="px-4 py-3">Email</th>
                    <th className="w-48 px-4 py-3">Location</th>
                    <th className="w-40 px-4 py-3">IP address</th>
                    <th className="w-40 px-4 py-3">Reason</th>
                  </tr>
                </thead>
                <tbody>
                  {rows!.map((r) => (
                    <tr
                      key={r.login_failure_id}
                      className="border-b border-gray-200 last:border-0 hover:bg-gray-50"
                    >
                      <td className="px-4 py-3 text-gray-700">
                        {formatDateTime(r.occurred_at)}
                      </td>
                      <td className="px-4 py-3 text-gray-700">{r.email}</td>
                      <td className="px-4 py-3 text-gray-700">
                        {formatLocation(r)}
                      </td>
                      <td className="px-4 py-3 font-mono text-xs text-gray-500">
                        {r.ip_address ?? "—"}
                      </td>
                      <td className="px-4 py-3 text-gray-700">
                        {r.reason ?? "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </Card>

            <div className="mt-3 flex items-center justify-between text-sm text-gray-500">
              <span className="tabular-nums">
                Showing {from}–{to} of {data!.total}
              </span>
              <div className="flex gap-2">
                <PageLink href={pageHref(offset - LIMIT)} enabled={hasPrev} label="‹ Prev" />
                <PageLink href={pageHref(offset + LIMIT)} enabled={hasNext} label="Next ›" />
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
