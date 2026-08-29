import Link from "next/link";
import { ScrollToTopOnPageChange } from "@/components/shared/ScrollToTopOnPageChange";
import { ApiError } from "@/lib/api";
import { readAuthContext } from "@/lib/auth-context";
import { AccessCheckError } from "@/components/shared/AccessCheckError";
import { Topbar } from "@/components/shell/Topbar";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { redirect } from "next/navigation";
import { isEngineer } from "@/constants/roles";
import {
  getLoginFailures,
  type LoginFailurePage,
  type LoginFailureRow,
} from "./actions";
import { LoadError } from "@/components/shared/LoadError";
import { LoginAttackTable } from "@/components/engineer/LoginAttackTable";
import { LoginBlockTable } from "@/components/engineer/LoginBlockTable";
import { DeleteLoginCampaign } from "@/components/engineer/DeleteLoginCampaign";
// Both login-security reads still live under ../maintenance. They were written
// there when the tables sat beside the switch, and they stayed put when the
// tables moved here: the two helper modules are a pair (./attack-sources and
// ./blocks describe the same incident from either end), the server actions are
// route-agnostic, and moving them would have churned every import for no
// behavioural change. Imported across rather than reimplemented, so the two
// screens cannot drift into describing one IP two different ways (#456).
import { getLoginAttackSources, getLoginIpBlocks } from "../maintenance/actions";
import {
  ATTACK_PANEL_DESCRIPTION,
  ATTACK_WINDOW_HOURS,
  attackPanelHref,
  attackPanelLabel,
  isAttackPanelOpen,
  type LoginAttackSourcePage,
} from "../maintenance/attack-sources";
import { type LoginIpBlockPage } from "../maintenance/blocks";

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

