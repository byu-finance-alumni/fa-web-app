"use client";

import Link from "next/link";
import { useEffect, useRef, useState, useTransition } from "react";
import {
  commitAttendeeSheet,
  downloadAttendeeSheetTemplate,
  previewAttendeeSheet,
} from "@/app/(app)/events/actions";
import { Badge, type BadgeProps } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import {
  STATUS_LABEL,
  applyChoice,
  candidateLabel,
  choiceCounts,
  choiceValue,
  draftFromRow,
  draftProblem,
  toCommitRows,
  type SheetDraft,
} from "@/lib/attendeeSheet";
import { isCsvFile } from "@/lib/attendeeMatch";
import type {
  SheetCommitResult,
  SheetPreview,
  SheetPreviewRow,
  SheetStatus,
} from "@/types/attendee-sheet";

type Step = "upload" | "confirm" | "done";
type Filter = "all" | "attention" | SheetStatus;

const STATUS_VARIANT: Record<SheetStatus, BadgeProps["variant"]> = {
  matched: "success",
  ambiguous: "warning",
  new_alumni: "tag",
  new_friend: "neutral",
  already_attending: "muted",
  invalid: "danger",
};

function saveCsv(filename: string, text: string) {
  const blob = new Blob([text], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <Card className="p-4">
      <p className="text-xs uppercase tracking-wide text-gray-500">{label}</p>
      <p className="text-2xl font-semibold tabular-nums text-navy-900">{value}</p>
    </Card>
  );
}

/**
 * Import an event's sign-up spreadsheet (api#693).
 *
 * 1. Upload: Fname, Lname, Company, Role, Email, Focus, UG, UG YR, LinkedIn,
 *    Grad, GradYR, Net ID (Net ID optional; other columns ignored).
 * 2. Confirm: every row is listed as Matched / Pick a match / New alum / New
 *    friend, and each can be edited or switched. NOTHING is saved before the
 *    Save button: the preview writes nothing.
 * 3. Done: what was added, created, or refused.
 */
