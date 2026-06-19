import Link from "next/link";
import { apiGet, ApiError } from "@/lib/api";
import { Topbar } from "@/components/shell/Topbar";
import type { UserContext } from "@/types/alumni";
import { ROLE } from "@/constants/roles";

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
  let isEngineer = false;
  let meId: number | null = null;
  try {
    const ctx = await apiGet<UserContext>("/auth/context");
    isEngineer = ctx.roles?.includes(ROLE.ENGINEER) ?? false;
    meId = ctx.user_id;
  } catch {
    /* fall through to the access-required screen */
  }

  if (!isEngineer) {
    return (
      <>
        <Topbar breadcrumb={[{ label: "Admin", href: "/admin" }, { label: "Logins" }]} />
        <main className="flex-1 overflow-auto p-6">
          <div className="rounded-xl border border-gray-300 bg-white p-10 text-center">
            <p className="font-medium text-gray-900">Engineer access required</p>
            <p className="mt-1 text-sm text-gray-500">
              Only an engineer can view the login history.
            </p>
          </div>
        </main>
      </>
    );
  }

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
    newOffset > 0 ? `/admin/logins?offset=${newOffset}` : "/admin/logins";

  return (
    <>
      <Topbar breadcrumb={[{ label: "Admin", href: "/admin" }, { label: "Logins" }]} />
      <main className="flex-1 overflow-auto p-6">
        <p className="mb-4 max-w-2xl text-sm text-gray-500">
          Every sign-in with a captured location, newest first. Recorded when a
          user logs in; a removed user’s past sign-ins keep the email they used.
          Times are shown in <span className="font-medium text-gray-700">Utah
          time (Mountain)</span>; location is approximate (IP-based).
        </p>

        {error ? (
          <div className="rounded-xl border border-gray-300 bg-white p-10 text-center">
            <p className="font-medium text-gray-900">
              {error.status === 403
                ? "Engineer access required"
                : "Couldn’t load the login history"}
            </p>
            <p className="mt-1 text-sm text-gray-500">
              {error.status === 403
                ? "The login history is restricted to engineers."
                : error.message}
            </p>
          </div>
        ) : rows && rows.length === 0 ? (
          <div className="rounded-xl border border-gray-300 bg-white p-10 text-center text-sm text-gray-500">
            No sign-ins recorded yet. They’ll appear here as users log in.
          </div>
        ) : (
          <>
            {/* Mobile: stacked cards */}
            <div className="space-y-2 md:hidden">
              {rows!.map((r) => (
                <div
                  key={r.login_event_id}
                  className="rounded-xl border border-gray-300 bg-white p-3"
                >
                  <p className="font-medium text-gray-900">
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
                </div>
              ))}
            </div>

            {/* Desktop: table */}
            <div className="hidden overflow-hidden rounded-xl border border-gray-300 bg-white md:block">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-300 bg-gray-50 text-center text-xs font-semibold uppercase tracking-wide text-gray-500">
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
                      className="border-b border-gray-300 last:border-0"
                    >
                      <td className="px-4 py-3 text-center text-gray-700">
                        {formatDateTime(r.occurred_at)}
                      </td>
                      <td className="px-4 py-3 text-center text-gray-700">
                        {r.email}
                        {meId !== null && r.user_id === meId ? (
                          <span className="ml-1.5 text-xs font-medium text-brand-blue-600">
                            (you)
                          </span>
                        ) : null}
                        {r.user_id === null ? (
                          <span className="ml-2 rounded-md bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-500">
                            account removed
                          </span>
                        ) : null}
                      </td>
                      <td className="px-4 py-3 text-center text-gray-700">
                        {formatLocation(r)}
                      </td>
                      <td className="px-4 py-3 text-center font-mono text-xs text-gray-500">
                        {r.ip_address ?? "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="mt-3 flex items-center justify-between text-sm text-gray-500">
              <span>
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
  const cls = "rounded-lg border border-gray-300 px-3 py-2 text-sm font-medium";
  return enabled ? (
    <Link href={href} className={`${cls} bg-white text-gray-700 hover:bg-gray-50`}>
      {label}
    </Link>
  ) : (
    <span className={`${cls} bg-gray-50 text-gray-300`}>{label}</span>
  );
}
