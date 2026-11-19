"use client";

import Link from "next/link";
import { useRef, useState, useTransition } from "react";
import {
  downloadAttendeeMatchTemplate,
  downloadAttendeeSheetTemplate,
} from "@/app/(app)/events/actions";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { AttendeeMatchWizard } from "@/components/events/import/AttendeeMatchWizard";
import { AttendeeSheetWizard } from "@/components/events/import/AttendeeSheetWizard";
import { isCsvFile } from "@/lib/attendeeMatch";
import { detectAttendeeListKind, type AttendeeListKind } from "@/lib/attendeeSheet";

function saveCsv(filename: string, text: string) {
  const blob = new Blob([text], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

/**
 * The single "Import attendees" screen for an event (2026-11-19, Jake: "combine
 * them so it works with either uploaded sheet").
 *
 * One upload box. The file's header row decides which review screen follows:
 *  - the sign-up spreadsheet (first name + last name + a grad year column) goes
 *    to the sheet import, which can also create new alumni / friends;
 *  - any other list (conference registration, names or emails, Net IDs) goes to
 *    the matcher, which links people already on file.
 * Both review screens are unchanged and still write nothing until confirmed.
 */
export function AttendeeImportWizard({
  eventId,
  eventName,
}: {
  eventId: number;
  eventName: string;
}) {
  const [file, setFile] = useState<File | null>(null);
  const [fileError, setFileError] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [routed, setRouted] = useState<{ kind: AttendeeListKind; file: File } | null>(
    null,
  );
  // Remounts the chosen wizard on every new check, so its auto-check runs again.
  const [runId, setRunId] = useState(0);
  const [reading, setReading] = useState(false);
  const [templateError, setTemplateError] = useState<string | null>(null);
  const [templating, startTemplate] = useTransition();
  const inputRef = useRef<HTMLInputElement>(null);

  function pickFile(f: File | null) {
    if (f && !isCsvFile(f)) {
      setFile(null);
      setFileError("That isn't a CSV. Save the spreadsheet as CSV and try again.");
      return;
    }
    setFileError(null);
    setFile(f);
  }

  async function onCheck() {
    if (!file) return;
    setReading(true);
    try {
      // Only the header row matters; 64 KB is far more than any header.
      const head = await file.slice(0, 64 * 1024).text();
      setRouted({ kind: detectAttendeeListKind(head), file });
      setRunId((n) => n + 1);
    } catch {
      setFileError("Couldn't read that file. Save it as CSV and try again.");
    } finally {
      setReading(false);
    }
  }

  function restart() {
    setRouted(null);
    setFile(null);
    if (inputRef.current) inputRef.current.value = "";
  }

  function onTemplate(kind: AttendeeListKind) {
    setTemplateError(null);
    startTemplate(async () => {
      const res =
        kind === "sheet"
          ? await downloadAttendeeSheetTemplate()
          : await downloadAttendeeMatchTemplate();
      if (!res.ok) {
        setTemplateError(res.error);
        return;
      }
      saveCsv(
        kind === "sheet"
          ? "event_attendee_sheet_template.csv"
          : "conference_attendees_template.csv",
        res.csv,
      );
    });
  }

  if (routed?.kind === "sheet") {
    return (
      <AttendeeSheetWizard
        key={runId}
        eventId={eventId}
        eventName={eventName}
        initialFile={routed.file}
        onRestart={restart}
      />
    );
  }
  if (routed?.kind === "match") {
    return (
      <AttendeeMatchWizard
        key={runId}
        eventId={eventId}
        eventName={eventName}
        initialFile={routed.file}
        onRestart={restart}
      />
    );
  }

  return (
    <div className="mx-auto w-full max-w-5xl space-y-6">
      <h2 className="text-lg font-semibold text-navy-900">
        Import attendees: {eventName}
      </h2>

      <Card className="space-y-4 p-6">
        <div className="space-y-2 text-sm text-gray-600">
          <p>Upload any attendee list as a CSV. The columns decide what happens next:</p>
          <ul className="list-disc space-y-1 pl-5">
            <li>
              <strong>Sign-up spreadsheet</strong> (Fname, Lname and UG YR or GradYR):
              people are matched on name and grad year. Anyone not on file becomes a
              new <strong>alum</strong> if Focus or Grad says Fin or Finance, and a
              new <strong>friend</strong> otherwise.
            </li>
            <li>
              <strong>Any other list</strong> (conference registration, names, emails
              or Net IDs): people are matched on Net ID, then email, then name, and
              linked to the event.
            </li>
          </ul>
          <p>
            Nothing is saved yet. You&apos;ll check every row on the next screen
            before you confirm.
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
            dragOver ? "border-brand-blue-500 bg-brand-blue-50" : "border-gray-300 bg-gray-50"
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
            {file ? file.name : "Drop the attendee CSV here, or click to choose"}
          </span>
          <span className="mt-1 text-xs text-gray-500">
            CSV only, up to 4 MB and 2,000 rows per file
          </span>
        </label>

        {fileError ? <p className="text-sm text-danger-600">{fileError}</p> : null}
        {templateError ? <p className="text-sm text-danger-600">{templateError}</p> : null}

        <div className="flex flex-wrap gap-3">
          <Button onClick={onCheck} disabled={!file || reading}>
            {reading ? "Checking…" : "Check the file"}
          </Button>
          <Button
            variant="secondary"
            onClick={() => onTemplate("sheet")}
            disabled={templating}
          >
            Sign-up sheet template
          </Button>
          <Button
            variant="secondary"
            onClick={() => onTemplate("match")}
            disabled={templating}
          >
            Conference list example
          </Button>
          <Button variant="ghost" asChild>
            <Link href={`/events/${eventId}/edit`}>Cancel</Link>
          </Button>
        </div>
      </Card>
    </div>
  );
}
