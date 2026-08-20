import Link from "next/link";
import { Card } from "@/components/ui/card";
import { ApiError } from "@/lib/api";
import { LoadError } from "@/components/shared/LoadError";
import {
  attackTypeLabel,
  emptyStateText,
  formatClock,
  formatDuration,
  formatLocation,
  splitAttackType,
  type LoginAttackSource,
  type LoginAttackSourcePage,
} from "@/app/(app)/engineer/maintenance/attack-sources";

/**
 * Failed sign-ins grouped by source IP, beside the maintenance switch.
 *
 * WHY IT IS ON THIS PAGE. On 2026-08-19 three sources ran a credential-guessing
 * campaign against production — 190 attempts across 68 addresses, 338 across 78,
 * and 222 across 202 in sixteen seconds. Nothing succeeded, and nothing said so:
 * it was found because the owner happened to go looking in the database. The
 * Maintenance page is the screen he opens when something is wrong, so the
 * question "is someone hitting us right now" is answered here rather than three
 * clicks away.
 *
 * It shows EVERY source with a failed sign-in in the window, not only the ones
 * over the detector's thresholds. A staff member mistyping their password twice
 * appears, labelled as what it is. That is deliberate: the empty and near-empty
 * states are what this table shows on almost every day it is looked at, and they
 * are the reassurance the page exists to give.
 *
 * Per-attempt detail — including the attempted addresses — is NOT duplicated
 * here; the header links to /engineer/login-failures, which already has it
 * behind the same engineer gate.
 */
export function LoginAttackTable({
  data,
  error,
  windowHours,
  showHeading = true,
  showAllAttemptsLink = true,
}: {
  data: LoginAttackSourcePage | null;
  error: ApiError | null;
  /** Hours summarised, or null for every attempt ever recorded. */
  windowHours: number | null;
  /**
   * Render the section heading. On the Maintenance page it names an otherwise
   * unlabelled column; inside the collapsed panel on the Login-failures page
   * the button the reader just pressed is the label, and repeating it is
   * clutter. Presentation only — the two callers must never diverge in what
   * they SHOW, only in what frames it.
   */
  showHeading?: boolean;
  /**
   * Link out to the per-attempt list. Suppressed on the Login-failures page,
   * where that list is the content directly underneath and the link would point
   * at the page you are already on.
   */
  showAllAttemptsLink?: boolean;
}) {
  const sources = data?.items ?? [];

  return (
    <section
      aria-label={showHeading ? undefined : "Failed sign-ins by source"}
      aria-labelledby={showHeading ? "attack-table-heading" : undefined}
    >
      {showHeading || showAllAttemptsLink ? (
        <div className="mb-3 flex items-baseline justify-between gap-3">
          {showHeading ? (
            <h2
              id="attack-table-heading"
              className="text-sm font-semibold text-gray-900"
            >
              Failed sign-ins by source
            </h2>
          ) : (
            <span />
          )}
          {showAllAttemptsLink ? (
            <Link
              href="/engineer/login-failures"
              className="shrink-0 text-sm font-medium text-brand-blue-600 hover:text-brand-blue-500"
            >
              Every attempt
            </Link>
          ) : null}
        </div>
      ) : null}

      {error ? (
        <LoadError
          status={error.status}
          noun="the failed sign-in summary"
          title={error.status === 403 ? "Engineer access required" : undefined}
          message={
            error.status === 403
              ? "The failed sign-in summary is restricted to engineers."
              : undefined
          }
        />
      ) : sources.length === 0 ? (
        <Card className="p-8 text-center text-sm text-gray-500">
          {emptyStateText(data?.window_hours ?? windowHours)}
        </Card>
      ) : (
        <>
          {/* Below md the page has already stacked this under the switch, so the
              dense table would be the only thing forcing a sideways scroll.
              Stacked rows instead — same data, same order (UX-UI.md). */}
          <div className="space-y-2 md:hidden">
            {sources.map((s) => (
              <SourceCard key={s.ip_address} source={s} />
            ))}
          </div>

          <Card className="hidden overflow-hidden p-0 md:block">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200 bg-gray-50 text-left text-xs font-semibold text-gray-500">
                  <th className="px-4 py-3">IP address</th>
                  <th className="px-4 py-3">Location</th>
                  <th className="px-4 py-3">Started (Mountain)</th>
                  <th className="px-4 py-3">Ended (Mountain)</th>
                  <th className="px-4 py-3 text-right">Attempts</th>
                  <th className="px-4 py-3">Type</th>
                </tr>
              </thead>
              <tbody>
                {sources.map((s) => (
                  <SourceRow key={s.ip_address} source={s} />
                ))}
              </tbody>
            </table>
          </Card>
        </>
      )}

      {/*
        The caveat has to sit next to the data, not in a docstring: `ip_address`
        is copied from the client's own `x-forwarded-for` header, so it can be
        forged to implicate someone innocent or rotated per request to escape the
        grouping. One line — short enough to actually be read during an incident.

        It no longer says "check the logs before blocking one": blocking is
        automatic now, so the useful instruction is the opposite one — the block
        may already have happened, and the row that says so is directly below.
      */}
      <p className="mt-3 text-xs text-gray-500">
        IP and location are self-reported and can be spoofed — treat a source as
        a lead, not proof.
      </p>
    </section>
  );
}

