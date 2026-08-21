import { Card } from "@/components/ui/card";
import { ApiError } from "@/lib/api";
import { LoadError } from "@/components/shared/LoadError";
import { LiftLoginBlock } from "@/components/engineer/LiftLoginBlock";
import {
  blockReason,
  blockState,
  blockStateLabel,
  blocksEmptyText,
  formatBlockLength,
  formatBlockTime,
  formatRemaining,
  type LoginIpBlock,
  type LoginIpBlockPage,
} from "@/app/(app)/engineer/maintenance/blocks";

/**
 * Sources the login is currently refusing, under the attack summary.
 *
 * WHY IT IS ON THE LOGIN FAILURES PAGE, beneath the summary it answers. The
 * attack table says who is hitting the login; this says what was DONE about
 * them, and the failed attempts that caused both are on the same screen. On
 * 2026-08-19 the answer to the second question was "nothing" — the campaigns
 * were detected and a human was told, because blocking was expected to happen at
 * the edge, which this account's plan does not include. Now a source that
 * crosses the same threshold is refused for an hour, and an engineer who wants
 * to know whether that is happening to a REAL person needs the two tables in one
 * glance.
 *
 * The history (lifted and lapsed rows, not only live ones) is shown for the same
 * reason: "has this ever fired on us?" is the question this feature will
 * actually be asked, and an empty active-only list cannot answer it.
 *
 * As on the attack table, there are no attempted email addresses here — only the
 * counts.
 */
export function LoginBlockTable({
  data,
  error,
}: {
  data: LoginIpBlockPage | null;
  error: ApiError | null;
}) {
  const blocks = data?.items ?? [];
  const enabled = data?.auto_block_enabled ?? true;

  return (
    <section aria-labelledby="login-blocks-heading">
      <div className="mb-3 flex items-baseline justify-between gap-3">
        <h2
          id="login-blocks-heading"
          className="text-sm font-semibold text-gray-900"
        >
          Blocked sources
        </h2>
        {/* The kill switch's state belongs beside the heading, not buried in the
            empty state: an engineer scanning this page has to be able to tell
            "nothing is blocked" from "nothing CAN be blocked" without reading a
            paragraph. */}
        {!enabled ? (
          <span className="shrink-0 text-sm font-medium text-danger-600">
            Automatic blocking is off
          </span>
        ) : null}
      </div>

      {error ? (
        <LoadError
          status={error.status}
          noun="the blocked sources"
          title={error.status === 403 ? "Engineer access required" : undefined}
          message={
            error.status === 403
              ? "Blocked sources are restricted to engineers."
              : undefined
          }
        />
      ) : blocks.length === 0 ? (
        <Card className="p-8 text-center text-sm text-gray-500">
          {blocksEmptyText(enabled)}
        </Card>
      ) : (
        <>
          {/* Stacked below md, same as the attack table: this is the narrower of
              the two, but a sideways scroll for one of them is worse than for
              neither (UX-UI.md). */}
          <div className="space-y-2 md:hidden">
            {blocks.map((b) => (
              <BlockCard key={b.block_id} block={b} />
            ))}
          </div>

          <Card className="hidden overflow-hidden p-0 md:block">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200 bg-gray-50 text-left text-xs font-semibold text-gray-500">
                  <th className="px-4 py-3">IP address</th>
                  <th className="px-4 py-3">State</th>
                  <th className="px-4 py-3">Blocked (Mountain)</th>
                  <th className="px-4 py-3">Why</th>
                  <th className="px-4 py-3 text-right">Action</th>
                </tr>
              </thead>
              <tbody>
                {blocks.map((b) => (
                  <BlockRow key={b.block_id} block={b} />
                ))}
              </tbody>
            </table>
          </Card>
        </>
      )}

      {/*
        The two facts that stop this table being misread — a block ends by
        itself, and an address is not an identity — in one line. It was a
        paragraph; the owner reads this page during an incident and prose is what
        gets scrolled past.
      */}
      <p className="mt-3 text-xs text-gray-500">
        Blocks last {formatBlockLength(data?.block_seconds ?? 3600)} and end on
        their own — lift one if it has caught a real person.
      </p>
    </section>
  );
}

function BlockRow({ block }: { block: LoginIpBlock }) {
  const state = blockState(block);
  return (
    <tr className="border-b border-gray-200 align-top last:border-0 hover:bg-gray-50">
      <td className="px-4 py-3 font-mono text-xs text-gray-700">
        {block.ip_address}
      </td>
      <td className="px-4 py-3">
        {/* Colour is the secondary cue only; the label says which it is, so this
            reads correctly in greyscale (UX-UI.md, Accessibility). */}
        <span
          className={
            state === "active"
              ? "font-medium text-danger-600"
              : "text-gray-700"
          }
        >
          {blockStateLabel(state)}
        </span>
        {state === "active" ? (
          <span className="mt-0.5 block text-xs text-gray-500 tabular-nums">
            {formatRemaining(block.blocked_until)}
          </span>
        ) : null}
      </td>
      <td className="px-4 py-3 tabular-nums text-gray-700">
        {formatBlockTime(block.blocked_at)}
        {block.lifted_at ? (
          <span className="mt-0.5 block text-xs text-gray-500">
            lifted {formatBlockTime(block.lifted_at)}
          </span>
        ) : null}
      </td>
      <td className="px-4 py-3 text-gray-700">{blockReason(block)}</td>
      <td className="px-4 py-3 text-right">
        {state === "active" ? (
          <LiftLoginBlock
            blockId={block.block_id}
            ipAddress={block.ip_address}
          />
        ) : (
          <span className="text-xs text-gray-500">—</span>
        )}
      </td>
    </tr>
  );
}

function BlockCard({ block }: { block: LoginIpBlock }) {
  const state = blockState(block);
  return (
    <Card className="p-3">
      <div className="flex items-baseline justify-between gap-3">
        <p className="font-mono text-xs text-gray-900">{block.ip_address}</p>
        <p
          className={
            state === "active"
              ? "text-sm font-medium text-danger-600"
              : "text-sm text-gray-700"
          }
        >
          {blockStateLabel(state)}
        </p>
      </div>
      <p className="mt-1 text-xs text-gray-500">{blockReason(block)}</p>
      <p className="mt-1 text-xs text-gray-500 tabular-nums">
        {formatBlockTime(block.blocked_at)} (Mountain)
        {state === "active" ? ` · ${formatRemaining(block.blocked_until)}` : ""}
      </p>
      {state === "active" ? (
        <div className="mt-2 flex justify-end">
          <LiftLoginBlock
            blockId={block.block_id}
            ipAddress={block.ip_address}
          />
        </div>
      ) : null}
    </Card>
  );
}
