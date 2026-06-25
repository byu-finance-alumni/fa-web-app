"use client";

import Link from "next/link";
import { useState } from "react";
import {
  AlertTriangle,
  ChevronDown,
  ChevronRight,
  ExternalLink,
} from "lucide-react";
import type { ImportRow } from "@/types/alumni";
import { Badge } from "@/components/ui/badge";

/** Pretty-print a before/after value for a change diff. */
function fmt(v: unknown): string {
  if (v === null || v === undefined || v === "") return "—";
  if (typeof v === "boolean") return v ? "Yes" : "No";
  return String(v);
}

/**
 * Scrollable per-row report. Each row shows a status badge, the parsed name and
 * source row #, plus a count of changes/warnings/blockers; expanding a row
 * reveals the auto-clean diffs, duplicate/missing warnings (linking the matched
 * record), and any fatal blockers/error. Rejected rows are tinted danger so
 * they stand out at a glance.
 */
export function ImportReviewTable({ rows }: { rows: ImportRow[] }) {
  if (rows.length === 0) {
    return (
      <div className="rounded-lg border border-gray-200 bg-white p-8 text-center text-sm text-gray-500">
        The file has no data rows.
      </div>
    );
  }
  return (
    <div className="overflow-hidden rounded-lg border border-gray-200 bg-white shadow-card">
      <div className="max-h-[28rem] overflow-auto">
        <table className="w-full border-collapse text-sm">
          <thead className="sticky top-0 z-10 bg-gray-50 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">
            <tr>
              <th className="w-10 px-3 py-2" />
              <th className="w-28 px-3 py-2">Status</th>
              <th className="w-16 px-3 py-2 text-right">Row</th>
              <th className="px-3 py-2">Name</th>
              <th className="px-3 py-2">Findings</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <ReviewRow key={row.row} row={row} />
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function ReviewRow({ row }: { row: ImportRow }) {
  const [open, setOpen] = useState(false);
  const rejected = row.status === "rejected";
  const hasDetail =
    row.changes.length > 0 ||
    row.warnings.length > 0 ||
    row.blockers.length > 0 ||
    !!row.error;

  return (
    <>
      <tr
        className={`border-t border-gray-200 ${
          rejected ? "bg-danger-50/60" : "hover:bg-gray-50"
        } ${hasDetail ? "cursor-pointer" : ""}`}
        onClick={hasDetail ? () => setOpen((o) => !o) : undefined}
      >
        <td className="px-3 py-2 align-top">
          {hasDetail ? (
            <button
              type="button"
              aria-label={open ? "Collapse row" : "Expand row"}
              aria-expanded={open}
              className="text-gray-500"
              onClick={(e) => {
                e.stopPropagation();
                setOpen((o) => !o);
              }}
            >
              {open ? (
                <ChevronDown className="h-4 w-4" />
              ) : (
                <ChevronRight className="h-4 w-4" />
              )}
            </button>
          ) : null}
        </td>
        <td className="px-3 py-2 align-top">
          <StatusBadge status={row.status} />
        </td>
        <td className="px-3 py-2 text-right align-top tabular-nums text-gray-500">
          {row.row}
        </td>
        <td className="px-3 py-2 align-top font-medium text-gray-900">
          {row.name || "—"}
        </td>
        <td className="px-3 py-2 align-top text-gray-700">
          <div className="flex flex-wrap gap-1.5">
            {row.changes.length > 0 && (
              <Badge variant="tag">{row.changes.length} cleaned</Badge>
            )}
            {row.warnings.length > 0 && (
              <Badge variant="warning">
                {row.warnings.length} warning
                {row.warnings.length === 1 ? "" : "s"}
              </Badge>
            )}
            {(row.blockers.length > 0 || row.error) && (
              <Badge variant="danger">
                {row.blockers.length + (row.error ? 1 : 0)} blocker
                {row.blockers.length + (row.error ? 1 : 0) === 1 ? "" : "s"}
              </Badge>
            )}
            {!hasDetail && <span className="text-gray-400">Clean</span>}
          </div>
        </td>
      </tr>

      {open && hasDetail && (
        <tr className={rejected ? "bg-danger-50/40" : "bg-gray-50"}>
          <td />
          <td colSpan={4} className="px-3 pb-3 pt-1 align-top">
            <div className="space-y-3">
              {row.error && (
                <div className="rounded-lg border border-danger-600/30 bg-danger-50 px-3 py-2 text-sm text-danger-600">
                  {row.error}
                </div>
              )}

              {row.blockers.length > 0 && (
                <Section title="Blockers" tone="danger">
                  <ul className="space-y-1.5">
                    {row.blockers.map((b, i) => (
                      <li
                        key={`${b.code}-${i}`}
                        className="flex items-start gap-1.5 text-sm text-danger-600"
                      >
                        <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                        <span>
                          {b.field ? (
                            <span className="font-medium">{b.field}: </span>
                          ) : null}
                          {b.message}
                          {b.alumni_id != null && (
                            <DupLink id={b.alumni_id} />
                          )}
                        </span>
                      </li>
                    ))}
                  </ul>
                </Section>
              )}

              {row.warnings.length > 0 && (
                <Section title="Warnings" tone="warning">
                  <ul className="space-y-1.5">
                    {row.warnings.map((w, i) => (
                      <li
                        key={`${w.code}-${i}`}
                        className="text-sm text-warning-600"
                      >
                        {w.message}
                        {w.alumni_id != null && <DupLink id={w.alumni_id} />}
                      </li>
                    ))}
                  </ul>
                </Section>
              )}

              {row.changes.length > 0 && (
                <Section title="Auto-cleaned" tone="info">
                  <ul className="space-y-1 text-sm text-gray-700">
                    {row.changes.map((c, i) => (
                      <li key={`${c.field}-${i}`}>
                        <span className="font-medium text-gray-900">
                          {c.label}:
                        </span>{" "}
                        <span className="text-gray-500 line-through">
                          {fmt(c.before)}
                        </span>{" "}
                        <span aria-hidden="true">→</span>{" "}
                        <span className="text-gray-900">{fmt(c.after)}</span>
                      </li>
                    ))}
                  </ul>
                </Section>
              )}
            </div>
          </td>
        </tr>
      )}
    </>
  );
}

function StatusBadge({ status }: { status: ImportRow["status"] }) {
  if (status === "importable") {
    return <Badge variant="success">Importable</Badge>;
  }
  return <Badge variant="danger">Rejected</Badge>;
}

function Section({
  title,
  tone,
  children,
}: {
  title: string;
  tone: "info" | "warning" | "danger";
  children: React.ReactNode;
}) {
  const dot =
    tone === "warning"
      ? "text-warning-600"
      : tone === "danger"
        ? "text-danger-600"
        : "text-brand-blue-600";
  return (
    <div>
      <p
        className={`mb-1 text-xs font-semibold uppercase tracking-wide ${dot}`}
      >
        {title}
      </p>
      {children}
    </div>
  );
}

function DupLink({ id }: { id: number }) {
  return (
    <Link
      href={`/alumni/${id}`}
      onClick={(e) => e.stopPropagation()}
      className="ml-1 inline-flex items-center gap-0.5 font-medium text-brand-blue-600 underline hover:text-brand-blue-500"
    >
      View match #{id}
      <ExternalLink className="h-3 w-3" />
    </Link>
  );
}
