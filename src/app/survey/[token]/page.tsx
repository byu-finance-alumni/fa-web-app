"use client";

import { use, useEffect, useState } from "react";
import {
  Check,
  ChevronDown,
  ExternalLink,
  Heart,
  PencilLine,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { SAMPLE_ALUM, SAMPLE_ALUM_NAME } from "@/lib/sampleAlumni";
import { loadQuestions } from "@/lib/surveyStore";
import {
  SURVEY_FIELD_BY_KEY,
  type SurveyField,
  type SurveyQuestion,
} from "@/types/survey";

/**
 * PUBLIC "confirm your info" survey landing page (frontend-only PROTOTYPE).
 *
 * Lives OUTSIDE the `(app)` auth group and is allow-listed in `middleware.ts`, so
 * an alum can open it from an email link without signing in. It reads the intro
 * message + authored questions from `localStorage` (set by staff in the "Sample
 * survey" / "Edit email message" editors) and the sample alum from `SAMPLE_ALUM`.
 * Nothing calls an API; success is shown inline (no app shell / ToastProvider).
 */

type Status = "review" | "confirmed" | "editing" | "submitted";

/** First name for a warm greeting ("Hi Jordan,"). */
const FIRST_NAME = SAMPLE_ALUM_NAME.split(/\s+/)[0] || SAMPLE_ALUM_NAME;
const INITIALS =
  SAMPLE_ALUM_NAME.trim()
    .split(/\s+/)
    .map((p) => p[0])
    .slice(0, 2)
    .join("")
    .toUpperCase() || "?";

export default function SurveyConfirmPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  // `token` identifies the alum via a signed link in production; the PROTOTYPE
  // ignores it and always loads SAMPLE_ALUM (real loading resolves server-side).
  const { token } = use(params);
  useEffect(() => {
    /* no-op: prototype ignores the token. Kept so the dependency is explicit. */
  }, [token]);

  const [hydrated, setHydrated] = useState(false);
  const [questions, setQuestions] = useState<SurveyQuestion[]>([]);
  const [status, setStatus] = useState<Status>("review");
  const [engagementOpen, setEngagementOpen] = useState(false);

  // localStorage is client-only; hydrate after mount so SSR + first client render
  // match (both show the skeleton), avoiding a hydration mismatch.
  useEffect(() => {
    setQuestions(loadQuestions());
    setHydrated(true);
  }, []);

  const inlineQuestions = questions.filter(
    (q) => SURVEY_FIELD_BY_KEY[q.fieldKey]?.group !== "engagement",
  );
  const engagementQuestions = questions.filter(
    (q) => SURVEY_FIELD_BY_KEY[q.fieldKey]?.group === "engagement",
  );
  const onFile = inlineQuestions.filter((q) => {
    const f = SURVEY_FIELD_BY_KEY[q.fieldKey];
    return f?.kind === "text" && (SAMPLE_ALUM[q.fieldKey] ?? "") !== "";
  });

  return (
    <main className="min-h-screen bg-gray-100">
      {/* Brand header — the navy logo lockup sits seamlessly on the navy band. */}
      <header className="bg-navy-800">
        <div className="mx-auto flex max-w-2xl items-center gap-3 px-5 py-4">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/branding/finance-logo.jpg"
            alt="BYU Finance — Marriott School of Business"
            className="h-11 w-auto rounded"
          />
        </div>
      </header>

      <div className="mx-auto max-w-2xl px-4 pb-16 pt-8 sm:px-6">
        {!hydrated ? (
          <div className="space-y-4">
            <div className="h-8 w-2/3 animate-pulse rounded bg-gray-200" />
            <div className="h-32 animate-pulse rounded-lg bg-gray-200" />
          </div>
        ) : status === "submitted" ? (
          <SuccessPanel
            title="Thank you — your updates are in"
            body="Our team will refresh your profile with what you sent. You can safely close this page."
          />
        ) : status === "confirmed" ? (
          <SuccessPanel
            title={`Thanks for confirming, ${FIRST_NAME}`}
            body="Your information is up to date. We appreciate you helping us keep in touch about events, mentoring, and opportunities."
            action={
              <Button variant="secondary" onClick={() => setStatus("editing")}>
                <PencilLine aria-hidden="true" />
                Actually, I need to change something
              </Button>
            }
          />
        ) : status === "editing" ? (
          <>
            <SectionHeading
              eyebrow="Update your info"
              title="What's changed?"
              lead="Everything's pre-filled with what we have — just edit anything that's out of date."
            />
            <form
              className="mt-6 space-y-6"
              onSubmit={(e) => {
                e.preventDefault();
                setStatus("submitted");
              }}
            >
              <div className="space-y-5 rounded-lg border border-gray-200 bg-white p-5 shadow-card">
                {inlineQuestions.map((q) => (
                  <FieldControl key={q.id} question={q} />
                ))}
              </div>

              {engagementQuestions.length > 0 ? (
                <div className="overflow-hidden rounded-lg border border-gray-200 bg-white shadow-card">
                  <button
                    type="button"
                    onClick={() => setEngagementOpen((o) => !o)}
                    aria-expanded={engagementOpen}
                    aria-controls="survey-engagement-panel"
                    className="flex w-full items-center justify-between gap-3 px-5 py-4 text-left transition-colors hover:bg-gray-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-blue-500 focus-visible:ring-inset"
                  >
                    <span>
                      <span className="block text-sm font-semibold text-gray-900">
                        Ways to get involved
                      </span>
                      <span className="text-xs text-gray-500">
                        Optional · {engagementQuestions.length} quick questions
                      </span>
                    </span>
                    <ChevronDown
                      className={cn(
                        "h-5 w-5 shrink-0 text-gray-400 transition-transform",
                        engagementOpen && "rotate-180",
                      )}
                      aria-hidden="true"
                    />
                  </button>
                  {engagementOpen ? (
                    <div
                      id="survey-engagement-panel"
                      className="space-y-5 border-t border-gray-200 px-5 py-5"
                    >
                      {engagementQuestions.map((q) => (
                        <FieldControl key={q.id} question={q} />
                      ))}
                    </div>
                  ) : null}
                </div>
              ) : null}

              <div className="flex flex-col-reverse gap-3 sm:flex-row sm:items-center sm:justify-between">
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => setStatus("review")}
                >
                  Back
                </Button>
                <Button type="submit" size="lg" className="w-full sm:w-auto">
                  Submit my updates
                </Button>
              </div>
            </form>
          </>
        ) : (
          /* status === "review" */
          <>
            <SectionHeading
              eyebrow="Annual check-in"
              title={`Hi ${FIRST_NAME},`}
              lead="Take a moment to check the details below, then let us know if everything's still current."
            />

            {/* Identity — the photo + name, presented as a profile header. */}
            <div className="mt-6 flex items-center gap-4 rounded-lg border border-gray-200 bg-white p-5 shadow-card">
              <span className="flex h-16 w-16 shrink-0 items-center justify-center rounded-full bg-navy-800 text-lg font-semibold text-white">
                {INITIALS}
              </span>
              <div className="min-w-0">
                <p className="truncate text-base font-semibold text-gray-900">
                  {SAMPLE_ALUM_NAME}
                </p>
                <p className="text-sm text-gray-500">
                  BYU Finance · Marriott School of Business
                </p>
              </div>
            </div>

            {/* On file */}
            <div className="mt-6">
              <h2 className="px-1 text-xs font-semibold uppercase tracking-[0.12em] text-gray-500">
                What we have on file
              </h2>
              <dl className="mt-2 divide-y divide-gray-100 overflow-hidden rounded-lg border border-gray-200 bg-white shadow-card">
                {onFile.length === 0 ? (
                  <p className="px-5 py-4 text-sm text-gray-500">
                    We don&apos;t have any details on file yet.
                  </p>
                ) : (
                  onFile.map((q) => {
                    const f = SURVEY_FIELD_BY_KEY[q.fieldKey];
                    return (
                      <div
                        key={q.id}
                        className="flex items-baseline justify-between gap-4 px-5 py-3"
                      >
                        <dt className="shrink-0 text-sm text-gray-500">
                          {f?.label ?? q.label}
                        </dt>
                        <dd className="truncate text-right text-sm font-medium text-gray-900">
                          {SAMPLE_ALUM[q.fieldKey]}
                        </dd>
                      </div>
                    );
                  })
                )}
              </dl>
            </div>

            {/* Confirm */}
            <div className="mt-8">
              <p className="text-center text-base font-medium text-gray-900">
                Is everything above still current?
              </p>
              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                <Button
                  type="button"
                  size="lg"
                  onClick={() => setStatus("confirmed")}
                >
                  <Check aria-hidden="true" />
                  Yes, it&apos;s all correct
                </Button>
                <Button
                  type="button"
                  variant="secondary"
                  size="lg"
                  onClick={() => setStatus("editing")}
                >
                  <PencilLine aria-hidden="true" />
                  No, I need to update it
                </Button>
              </div>
            </div>
          </>
        )}

        <footer className="mt-12 border-t border-gray-200 pt-6 text-center">
          <p className="text-xs font-semibold uppercase tracking-[0.12em] text-gray-400">
            BYU Marriott School of Business
          </p>
          <p className="mt-1 text-xs text-gray-400">
            Prototype — loads a sample alum and doesn&apos;t send anything yet.
          </p>
        </footer>
      </div>
    </main>
  );
}

