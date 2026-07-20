"use client";

import { useEffect, useMemo, useState } from "react";
import {
  ArrowDown,
  ArrowUp,
  ClipboardList,
  Database,
  ExternalLink,
  Heart,
  MailCheck,
  Plus,
  RotateCcw,
  Trash2,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { SAMPLE_ALUM, SAMPLE_ALUM_NAME } from "@/lib/sampleAlumni";
import {
  clearQuestions,
  defaultQuestions,
  loadQuestions,
  saveQuestions,
} from "@/lib/surveyStore";
import {
  SURVEY_FIELD_BY_KEY,
  SURVEY_FIELDS,
  SURVEY_GROUP_LABELS,
  type SurveyField,
  type SurveyFieldGroup,
  type SurveyQuestion,
} from "@/types/survey";

// Column picker options, grouped by section in a fixed order.
const GROUP_ORDER: SurveyFieldGroup[] = [
  "contact",
  "profile",
  "employment",
  "engagement",
  "giving",
];
const FIELDS_BY_GROUP = GROUP_ORDER.map((group) => ({
  group,
  label: SURVEY_GROUP_LABELS[group],
  fields: SURVEY_FIELDS.filter((f) => f.group === group),
}));

/** Best-effort unique id for a newly-added question. */
function newId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return `q-${crypto.randomUUID()}`;
  }
  return `q-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

/**
 * "Sample survey" button + side-by-side editor/preview for the annual
 * "confirm / update your info" re-survey (frontend-only).
 *
 * Every question is bound to a real DB column (`SURVEY_FIELDS`) — text columns
 * render as a pre-filled input, boolean columns as Yes/No (the "are you willing
 * to…" flags that drive tags, the hiring flags, and the Pay It Forward donor
 * flag, which also shows the external donate link). Staff edit on the LEFT and
 * see the alum-facing form on the RIGHT, one row per question. Edits persist to
 * `localStorage` (no backend survey endpoint yet) and stand in for "what Resend
 * would send". Nothing here calls an API.
 */
export function SurveySampleEditor() {
  const [open, setOpen] = useState(false);
  const [questions, setQuestions] = useState<SurveyQuestion[]>([]);
  const [mobileView, setMobileView] = useState<"edit" | "preview">("edit");
  // Guards the first render: localStorage is only touched in effects, so the
  // server render and first client render both show the seed, avoiding hydration
  // mismatch. We hydrate from storage once mounted.
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    setQuestions(loadQuestions());
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    saveQuestions(questions);
  }, [questions, hydrated]);

  const requiredCount = useMemo(
    () => questions.filter((q) => q.required).length,
    [questions],
  );

  const updateQuestion = (id: string, patch: Partial<SurveyQuestion>) => {
    setQuestions((prev) =>
      prev.map((q) => (q.id === id ? { ...q, ...patch } : q)),
    );
  };

  const move = (index: number, dir: -1 | 1) => {
    setQuestions((prev) => {
      const target = index + dir;
      if (target < 0 || target >= prev.length) return prev;
      const next = [...prev];
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });
  };

  const remove = (id: string) =>
    setQuestions((prev) => prev.filter((q) => q.id !== id));

  const addQuestion = () => {
    // Default to the first column not already used, else the first column.
    const used = new Set(questions.map((q) => q.fieldKey));
    const field = SURVEY_FIELDS.find((f) => !used.has(f.key)) ?? SURVEY_FIELDS[0];
    setQuestions((prev) => [
      ...prev,
      { id: newId(), fieldKey: field.key, label: "", required: false },
    ]);
  };

  const resetToDefault = () => {
    clearQuestions();
    setQuestions(defaultQuestions());
  };

  const editViz = mobileView === "edit" ? "block" : "hidden";
  const previewViz = mobileView === "preview" ? "block" : "hidden";

  return (
    <>
      <Button
        type="button"
        size="lg"
        onClick={() => setOpen(true)}
        aria-haspopup="dialog"
      >
        <ClipboardList aria-hidden="true" />
        Sample survey
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent
          className="max-w-6xl"
          title="Sample survey"
          description="Every question updates one alumni database column. Edit on the left, preview exactly what an alum would receive on the right. Saved on this device."
        >
          <DialogBody className="p-0">
            {/* Narrow-screen Edit/Preview toggle (both columns show on lg). */}
            <div className="sticky top-0 z-10 flex items-center gap-2 border-b border-gray-200 bg-white px-5 py-2.5 lg:hidden">
              <div className="inline-flex rounded-md border border-gray-200 p-0.5">
                <ToggleBtn
                  active={mobileView === "edit"}
                  onClick={() => setMobileView("edit")}
                  icon={<ClipboardList className="h-4 w-4" aria-hidden="true" />}
                  label="Edit"
                />
                <ToggleBtn
                  active={mobileView === "preview"}
                  onClick={() => setMobileView("preview")}
                  icon={<MailCheck className="h-4 w-4" aria-hidden="true" />}
                  label="Preview"
                />
              </div>
            </div>

            {/* Column headers (lg only). */}
            <RowBand editViz={editViz} previewViz={previewViz} className="hidden lg:grid">
              <p className="text-xs font-semibold uppercase tracking-wide text-gray-400">
                Edit questions
              </p>
              <p className="text-xs font-semibold uppercase tracking-wide text-gray-400">
                Preview
              </p>
            </RowBand>

            {/* Intro band: summary (left) lines up with the survey intro (right). */}
            <RowBand editViz={editViz} previewViz={previewViz}>
              <p className="text-xs text-gray-500">
                {questions.length}{" "}
                {questions.length === 1 ? "question" : "questions"} ·{" "}
                {requiredCount} required · every question writes to a DB column
              </p>
              <div className="rounded-md border border-brand-blue-300/50 bg-brand-blue-50 px-4 py-3">
                <p className="text-xs font-semibold uppercase tracking-wide text-navy-800">
                  BYU Finance Alumni
                </p>
                <p className="mt-1 text-sm text-gray-700">
                  Hi {SAMPLE_ALUM_NAME}, it&apos;s our annual check-in — please
                  take a moment to confirm your information so we can keep you in
                  the loop on events and opportunities.
                </p>
              </div>
            </RowBand>

            {/* One band per question: editor (left) lined up with preview (right). */}
            {questions.length === 0 ? (
              <RowBand editViz={editViz} previewViz={previewViz}>
                <div className="rounded-md border border-dashed border-gray-300 p-8 text-center">
                  <p className="text-sm font-medium text-gray-900">
                    No questions yet
                  </p>
                  <p className="mt-1 text-xs text-gray-500">
                    Add a question or reset to the default set.
                  </p>
                </div>
                <p className="text-sm text-gray-400">Nothing to preview yet.</p>
              </RowBand>
            ) : (
              questions.map((q, index) => (
                <RowBand key={q.id} editViz={editViz} previewViz={previewViz}>
                  <QuestionEditor
                    question={q}
                    index={index}
                    total={questions.length}
                    onChange={updateQuestion}
                    onMove={move}
                    onRemove={remove}
                  />
                  <PreviewQuestion question={q} />
                </RowBand>
              ))
            )}

            {/* Footer band: "Add question" (left) lines up with the submit CTA. */}
            <RowBand editViz={editViz} previewViz={previewViz} className="border-b-0">
              <Button
                type="button"
                variant="secondary"
                onClick={addQuestion}
                className="w-full"
              >
                <Plus aria-hidden="true" />
                Add question
              </Button>
              <div>
                <button
                  type="button"
                  disabled
                  aria-disabled="true"
                  title="Preview only — submitting is disabled in this sample"
                  className="inline-flex h-10 w-full cursor-not-allowed items-center justify-center rounded-md bg-brand-blue-600/50 px-5 text-sm font-semibold text-white"
                >
                  Submit my updates
                </button>
                <p className="mt-2 text-center text-xs text-gray-400">
                  Preview only — this button is disabled and sends nothing.
                </p>
              </div>
            </RowBand>
          </DialogBody>

          <DialogFooter className="justify-between">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={resetToDefault}
            >
              <RotateCcw aria-hidden="true" />
              Reset to default
            </Button>
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={() => setOpen(false)}
            >
              Done
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

/* --------------------------------------------------------------- row band ---- */

function RowBand({
  children,
  editViz,
  previewViz,
  className,
}: {
  children: [React.ReactNode, React.ReactNode];
  editViz: string;
  previewViz: string;
  className?: string;
}) {
  const [left, right] = children;
  return (
    <div
      className={cn(
        "grid gap-x-6 gap-y-3 border-b border-gray-200 px-5 py-4 lg:grid-cols-2",
        className,
      )}
    >
      <div className={cn("min-w-0", editViz, "lg:block")}>{left}</div>
      <div className={cn("min-w-0", previewViz, "lg:block")}>{right}</div>
    </div>
  );
}

function ToggleBtn({
  active,
  onClick,
  icon,
  label,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        "inline-flex items-center gap-1.5 rounded px-3 py-1.5 text-sm font-medium transition-colors",
        active
          ? "bg-brand-blue-600 text-white"
          : "text-gray-500 hover:text-gray-900",
      )}
    >
      {icon}
      {label}
    </button>
  );
}

/* --------------------------------------------------------------- editor row -- */

function QuestionEditor({
  question,
  index,
  total,
  onChange,
  onMove,
  onRemove,
}: {
  question: SurveyQuestion;
  index: number;
  total: number;
  onChange: (id: string, patch: Partial<SurveyQuestion>) => void;
  onMove: (index: number, dir: -1 | 1) => void;
  onRemove: (id: string) => void;
}) {
  const { id } = question;
  const labelId = `${id}-label`;
  const fieldId = `${id}-field`;
  const helpId = `${id}-help`;
  const field = SURVEY_FIELD_BY_KEY[question.fieldKey] as
    | SurveyField
    | undefined;

  return (
    <div className="rounded-md border border-gray-200 bg-gray-50 p-4">
      <div className="flex items-start justify-between gap-2">
        <span className="mt-0.5 inline-flex h-6 min-w-6 items-center justify-center rounded-full bg-navy-800 px-1.5 text-xs font-semibold tabular-nums text-white">
          {index + 1}
        </span>
        <div className="flex items-center gap-1">
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={() => onMove(index, -1)}
            disabled={index === 0}
            aria-label="Move question up"
          >
            <ArrowUp aria-hidden="true" />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={() => onMove(index, 1)}
            disabled={index === total - 1}
            aria-label="Move question down"
          >
            <ArrowDown aria-hidden="true" />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-8 w-8 text-danger-600 hover:bg-danger-50 hover:text-danger-600"
            onClick={() => onRemove(id)}
            aria-label="Delete question"
          >
            <Trash2 aria-hidden="true" />
          </Button>
        </div>
      </div>

      <div className="mt-2 space-y-3">
        <div>
          <Label htmlFor={labelId}>Question</Label>
          <Input
            id={labelId}
            value={question.label}
            onChange={(e) => onChange(id, { label: e.target.value })}
            placeholder="e.g. What industry are you in?"
            className="mt-1"
          />
        </div>

        <div>
          <Label htmlFor={fieldId}>Updates database column</Label>
          <Select
            id={fieldId}
            value={question.fieldKey}
            onChange={(e) => onChange(id, { fieldKey: e.target.value })}
            className="mt-1"
          >
            {FIELDS_BY_GROUP.map((g) => (
              <optgroup key={g.group} label={g.label}>
                {g.fields.map((f) => (
                  <option key={f.key} value={f.key}>
                    {f.label}
                  </option>
                ))}
              </optgroup>
            ))}
          </Select>
          {/* The exact column this question writes to — nothing free-form. */}
          <p className="mt-1 flex items-center gap-1.5 text-xs text-gray-500">
            <Database className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
            {field ? (
              <>
                <code className="rounded bg-gray-100 px-1 py-0.5 text-[11px] text-gray-700">
                  {field.table}.{field.column}
                </code>
                <span>·</span>
                <span>{field.kind === "boolean" ? "Yes / No" : "Text"}</span>
                {field.donateUrl ? (
                  <Badge variant="tag">
                    <Heart className="h-3 w-3" aria-hidden="true" />
                    Donation
                  </Badge>
                ) : null}
              </>
            ) : (
              <span className="text-danger-600">Unknown column</span>
            )}
          </p>
        </div>

        <div>
          <Label htmlFor={helpId}>Help text (optional)</Label>
          <Input
            id={helpId}
            value={question.helpText ?? ""}
            onChange={(e) =>
              onChange(id, { helpText: e.target.value || undefined })
            }
            placeholder="Shown under the question"
            className="mt-1"
          />
        </div>

        <label className="inline-flex cursor-pointer select-none items-center gap-2 text-sm text-gray-700">
          <input
            type="checkbox"
            checked={question.required}
            onChange={(e) => onChange(id, { required: e.target.checked })}
            className="h-4 w-4 rounded border-gray-300 text-brand-blue-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-blue-500 focus-visible:ring-offset-1"
          />
          Required
        </label>
      </div>
    </div>
  );
}

/* --------------------------------------------------------------- preview ----- */

function PreviewQuestion({ question }: { question: SurveyQuestion }) {
  const controlId = `preview-${question.id}`;
  const labelId = `${controlId}-label`;
  const field = SURVEY_FIELD_BY_KEY[question.fieldKey] as
    | SurveyField
    | undefined;
  const prefill = SAMPLE_ALUM[question.fieldKey] ?? "";

  return (
    <div className="lg:pt-1">
      <Label id={labelId} htmlFor={controlId} className="text-sm text-gray-900">
        {question.label || (
          <span className="italic text-gray-400">Untitled question</span>
        )}
        {question.required ? (
          <span className="ml-1 text-danger-600" aria-hidden="true">
            *
          </span>
        ) : null}
      </Label>
      {question.helpText ? (
        <p className="mt-0.5 text-xs text-gray-500">{question.helpText}</p>
      ) : null}

      <div className="mt-1.5">
        {!field ? (
          <p className="text-xs text-danger-600">
            This question isn&apos;t linked to a database column.
          </p>
        ) : field.kind === "text" ? (
          <>
            <Input id={controlId} key={prefill} defaultValue={prefill} placeholder="Add a value" />
            {prefill ? (
              <div className="mt-1 flex items-center gap-2">
                <p className="text-xs text-gray-400">
                  Currently on file — edit if it&apos;s changed.
                </p>
                <Badge variant="tag">Pre-filled</Badge>
              </div>
            ) : null}
          </>
        ) : (
          <>
            <div className="flex gap-4" role="radiogroup" aria-labelledby={labelId}>
              {["Yes", "No"].map((opt) => (
                <label
                  key={opt}
                  className="inline-flex cursor-pointer items-center gap-2 text-sm text-gray-700"
                >
                  <input
                    type="radio"
                    name={controlId}
                    value={opt}
                    className="h-4 w-4 border-gray-300 text-brand-blue-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-blue-500 focus-visible:ring-offset-1"
                  />
                  {opt}
                </label>
              ))}
            </div>
            {field.donateUrl ? (
              <a
                href={field.donateUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-2 inline-flex items-center gap-1.5 rounded-md bg-brand-blue-600 px-3 py-1.5 text-sm font-semibold text-white transition-colors hover:bg-brand-blue-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-blue-500 focus-visible:ring-offset-1"
              >
                <Heart className="h-4 w-4" aria-hidden="true" />
                Donate to Pay It Forward
                <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
              </a>
            ) : null}
          </>
        )}
      </div>
    </div>
  );
}