type SP = { offset?: string; attacks?: string };

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
  // COLLAPSED IS THE DEFAULT, and it is the default because the parameter is
  // absent — there is no initial value here that a later edit could invert.
  const attacksOpen = isAttackPanelOpen(sp.attacks);

  // Only fetched when the panel is open. Visiting the attempt list does not
  // spend a round trip, or write an audit row, for a panel nobody opened.
  let attacks: LoginAttackSourcePage | null = null;
  let attackError: ApiError | null = null;
  if (attacksOpen) {
    try {
      attacks = await getLoginAttackSources(ATTACK_WINDOW_HOURS);
    } catch (e) {
      attackError =
        e instanceof ApiError
          ? e
          : new ApiError(0, "Failed to load the failed sign-in summary.");
    }
  }

  // The blocked sources, read INDEPENDENTLY of both the summary above and the
  // attempt list below, and held in its own variables for the same reason they
  // are: this is the table that says who is currently being REFUSED, and an
  // unhappy /admin/login-ip-blocks must never be able to take the attempt list —
  // or the summary that explains it — off the screen. Unlike the summary this is
  // fetched on every visit rather than only when a panel is open: it is a short
  // list by construction (a source has to cross the abuse threshold to appear),
  // and "is the login refusing anyone right now" is not a question worth hiding
  // behind a click.
  let blocks: LoginIpBlockPage | null = null;
  let blockError: ApiError | null = null;
  try {
    blocks = await getLoginIpBlocks();
  } catch (e) {
    blockError =
      e instanceof ApiError
        ? e
        : new ApiError(0, "Failed to load the blocked sources.");
  }

  let data: LoginFailurePage | null = null;
  let error: ApiError | null = null;
  try {
    data = await getLoginFailures(LIMIT, offset);
  } catch (e) {
    error =
      e instanceof ApiError
        ? e
        : new ApiError(0, "Failed to load login failures.");
  }

  const rows = data?.items ?? null;
  // How many rows on THIS page share each source address. The delete acts on the
  // whole source, not the row it is rendered on, so its confirm uses this to
  // anchor "every failed sign-in from this address" in something the reader can
  // actually see — while still saying there may be more on the other pages.
  const attemptsByIp = new Map<string, number>();
  for (const r of rows ?? []) {
    if (r.ip_address)
      attemptsByIp.set(r.ip_address, (attemptsByIp.get(r.ip_address) ?? 0) + 1);
  }
  const from = data && data.total > 0 ? offset + 1 : 0;
  const to = data ? Math.min(offset + LIMIT, data.total) : 0;
  const hasPrev = offset > 0;
  const hasNext = data ? offset + LIMIT < data.total : false;
  // Paging must not collapse the panel out from under the reader, so the page
  // links carry its state too.
  const pageHref = (newOffset: number) =>
    attackPanelHref("/engineer/login-failures", {
      open: attacksOpen,
      offset: newOffset,
    });
  const togglePanelHref = attackPanelHref("/engineer/login-failures", {
    open: !attacksOpen,
    offset,
  });

  return (
    <>
      <Topbar
        breadcrumb={[
          { label: "Engineer", href: "/engineer" },
          { label: "Login failures" },
        ]}
      />
      <main className="flex-1 overflow-auto p-6">
        <ScrollToTopOnPageChange offset={offset} />
        <h1 className="sr-only">Login failures</h1>

        {/*
          The per-source summary, collapsed, above the per-attempt list. This is
          the page he actually opens when he goes looking, and on 2026-08-19 the
          question that mattered was not "what attempts happened" (750 rows of
          them) but "who is doing this" — three sources. The button is a link so
          the expanded view is a URL he can paste at someone.
        */}
        <div className="mb-5">
          <Button asChild variant="secondary">
            <Link
              href={togglePanelHref}
              aria-expanded={attacksOpen}
              aria-controls="attack-summary-panel"
            >
              {attackPanelLabel(attacksOpen)}
            </Link>
          </Button>
          {/* The joke is in the button; this line is the plain answer for
              someone reading it tired, and is deliberately joke-free. */}
          <p className="mt-2 text-sm text-gray-500">
            {ATTACK_PANEL_DESCRIPTION}
          </p>
          {attacksOpen ? (
            <div id="attack-summary-panel" className="mt-4">
              <LoginAttackTable
                data={attacks}
                error={attackError}
                windowHours={ATTACK_WINDOW_HOURS}
                showHeading={false}
                showAllAttemptsLink={false}
              />
            </div>
          ) : null}
        </div>

        {/*
          Blocked sources, between the summary and the attempts.

          This is where it answers something. The page is a list of failed
          sign-ins; the unavoidable next question is what was DONE about them,
          and on 2026-08-19 the answer was "nothing", which is why the automatic
          block exists at all. Reading order is therefore who is hitting the
          login (the summary, when opened), then who is being refused, then the
          individual attempts. It sits ABOVE the attempt list rather than after
          it because the list is paginated: anything below 50 rows and a pager is
          somewhere nobody looks, and this is the short table that says whether a
          real person is currently locked out. It also stays outside the
          collapsible panel — a table that can be refusing a colleague right now
          must not be hidden behind a toggle.
        */}
        <div className="mb-6">
          <LoginBlockTable data={blocks} error={blockError} />
        </div>

        <div className="mb-4 flex items-start justify-between gap-4">
          <p className="max-w-2xl text-sm text-gray-500">
            Every failed attempt, newest first. The email is as typed and may
            match no account; times are{" "}
            <span className="font-medium text-gray-700">Utah time</span>.
          </p>
        </div>

        {error ? (
          <LoadError
            status={error.status}
            noun="the login failures"
            title={
              error.status === 403 ? "Engineer access required" : undefined
            }
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
                  {r.ip_address ? (
                    <div className="mt-2">
                      <DeleteLoginCampaign
                        ipAddress={r.ip_address}
                        attemptsOnPage={attemptsByIp.get(r.ip_address) ?? 1}
                      />
                    </div>
                  ) : null}
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
                    {/* Per-SOURCE delete. Unlabelled because the button says
                        what it does and a column heading over one control
                        reads as a data column. */}
                    <th className="w-44 px-4 py-3">
                      <span className="sr-only">Delete campaign</span>
                    </th>
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
                      <td className="px-4 py-3 text-right">
                        {r.ip_address ? (
                          <DeleteLoginCampaign
                            ipAddress={r.ip_address}
                            attemptsOnPage={
                              attemptsByIp.get(r.ip_address) ?? 1
                            }
                          />
                        ) : null}
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