function SourceRow({ source }: { source: LoginAttackSource }) {
  const { detail } = splitAttackType(source.attack_type);
  return (
    <tr className="border-b border-gray-200 align-top last:border-0 hover:bg-gray-50">
      <td className="px-4 py-3 font-mono text-xs text-gray-700">
        {source.ip_address}
      </td>
      <td className="px-4 py-3 text-gray-700">{formatLocation(source)}</td>
      <td className="px-4 py-3 tabular-nums text-gray-700">
        {formatClock(source.first_seen)}
      </td>
      <td className="px-4 py-3 tabular-nums text-gray-700">
        {formatClock(source.last_seen)}
        {/* The line that separates a sixteen-second burst from a ten-minute
            grind. Without it the two read as the same event. */}
        <span className="mt-0.5 block text-xs text-gray-500">
          over {formatDuration(source.first_seen, source.last_seen)}
        </span>
      </td>
      <td className="px-4 py-3 text-right tabular-nums text-gray-700">
        {source.attempts.toLocaleString()}
        <span className="mt-0.5 block text-xs text-gray-500">
          {source.distinct_emails.toLocaleString()}{" "}
          {source.distinct_emails === 1 ? "address" : "addresses"}
        </span>
      </td>
      <td className="px-4 py-3">
        {/* Colour is the secondary cue only; the label itself says which it is,
            so this reads correctly in greyscale (UX-UI.md, Accessibility). */}
        <span
          className={
            source.is_attack ? "font-medium text-danger-600" : "text-gray-700"
          }
        >
          {attackTypeLabel(source.attack_type)}
        </span>
        {detail ? (
          <span className="mt-0.5 block text-xs text-gray-500">{detail}</span>
        ) : null}
      </td>
    </tr>
  );
}

function SourceCard({ source }: { source: LoginAttackSource }) {
  const { detail } = splitAttackType(source.attack_type);
  return (
    <Card className="p-3">
      <div className="flex items-baseline justify-between gap-3">
        <p className="font-mono text-xs text-gray-900">{source.ip_address}</p>
        <p
          className={
            source.is_attack
              ? "text-sm font-medium text-danger-600"
              : "text-sm text-gray-700"
          }
        >
          {attackTypeLabel(source.attack_type)}
        </p>
      </div>
      <p className="mt-1 text-xs text-gray-500">{formatLocation(source)}</p>
      <p className="mt-1 text-xs text-gray-500 tabular-nums">
        {source.attempts.toLocaleString()} attempts ·{" "}
        {source.distinct_emails.toLocaleString()}{" "}
        {source.distinct_emails === 1 ? "address" : "addresses"} · over{" "}
        {formatDuration(source.first_seen, source.last_seen)}
      </p>
      <p className="mt-1 text-xs text-gray-500 tabular-nums">
        {formatClock(source.first_seen)} – {formatClock(source.last_seen)}{" "}
        (Mountain)
      </p>
      {detail ? <p className="mt-1 text-xs text-gray-500">{detail}</p> : null}
    </Card>
  );
}