/* --------------------------------------------------------------- heading ---- */

function SectionHeading({
  eyebrow,
  title,
  lead,
}: {
  eyebrow: string;
  title: string;
  lead: string;
}) {
  return (
    <div>
      <p className="text-xs font-semibold uppercase tracking-[0.14em] text-brand-blue-600">
        {eyebrow}
      </p>
      <h1 className="mt-1.5 text-2xl font-semibold tracking-tight text-navy-800">
        {title}
      </h1>
      <p className="mt-2 text-[15px] leading-relaxed text-gray-600">{lead}</p>
    </div>
  );
}

/* ---------------------------------------------------------- field control -- */

/**
 * One editable survey field, prefilled from `SAMPLE_ALUM`: text columns render a
 * pre-filled input, boolean columns a Yes/No radio group (plus the Pay It Forward
 * donate link on the giving field).
 */
function FieldControl({ question }: { question: SurveyQuestion }) {
  const controlId = `survey-${question.id}`;
  const labelId = `${controlId}-label`;
  const field = SURVEY_FIELD_BY_KEY[question.fieldKey] as
    | SurveyField
    | undefined;
  const prefill = SAMPLE_ALUM[question.fieldKey] ?? "";

  return (
    <div>
      <Label
        id={labelId}
        htmlFor={controlId}
        className="text-sm font-medium text-gray-900"
      >
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
            This question isn&apos;t linked to a field.
          </p>
        ) : field.kind === "text" ? (
          <Input
            id={controlId}
            defaultValue={prefill}
            required={question.required}
            placeholder="Add a value"
          />
        ) : (
          <>
            <div
              className="flex gap-2"
              role="radiogroup"
              aria-labelledby={labelId}
            >
              {["Yes", "No"].map((opt) => (
                <label
                  key={opt}
                  className="inline-flex cursor-pointer items-center gap-2 rounded-md border border-gray-300 px-4 py-1.5 text-sm text-gray-700 transition-colors hover:border-brand-blue-500 has-[:checked]:border-brand-blue-600 has-[:checked]:bg-brand-blue-50 has-[:checked]:font-medium has-[:checked]:text-navy-800"
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
                className="mt-2 inline-flex items-center gap-1.5 rounded-md bg-brand-blue-600 px-3 py-1.5 text-sm font-semibold text-white transition-colors hover:bg-brand-blue-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-blue-500 focus-visible:ring-offset-1"
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

/* ------------------------------------------------------------- success ----- */

function SuccessPanel({
  title,
  body,
  action,
}: {
  title: string;
  body: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="rounded-lg border border-gray-200 bg-white p-8 text-center shadow-card sm:p-10">
      <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-success-50">
        <Check className="h-7 w-7 text-success-600" aria-hidden="true" />
      </div>
      <h1 className="mt-5 text-xl font-semibold tracking-tight text-navy-800">
        {title}
      </h1>
      <p className="mx-auto mt-2 max-w-md text-sm leading-relaxed text-gray-600">
        {body}
      </p>
      {action ? <div className="mt-6 flex justify-center">{action}</div> : null}
    </div>
  );
}
