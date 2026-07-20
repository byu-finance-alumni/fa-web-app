"use client";

import { useEffect, useMemo, useState } from "react";
import {
  ArrowDown,
  ArrowUp,
  ClipboardList,
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { SAMPLE_ALUM, SAMPLE_ALUM_NAME } from "@/lib/sampleAlumni";
import {
  clearQuestions,
  defaultQuestions,
  loadQuestions,
  saveQuestions,
} from "@/lib/surveyStore";
import {
  SURVEY_FIELD_LABELS,
  SURVEY_QUESTION_TYPE_LABELS,
  type SurveyFieldKey,
  type SurveyQuestion,
  type SurveyQuestionType,
} from "@/types/survey";

const FIELD_KEYS = Object.keys(SURVEY_FIELD_LABELS) as SurveyFieldKey[];
const TYPE_KEYS = Object.keys(
  SURVEY_QUESTION_TYPE_LABELS,
) as SurveyQuestionType[];

/** Best-effort unique id for a newly-added question. */
function newId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return `q-${crypto.randomUUID()}`;
  }
  return `q-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

/**
 * "Sample survey" button + preview/editor for the biennial "confirm your info"
 * re-survey (frontend-only). Staff open the editor to author the exact question
 * set an alum receives, tweak it inline, and preview it as the alum would see
 * it. Edits persist to `localStorage` (there's no backend survey endpoint) and
 * stand in for "what Resend would send". Nothing here calls an API.
 */
export function SurveySampleEditor() {
  const [open, setOpen] = useState(false);
  const [questions, setQuestions] = useState<SurveyQuestion[]>([]);
  // Guards the first render: localStorage is only touched in effects, so the
  // server render and first client render both show the seed, avoiding hydration
  // mismatch. We hydrate from storage once mounted.
  const [hydrated, setHydrated] = useState(false);

  // Load persisted questions once on mount (client only).
  useEffect(() => {
    setQuestions(loadQuestions());
    setHydrated(true);
  }, []);

  // Persist on every change, but only after the initial hydration load so we
  // never clobber saved edits with the empty pre-hydration state.
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

  const changeType = (id: string, type: SurveyQuestionType) => {
    setQuestions((prev) =>
      prev.map((q) => {
        if (q.id !== id) return q;
        const next: SurveyQuestion = { ...q, type };
        // Keep the shape consistent with the new type.
        if (type === "confirm-field") {
          next.fieldKey = q.fieldKey ?? "email";
        } else {
          next.fieldKey = undefined;
        }
        if (type === "single-choice") {
          next.options =
            q.options && q.options.length > 0
              ? q.options
              : ["Option 1", "Option 2"];
        } else {
          next.options = undefined;
        }
        return next;
      }),
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
    setQuestions((prev) => [
      ...prev,
      {
        id: newId(),
        type: "short-text",
        label: "",
        required: false,
      },
    ]);
  };

  const resetToDefault = () => {
    clearQuestions();
    setQuestions(defaultQuestions());
  };

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
          className="max-w-3xl"
          title="Sample survey"
          description="The confirm-your-info questions this campaign emails to alumni. Edits are saved on this device and preview exactly what an alum would receive."
        >
          <Tabs defaultValue="edit" className="flex min-h-0 flex-1 flex-col">
            <div className="border-b border-gray-200 px-5 pt-3">
              <TabsList className="border-b-0">
                <TabsTrigger value="edit">
                  <ClipboardList aria-hidden="true" className="h-4 w-4" />
                  Edit questions
                </TabsTrigger>
                <TabsTrigger value="preview">
                  <MailCheck aria-hidden="true" className="h-4 w-4" />
                  Preview
                </TabsTrigger>
              </TabsList>
            </div>

            {/* ---- Edit tab -------------------------------------------------- */}
            <TabsContent
              value="edit"
              className="mt-0 min-h-0 flex-1 overflow-hidden"
            >
              <DialogBody className="space-y-3">
                <p className="text-xs text-gray-500">
                  {questions.length}{" "}
                  {questions.length === 1 ? "question" : "questions"} ·{" "}
                  {requiredCount} required
                </p>

                {questions.length === 0 ? (
                  <div className="rounded-md border border-dashed border-gray-300 p-8 text-center">
                    <p className="text-sm font-medium text-gray-900">
                      No questions yet
                    </p>
                    <p className="mt-1 text-xs text-gray-500">
                      Add a question or reset to the default confirm-your-info
                      set.
                    </p>
                  </div>
                ) : (
                  questions.map((q, index) => (
                    <QuestionEditor
                      key={q.id}
                      question={q}
                      index={index}
                      total={questions.length}
                      onChange={updateQuestion}
                      onChangeType={changeType}
                      onMove={move}
                      onRemove={remove}
                    />
                  ))
                )}

                <Button
                  type="button"
                  variant="secondary"
                  onClick={addQuestion}
                  className="w-full"
                >
                  <Plus aria-hidden="true" />
                  Add question
                </Button>
              </DialogBody>
            </TabsContent>

            {/* ---- Preview tab ---------------------------------------------- */}
            <TabsContent
              value="preview"
              className="mt-0 min-h-0 flex-1 overflow-hidden"
            >
              <DialogBody>
                <SurveyPreview questions={questions} />
              </DialogBody>
            </TabsContent>
          </Tabs>

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

/* --------------------------------------------------------------- editor row -- */

function QuestionEditor({
  question,
  index,
  total,
  onChange,
  onChangeType,
  onMove,
  onRemove,
}: {
  question: SurveyQuestion;
  index: number;
  total: number;
  onChange: (id: string, patch: Partial<SurveyQuestion>) => void;
  onChangeType: (id: string, type: SurveyQuestionType) => void;
  onMove: (index: number, dir: -1 | 1) => void;
  onRemove: (id: string) => void;
}) {
  const { id } = question;
  const labelId = `${id}-label`;
  const typeId = `${id}-type`;
  const fieldId = `${id}-field`;
  const helpId = `${id}-help`;
  const optionsId = `${id}-options`;

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
            placeholder="e.g. Is this still your current employer?"
            className="mt-1"
          />
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <Label htmlFor={typeId}>Type</Label>
            <Select
              id={typeId}
              value={question.type}
              onChange={(e) =>
                onChangeType(id, e.target.value as SurveyQuestionType)
              }
              className="mt-1"
            >
              {TYPE_KEYS.map((t) => (
                <option key={t} value={t}>
                  {SURVEY_QUESTION_TYPE_LABELS[t]}
                </option>
              ))}
            </Select>
          </div>

          {question.type === "confirm-field" ? (
            <div>
              <Label htmlFor={fieldId}>Field to confirm</Label>
              <Select
                id={fieldId}
                value={question.fieldKey ?? "email"}
                onChange={(e) =>
                  onChange(id, { fieldKey: e.target.value as SurveyFieldKey })
                }
                className="mt-1"
              >
                {FIELD_KEYS.map((k) => (
                  <option key={k} value={k}>
                    {SURVEY_FIELD_LABELS[k]}
                  </option>
                ))}
              </Select>
            </div>
          ) : null}
        </div>

        {question.type === "single-choice" ? (
          <div>
            <Label htmlFor={optionsId}>Options (one per line)</Label>
            <Textarea
              id={optionsId}
              value={(question.options ?? []).join("\n")}
              onChange={(e) =>
                onChange(id, {
                  options: e.target.value
                    .split("\n")
                    .map((o) => o.trim())
                    .filter(Boolean),
                })
              }
              placeholder={"Option 1\nOption 2"}
              className="mt-1 min-h-[64px]"
            />
          </div>
        ) : null}

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

function SurveyPreview({ questions }: { questions: SurveyQuestion[] }) {
  return (
    <div className="mx-auto max-w-xl">
      <div className="rounded-md border border-brand-blue-300/50 bg-brand-blue-50 px-4 py-3">
        <p className="text-xs font-semibold uppercase tracking-wide text-navy-800">
          BYU Finance Alumni
        </p>
        <p className="mt-1 text-sm text-gray-700">
          Hi {SAMPLE_ALUM_NAME}, it&apos;s been a couple of years — please take a
          moment to confirm your information so we can keep you in the loop on
          events and opportunities.
        </p>
      </div>

      {questions.length === 0 ? (
        <p className="mt-6 text-sm text-gray-500">
          No questions to preview yet. Add some on the Edit tab.
        </p>
      ) : (
        <div className="mt-5 space-y-5">
          {questions.map((q, i) => (
            <PreviewQuestion key={q.id} question={q} index={i} />
          ))}
        </div>
      )}

      <div className="mt-6 border-t border-gray-200 pt-4">
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
    </div>
  );
}

function PreviewQuestion({
  question,
  index,
}: {
  question: SurveyQuestion;
  index: number;
}) {
  const controlId = `preview-${question.id}`;
  const labelId = `${controlId}-label`;
  const prefill =
    question.type === "confirm-field" && question.fieldKey
      ? SAMPLE_ALUM[question.fieldKey]
      : "";

  return (
    <div>
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
        {question.type === "confirm-field" ? (
          <>
            <Input
              id={controlId}
              defaultValue={prefill}
              placeholder="Add a value"
            />
            <p className="mt-1 text-xs text-gray-400">
              Currently on file — edit if it&apos;s changed.
            </p>
          </>
        ) : null}

        {question.type === "short-text" ? (
          <Input id={controlId} placeholder="Your answer" />
        ) : null}

        {question.type === "long-text" ? (
          <Textarea id={controlId} placeholder="Your answer" />
        ) : null}

        {question.type === "yes-no" ? (
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
        ) : null}

        {question.type === "single-choice" ? (
          <div className="space-y-2" role="radiogroup" aria-labelledby={labelId}>
            {(question.options ?? []).length === 0 ? (
              <p className="text-xs text-gray-400">No options added yet.</p>
            ) : (
              (question.options ?? []).map((opt, oi) => (
                <label
                  key={`${opt}-${oi}`}
                  className="flex cursor-pointer items-center gap-2 text-sm text-gray-700"
                >
                  <input
                    type="radio"
                    name={controlId}
                    value={opt}
                    className="h-4 w-4 border-gray-300 text-brand-blue-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-blue-500 focus-visible:ring-offset-1"
                  />
                  {opt}
                </label>
              ))
            )}
          </div>
        ) : null}
      </div>

      {index === 0 && question.type === "confirm-field" ? (
        <Badge variant="tag" className="mt-2">
          Pre-filled from the alum&apos;s record
        </Badge>
      ) : null}
    </div>
  );
}
