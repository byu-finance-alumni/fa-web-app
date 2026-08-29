import Link from "next/link";
import { ScrollToTopOnPageChange } from "@/components/shared/ScrollToTopOnPageChange";
import { apiGet, ApiError } from "@/lib/api";
import { readAuthContext } from "@/lib/auth-context";
import { AccessCheckError } from "@/components/shared/AccessCheckError";
import { Topbar } from "@/components/shell/Topbar";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { redirect } from "next/navigation";
import { PurgeLoginsButton } from "./PurgeLoginsButton";
import { isEngineer } from "@/constants/roles";
import { LoadError } from "@/components/shared/LoadError";

interface LoginRow {
  login_event_id: number;
  user_id: number | null;
  email: string;
  occurred_at: string;
  ip_address: string | null;
  city: string | null;
  region: string | null;
  country: string | null;
}

interface LoginPage {
  items: LoginRow[];
  total: number;
  limit: number;
  offset: number;
}

const LIMIT = 50;

// All login times are shown in Utah time (Mountain). America/Denver tracks
// MST/MDT automatically, and timeZoneName: "short" stamps each row with the
// active abbreviation (MST/MDT) so it's unambiguous.
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
// captured (e.g. local dev, or logins recorded before location tracking).
function formatLocation(r: LoginRow): string {
  const parts = [r.city, r.region, r.country].filter(Boolean);
  return parts.length ? parts.join(", ") : "—";
}

type SP = { offset?: string };

/**
 * Engineer-only Logins tab: the sign-in history recorded by POST /auth/login.
 * Gated to engineers in the UI (the sidebar link is engineer-only too) and the
 * backend re-enforces RequireEngineer on GET /admin/logins. A deleted user's
 * past logins keep their snapshotted email (user_id null).
 */
export default async function LoginsPage({
  searchParams,
}: {
  searchParams: Promise<SP>;
}) {
  // Role gate (defense-in-depth): logins are engineer-only. The /engineer/*
  // route group is already gated in engineer/layout.tsx; this page-level check
  // is belt-and-suspenders. Redirect non-engineers — and any authed-but-
  // unprovisioned user (a real 401/403) — to the dashboard rather
  // than rendering a dead-end "access required" shell. The backend re-enforces
  // RequireEngineer on GET /admin/logins.
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
          { label: "Logins" },
        ]}
      />
    );
  }
  const gate = auth.status === "ok" ? auth.ctx : null;
  if (!gate || !isEngineer(gate.roles)) redirect("/dashboard");
  const meId: number | null = gate.user_id;

  const sp = await searchParams;
  const offset = Math.max(0, Number(sp.offset ?? "0") || 0);

  let data: LoginPage | null = null;
  let error: ApiError | null = null;
  try {
    data = await apiGet<LoginPage>(`/admin/logins?limit=${LIMIT}&offset=${offset}`);
  } catch (e) {
    error = e instanceof ApiError ? e : new ApiError(0, "Failed to load logins.");
  }

  const rows = data?.items ?? null;
  const from = data && data.total > 0 ? offset + 1 : 0;
  const to = data ? Math.min(offset + LIMIT, data.total) : 0;
  const hasPrev = offset > 0;
  const hasNext = data ? offset + LIMIT < data.total : false;
  const pageHref = (newOffset: number) =>
    newOffset > 0 ? `/engineer/logins?offset=${newOffset}` : "/engineer/logins";

  return (
    <>
      <Topbar breadcrumb={[{ label: "Engineer", href: "/engineer" }, { label: "Logins" }]} />
      <main className="flex-1 overflow-auto p-6">
        <ScrollToTopOnPageChange offset={offset} />
        <h1 className="sr-only">Login history</h1>
        <div className="mb-4 flex items-start justify-between gap-4">
          <p className="max-w-2xl text-sm text-gray-500">
            Every sign-in with a captured location, newest first. Recorded when a
            user logs in; a removed user’s past sign-ins keep the email they used.
            Times are shown in <span className="font-medium text-gray-700">Utah
            time (Mountain)</span>; location is approximate (IP-based).
          </p>
          {!error && <PurgeLoginsButton />}
        </div>

        {error ? (
          <LoadError
            status={error.status}
            noun="the login history"
            title={error.status === 403 ? "Engineer access required" : undefined}
            message={
              error.status === 403
                ? "The login history is restricted to engineers."
                : undefined
            }
          />
        ) : rows && rows.length === 0 ? (
          <Card className="p-10 text-center text-sm text-gray-500">
            No sign-ins recorded yet. They’ll appear here as users log in.
          </Card>
        ) : (
          <>
            {/* Mobile: stacked cards */}
            <div className="space-y-2 md:hidden">
              {rows!.map((r) => (
                <Card key={r.login_event_id} className="p-3">
                  <p className="text-sm font-medium text-gray-900">
                    {r.email}
                    {meId !== null && r.user_id === meId ? (
                      <span className="ml-1.5 text-xs font-medium text-brand-blue-600">
                        (you)
                      </span>
                    ) : null}
                  </p>
                  <p className="mt-1 text-xs text-gray-500">
                    {formatDateTime(r.occurred_at)}
                    {r.user_id === null ? " · account removed" : ""}
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
                    <th className="px-4 py-3">User</th>
                    <th className="w-48 px-4 py-3">Location</th>
                    <th className="w-40 px-4 py-3">IP address</th>
                  </tr>
                </thead>
                <tbody>
                  {rows!.map((r) => (
                    <tr
                      key={r.login_event_id}
                      className="border-b border-gray-200 last:border-0 hover:bg-gray-50"
                    >
                      <td className="px-4 py-3 text-gray-700">
                        {formatDateTime(r.occurred_at)}
                      </td>
                      <td className="px-4 py-3 text-gray-700">
                        {r.email}
                        {meId !== null && r.user_id === meId ? (
                          <span className="ml-1.5 text-xs font-medium text-brand-blue-600">
                            (you)
                          </span>
                        ) : null}
                        {r.user_id === null ? (
                          <Badge variant="muted" className="ml-2">
                            account removed
                          </Badge>
                        ) : null}
                      </td>
                      <td className="px-4 py-3 text-gray-700">
                        {formatLocation(r)}
                      </td>
                      <td className="px-4 py-3 font-mono text-xs text-gray-500">
                        {r.ip_address ?? "—"}
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