export function AttendeeSheetWizard({
  eventId,
  eventName,
  initialFile,
  onRestart,
}: {
  eventId: number;
  eventName: string;
  /** A file already chosen on the combined "Import attendees" screen; checked on mount. */
  initialFile?: File;
  /** "Start over" goes back to the combined upload screen instead of this one's. */
  onRestart?: () => void;
}) {
  const [step, setStep] = useState<Step>("upload");
  const [file, setFile] = useState<File | null>(initialFile ?? null);
  const [fileError, setFileError] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [preview, setPreview] = useState<SheetPreview | null>(null);
  const [drafts, setDrafts] = useState<Record<number, SheetDraft>>({});
  const [editing, setEditing] = useState<number | null>(null);
  const [filter, setFilter] = useState<Filter>("all");
  const [result, setResult] = useState<SheetCommitResult | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [checking, startCheck] = useTransition();
  const [saving, startSave] = useTransition();
  const [templating, startTemplate] = useTransition();
  const inputRef = useRef<HTMLInputElement>(null);

  function pickFile(f: File | null) {
    setError(null);
    setPreview(null);
    if (f && !isCsvFile(f)) {
      setFile(null);
      setFileError("That isn't a CSV. Save the spreadsheet as CSV and try again.");
      return;
    }
    setFileError(null);
    setFile(f);
  }

  function onCheck() {
    if (!file) return;
    const fd = new FormData();
    fd.append("file", file, file.name);
    startCheck(async () => {
      const res = await previewAttendeeSheet(eventId, fd);
      if (!res.ok) {
        setError(res.error);
        return;
      }
      setPreview(res.data);
      if (!res.data.columns_ok) return;
      const next: Record<number, SheetDraft> = {};
      for (const r of res.data.rows) next[r.row] = draftFromRow(r);
      setDrafts(next);
      setFilter(
        res.data.rows.some((r) => r.status === "ambiguous") ? "attention" : "all",
      );
      setStep("confirm");
    });
  }

  // Run the check once for a file handed over by the combined upload screen.
  const autoChecked = useRef(false);
  useEffect(() => {
    if (initialFile && !autoChecked.current) {
      autoChecked.current = true;
      onCheck();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function onTemplate() {
    startTemplate(async () => {
      const res = await downloadAttendeeSheetTemplate();
      if (!res.ok) {
        setError(res.error);
        return;
      }
      saveCsv("event_attendee_sheet_template.csv", res.csv);
    });
  }

  const rows = preview?.rows ?? [];
  const draftList = rows.map((r) => drafts[r.row] ?? draftFromRow(r));
  const problems = rows
    .map((r, i) => ({ row: r.row, problem: draftProblem(draftList[i]) }))
    .filter((p) => p.problem != null);
  const counts = choiceCounts(draftList);
  const toSave = rows.length - counts.skip;

  const shown = (() => {
    if (filter === "all") return rows;
    if (filter === "attention") {
      return rows.filter(
        (r) =>
          r.status === "ambiguous" ||
          r.status === "invalid" ||
          r.warnings.length > 0 ||
          draftProblem(drafts[r.row] ?? draftFromRow(r)) != null,
      );
    }
    return rows.filter((r) => r.status === filter);
  })();

  function update(rowNum: number, patch: (d: SheetDraft) => SheetDraft) {
    setDrafts((prev) => {
      const current = prev[rowNum];
      return current ? { ...prev, [rowNum]: patch(current) } : prev;
    });
  }

  function onSave() {
    if (problems.length > 0 || toSave === 0) return;
    const body = toCommitRows(rows, drafts);
    startSave(async () => {
      const res = await commitAttendeeSheet(eventId, body);
      if (!res.ok) {
        setError(res.error);
        return;
      }
      setError(null);
      setResult(res.data);
      setStep("done");
    });
  }

  const steps: { key: Step; label: string }[] = [
    { key: "upload", label: "1. Upload the spreadsheet" },
    { key: "confirm", label: "2. Check and confirm" },
    { key: "done", label: "3. Done" },
  ];

  return (
    <div className="mx-auto w-full max-w-7xl space-y-6">
      <div className="space-y-2">
        <h2 className="text-lg font-semibold text-navy-900">
          Import attendee spreadsheet: {eventName}
        </h2>
        <ol className="flex flex-wrap gap-x-6 gap-y-1 text-sm">
          {steps.map((s) => (
            <li
              key={s.key}
              className={
                s.key === step ? "font-semibold text-brand-blue-700" : "text-gray-500"
              }
            >
              {s.label}
            </li>
          ))}
        </ol>
      </div>

      {error ? (
        <p className="text-sm text-danger-600" role="alert">
          {error}
        </p>
      ) : null}

      {step === "upload" ? (
        <Card className="space-y-4 p-6">
          <div className="space-y-2 text-sm text-gray-600">
            <p>
              Columns: <strong>Fname, Lname, Company, Role, Email, Focus, UG, UG YR,
              LinkedIn, Grad, GradYR, Net ID</strong>. Net ID can be missing or
              blank, and any other columns are ignored.
            </p>
            <p>
              A row is matched to someone already on file when the first name, last
              name and a grad year (UG YR or GradYR) all agree. Anyone else becomes a
              new <strong>alum</strong> if Focus or Grad says Fin or Finance, and a
              new <strong>friend</strong> otherwise.
            </p>
            <p>
              Nothing is saved yet. You&apos;ll see every row on the next screen and
              can change any of them before you confirm.
            </p>
          </div>

          <label
            onDragOver={(e) => {
              e.preventDefault();
              setDragOver(true);
            }}
            onDragLeave={() => setDragOver(false)}
            onDrop={(e) => {
              e.preventDefault();
              setDragOver(false);
              pickFile(e.dataTransfer.files?.[0] ?? null);
            }}
            className={`flex cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed p-8 text-center transition ${
              dragOver
                ? "border-brand-blue-500 bg-brand-blue-50"
                : "border-gray-300 bg-gray-50"
            }`}
          >
            <input
              ref={inputRef}
              type="file"
              accept=".csv,text/csv"
              className="sr-only"
              onChange={(e) => pickFile(e.target.files?.[0] ?? null)}
            />
            <span className="text-sm font-medium text-navy-900">
              {file ? file.name : "Drop the spreadsheet (CSV) here, or click to choose"}
            </span>
            <span className="mt-1 text-xs text-gray-500">
              CSV only, up to 4 MB and 2,000 rows per file
            </span>
          </label>

          {fileError ? <p className="text-sm text-danger-600">{fileError}</p> : null}
          {preview && !preview.columns_ok ? (
            <ul className="space-y-1 text-sm text-danger-600">
              {preview.header_errors.map((e) => (
                <li key={e}>{e}</li>
              ))}
            </ul>
          ) : null}

          <div className="flex flex-wrap gap-3">
            <Button onClick={onCheck} disabled={!file || checking}>
              {checking ? "Checking…" : "Check the spreadsheet"}
            </Button>
            <Button variant="secondary" onClick={onTemplate} disabled={templating}>
              {templating ? "Downloading…" : "Download the template"}
            </Button>
            <Button variant="ghost" asChild>
              <Link href={`/events/${eventId}/edit`}>Cancel</Link>
            </Button>
          </div>
        </Card>
      ) : null}

      {step === "confirm" && preview ? (
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-6">
            <Stat label="Rows" value={preview.summary.total_rows} />
            <Stat label="Matched" value={preview.summary.matched} />
            <Stat label="Pick a match" value={preview.summary.ambiguous} />
            <Stat label="New alumni" value={preview.summary.new_alumni} />
            <Stat label="New friends" value={preview.summary.new_friend} />
            <Stat label="Already attending" value={preview.summary.already_attending} />
          </div>

          {preview.ignored_columns.length > 0 ? (
            <p className="text-sm text-gray-500">
              Ignored columns: {preview.ignored_columns.join(", ")}
            </p>
          ) : null}
          {preview.warnings.map((w) => (
            <p key={w} className="text-sm text-warning-700">
              {w}
            </p>
          ))}

          <div className="flex flex-wrap items-center gap-3">
            <label htmlFor="sheet-filter" className="text-sm text-gray-600">
              Show
            </label>
            <div className="w-56">
              <Select
                id="sheet-filter"
                value={filter}
                onChange={(e) => setFilter(e.target.value as Filter)}
              >
                <option value="all">All rows</option>
                <option value="attention">Needs a look</option>
                <option value="matched">Matched</option>
                <option value="ambiguous">Pick a match</option>
                <option value="new_alumni">New alumni</option>
                <option value="new_friend">New friends</option>
                <option value="already_attending">Already attending</option>
                <option value="invalid">Missing name</option>
              </Select>
            </div>
            <span className="text-sm text-gray-500 tabular-nums">
              {shown.length} of {rows.length} rows
            </span>
          </div>

          <Card className="overflow-x-auto p-0">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200 bg-gray-50 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">
                  <th className="w-14 px-3 py-2.5">Row</th>
                  <th className="px-3 py-2.5">Name</th>
                  <th className="px-3 py-2.5">Company / Role</th>
                  <th className="w-28 px-3 py-2.5">Years</th>
                  <th className="w-36 px-3 py-2.5">Found</th>
                  <th className="w-80 px-3 py-2.5">Save as</th>
                  <th className="w-20 px-3 py-2.5">
                    <span className="sr-only">Edit</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {shown.map((r) => (
                  <SheetRowView
                    key={r.row}
                    row={r}
                    draft={drafts[r.row] ?? draftFromRow(r)}
                    editing={editing === r.row}
                    onEdit={() => setEditing(editing === r.row ? null : r.row)}
                    onChange={(patch) => update(r.row, patch)}
                  />
                ))}
                {shown.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-3 py-6 text-center text-gray-500">
                      No rows to show.
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </Card>

          <Card className="flex flex-wrap items-center gap-3 p-4">
            <p className="text-sm text-gray-700">
              On confirm: <strong className="tabular-nums">{counts.match}</strong>{" "}
              matched, <strong className="tabular-nums">{counts.new_alumni}</strong>{" "}
              new alumni, <strong className="tabular-nums">{counts.new_friend}</strong>{" "}
              new friends, <strong className="tabular-nums">{counts.skip}</strong>{" "}
              skipped.
            </p>
            {problems.length > 0 ? (
              <p className="text-sm text-danger-600">
                {problems.length} row{problems.length === 1 ? "" : "s"} still need a
                fix (row {problems.slice(0, 5).map((p) => p.row).join(", ")}
                {problems.length > 5 ? ", …" : ""}).
              </p>
            ) : null}
            <div className="ml-auto flex gap-3">
              <Button
                variant="secondary"
                onClick={() => {
                  if (onRestart) {
                    onRestart();
                    return;
                  }
                  setStep("upload");
                  setPreview(null);
                }}
                disabled={saving}
              >
                Start over
              </Button>
              <Button
                onClick={onSave}
                disabled={saving || problems.length > 0 || toSave === 0}
              >
                {saving ? "Saving…" : `Confirm and save ${toSave} row${toSave === 1 ? "" : "s"}`}
              </Button>
            </div>
          </Card>
        </div>
      ) : null}

      {step === "done" && result ? (
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-6">
            <Stat label="Added (matched)" value={result.added} />
            <Stat label="New alumni" value={result.created_alumni} />
            <Stat label="New friends" value={result.created_friends} />
            <Stat label="Already attending" value={result.already_attending} />
            <Stat label="Not found" value={result.not_found} />
            <Stat label="Not saved" value={result.rejected} />
          </div>
          {result.items.some(
            (i) => i.status === "rejected" || i.status === "not_found" || i.message,
          ) ? (
            <Card className="p-4">
              <p className="mb-2 text-sm font-semibold text-gray-900">Notes</p>
              <ul className="space-y-1 text-sm text-gray-700">
                {result.items
                  .filter(
                    (i) =>
                      i.status === "rejected" || i.status === "not_found" || i.message,
                  )
                  .map((i) => (
                    <li key={i.row}>
                      Row {i.row}
                      {i.name ? ` (${i.name})` : ""}: {i.message ?? i.status}
                    </li>
                  ))}
              </ul>
            </Card>
          ) : null}
          <div className="flex gap-3">
            <Button asChild>
              <Link href={`/events?event=${eventId}&event_tab=attendees`}>
                Back to the event
              </Link>
            </Button>
            <Button variant="secondary" asChild>
              <Link href={`/events/${eventId}/edit`}>Edit the event</Link>
            </Button>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function SheetRowView({
  row,
  draft,
  editing,
  onEdit,
  onChange,
}: {
  row: SheetPreviewRow;
  draft: SheetDraft;
  editing: boolean;
  onEdit: () => void;
  onChange: (patch: (d: SheetDraft) => SheetDraft) => void;
}) {
  const problem = draftProblem(draft);
  const isNew = draft.action === "new_alumni" || draft.action === "new_friend";
  const name = [draft.first_name, draft.last_name].filter(Boolean).join(" ") || "—";
  const years = [draft.ug_year, draft.grad_year].filter(Boolean).join(" / ") || "—";
  const work = [draft.company, draft.role].filter(Boolean).join(" · ") || "—";

  const set =
    (key: keyof SheetDraft) => (e: React.ChangeEvent<HTMLInputElement>) => {
      const value = e.target.value;
      onChange((d) => ({ ...d, [key]: value }));
    };

  return (
    <>
      <tr className="border-b border-gray-200 align-top last:border-0">
        <td className="px-3 py-2.5 tabular-nums text-gray-500">{row.row}</td>
        <td className="px-3 py-2.5">
          <p className="font-medium text-gray-900">{name}</p>
          {draft.email ? <p className="text-xs text-gray-500">{draft.email}</p> : null}
          {row.warnings.map((w) => (
            <p key={w} className="text-xs text-warning-700">
              {w}
            </p>
          ))}
          {problem ? <p className="text-xs text-danger-600">{problem}</p> : null}
        </td>
        <td className="px-3 py-2.5 text-gray-700">{work}</td>
        <td className="px-3 py-2.5 tabular-nums text-gray-700">{years}</td>
        <td className="px-3 py-2.5">
          <Badge variant={STATUS_VARIANT[row.status]}>{STATUS_LABEL[row.status]}</Badge>
        </td>
        <td className="px-3 py-2.5">
          <Select
            aria-label={`Save row ${row.row} as`}
            value={choiceValue(draft)}
            onChange={(e) => onChange((d) => applyChoice(d, e.target.value))}
          >
            {draft.action === "match" && draft.alumni_id == null ? (
              <option value="">Pick a record…</option>
            ) : null}
            {row.candidates.map((c) => (
              <option key={c.alumni_id} value={`match:${c.alumni_id}`}>
                Match: {candidateLabel(c)}
              </option>
            ))}
            <option value="new_alumni">New alum</option>
            <option value="new_friend">New friend</option>
            <option value="skip">Skip this row</option>
          </Select>
        </td>
        <td className="px-3 py-2.5 text-right">
          {isNew ? (
            <Button variant="secondary" size="sm" onClick={onEdit} aria-expanded={editing}>
              {editing ? "Done" : "Edit"}
            </Button>
          ) : null}
        </td>
      </tr>
      {isNew && editing ? (
        <tr className="border-b border-gray-200 bg-gray-50">
          <td />
          <td colSpan={6} className="px-3 py-3">
            <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
              <EditField label="First name" value={draft.first_name} onChange={set("first_name")} />
              <EditField label="Last name" value={draft.last_name} onChange={set("last_name")} />
              <EditField label="Company" value={draft.company} onChange={set("company")} />
              <EditField label="Role" value={draft.role} onChange={set("role")} />
              <EditField label="Email" value={draft.email} onChange={set("email")} />
              <EditField label="LinkedIn" value={draft.linkedin} onChange={set("linkedin")} />
              <EditField label="UG YR" value={draft.ug_year} onChange={set("ug_year")} />
              <EditField label="GradYR" value={draft.grad_year} onChange={set("grad_year")} />
              <EditField label="Net ID" value={draft.net_id} onChange={set("net_id")} />
            </div>
          </td>
        </tr>
      ) : null}
    </>
  );
}

function EditField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
}) {
  return (
    <label className="block text-xs text-gray-600">
      <span className="mb-1 block">{label}</span>
      <Input value={value} onChange={onChange} />
    </label>
  );
}
