"use client";

import { use, useEffect, useState } from "react";
import {
  CheckCircle2,
  ChevronDown,
  ExternalLink,
  Heart,
  PencilLine,
  ShieldCheck,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { InitialsAvatar } from "@/components/shared/InitialsAvatar";
import { SAMPLE_ALUM, SAMPLE_ALUM_NAME } from "@/lib/sampleAlumni";
import {
  DEFAULT_SURVEY_MESSAGE,
  loadMessage,
  loadQuestions,
} from "@/lib/surveyStore";
import {
  SURVEY_FIELD_BY_KEY,
  type SurveyField,
  type SurveyQuestion,
} from "@/types/survey";

/**
 * PUBLIC "confirm your info" survey landing page (frontend-only PROTOTYPE).
 *
 * This route lives OUTSIDE the `(app)` auth group and is allow-listed in
 * `middleware.ts`, so an alum can open it from an email link without signing in.
 * It renders the alum-facing flow: read the intro message + current info on
 * file, confirm it's accurate (Yes) or reveal the editable form (No), and submit
 * updates. Nothing here calls an API — the questions + intro message are read
 * from `localStorage` (authored by staff in the "Sample survey" editor) and the
 * alum data is the shared `SAMPLE_ALUM` sample. There is no ToastProvider/app
 * shell here, so success is shown inline.
 */

type Status = "review" | "confirmed" | "editing" | "submitted";

export default function SurveyConfirmPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  // `token` identifies the alum via a signed survey link in production. In this
  // PROTOTYPE there is no backend, so ANY token loads the sample alum below;
  // real tokenized loading must resolve the record on the server.
  const { token } = use(params);
  useEffect(() => {
    // Intentional no-op: the prototype ignores the token and always loads
    // SAMPLE_ALUM. Kept so the token dependency is explicit.
  }, [token]);

  const [hydrated, setHydrated] = useState(false);
  const [message, setMessage] = useState(DEFAULT_SURVEY_MESSAGE);
  const [questions, setQuestions] = useState<SurveyQuestion[]>([]);
  const [status, setStatus] = useState<Status>("review");
  const [engagementOpen, setEngagementOpen] = useState(false);

  // localStorage is client-only; hydrate after mount so SSR and the first client
  // render match (both show the loading state), avoiding a hydration mismatch.
  useEffect(() => {
    setMessage(loadMessage());
    setQuestions(loadQuestions());
    setHydrated(true);
  }, []);

  const inlineQuestions = questions.filter(
    (q) => SURVEY_FIELD_BY_KEY[q.fieldKey]?.group !== "engagement",
  );
  const engagementQuestions = questions.filter(
    (q) => SURVEY_FIELD_BY_KEY[q.fieldKey]?.group === "engagement",
  );
  // "Current info on file" — the text fields we already hold a value for.
  const onFile = inlineQuestions.filter((q) => {
    const f = SURVEY_FIELD_BY_KEY[q.fieldKey];
    return f?.kind === "text" && (SAMPLE_ALUM[q.fieldKey] ?? "") !== "";
  });

  return (
    <main className="min-h-screen bg-gray-50">
      {/* BYU Finance–branded header (navy identity). */}
      <header className="bg-navy-800 px-5 py-6 text-white">
        <div className="mx-auto max-w-xl">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-brand-blue-300">
            BYU Finance
          </p>
          <h1 className="mt-1 text-xl font-semibold tracking-tight">
            Confirm your information
          </h1>
        </div>
      </header>

      <div className="mx-auto max-w-xl px-4 py-6">
        {!hydrated ? (
          <Card className="p-6">
            <div className="h-40 animate-pulse rounded-md bg-gray-100" />
          </Card>
        ) : status === "submitted" ? (
          <SuccessCard
            title="Thanks, we've noted your updates"
            body="Your changes have been recorded and our team will refresh your profile. You can close this page."
          />
        ) : status === "confirmed" ? (
          <SuccessCard
            title="You're all set — thanks for confirming!"
            body="We appreciate you keeping your information current so we can stay in touch about events and opportunities."
            action={
              <Button
                type="button"
                variant="secondary"
                onClick={() => setStatus("editing")}
              >
                <PencilLine aria-hidden="true" />
                Actually, I need to update something
              </Button>
            }
          />
        ) : status === "editing" ? (
          <Card className="p-6">
            <h2 className="text-lg font-semibold text-gray-900">
              Update your information
            </h2>
            <p className="mt-1 text-sm text-gray-500">
              Edit anything that&apos;s changed, then submit. Fields are
              pre-filled with what we have on file.
            </p>

            <form
              className="mt-5 space-y-5"
              onSubmit={(e) => {
                e.preventDefault();
                setStatus("submitted");
              }}
            >
              {inlineQuestions.map((q) => (
                <FieldControl key={q.id} question={q} />
              ))}

              {engagementQuestions.length > 0 ? (
                <div className="rounded-md border border-gray-200">
                  <button
                    type="button"
                    onClick={() => setEngagementOpen((o) => !o)}
                    aria-expanded={engagementOpen}
                    aria-controls="survey-engagement-panel"
                    className="flex w-full items-center justify-between gap-3 rounded-md px-4 py-3 text-left transition-colors hover:bg-gray-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-blue-500 focus-visible:ring-offset-1"
                  >
                    <span className="text-sm font-semibold text-gray-900">
                      Ways to get involved{" "}
                      <span className="font-normal text-gray-400">
                        (optional · {engagementQuestions.length})
                      </span>
                    </span>
                    <ChevronDown
                      className={cn(
                        "h-4 w-4 shrink-0 text-gray-400 transition-transform",
                        engagementOpen && "rotate-180",
                      )}
                      aria-hidden="true"
                    />
                  </button>
                  {engagementOpen ? (
                    <div
                      id="survey-engagement-panel"
                      className="space-y-5 border-t border-gray-200 px-4 py-4"
                    >
                      {engagementQuestions.map((q) => (
                        <FieldControl key={q.id} question={q} />
                      ))}
                    </div>
                  ) : null}
                </div>
              ) : null}

              <div className="flex flex-col gap-2 border-t border-gray-200 pt-4 sm:flex-row-reverse sm:items-center">
                <Button type="submit" size="lg" className="w-full sm:w-auto">
                  <CheckCircle2 aria-hidden="true" />
                  Submit my updates
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="lg"
                  className="w-full sm:w-auto"
                  onClick={() => setStatus("review")}
                >
                  Back
                </Button>
              </div>
            </form>
          </Card>
        ) : (
          /* status === "review" */
          <Card className="p-6">
            <div className="rounded-md border border-brand-blue-300/50 bg-brand-blue-50 px-4 py-3">
              <p className="text-sm text-gray-700">
                Hi {SAMPLE_ALUM_NAME}, {message}
              </p>
            </div>

            <section className="mt-5">
              <h2 className="text-sm font-semibold text-gray-900">
                Here&apos;s what we have on file
              </h2>
              <div className="mt-2 flex items-center gap-3 rounded-md border border-gray-200 px-4 py-3">
                <InitialsAvatar name={SAMPLE_ALUM_NAME} size="lg" />
                <div>
                  <p className="text-xs font-medium text-gray-500">Photo</p>
                  <p className="text-sm text-gray-700">
                    Your current profile photo
                  </p>
                </div>
              </div>
              <dl className="mt-2 divide-y divide-gray-100 rounded-md border border-gray-200">
                {onFile.length === 0 ? (
                  <p className="px-4 py-3 text-sm text-gray-500">
                    We don&apos;t have any details on file yet.
                  </p>
                ) : (
                  onFile.map((q) => {
                    const f = SURVEY_FIELD_BY_KEY[q.fieldKey];
                    return (
                      <div
                        key={q.id}
                        className="flex flex-wrap items-center justify-between gap-x-4 gap-y-0.5 px-4 py-2.5"
                      >
                        <dt className="text-xs font-medium text-gray-500">
                          {f?.label ?? q.label}
                        </dt>
                        <dd className="text-sm font-medium text-gray-900">
                          {SAMPLE_ALUM[q.fieldKey]}
                        </dd>
                      </div>
                    );
                  })
                )}
              </dl>
            </section>

            <section className="mt-6">
              <p className="flex items-center gap-2 text-sm font-semibold text-gray-900">
                <ShieldCheck
                  className="h-4 w-4 text-brand-blue-600"
                  aria-hidden="true"
                />
                Is this information current and accurate?
              </p>
              <div className="mt-3 flex flex-col gap-2 sm:flex-row">
                <Button
                  type="button"
                  size="lg"
                  className="w-full sm:flex-1"
                  onClick={() => setStatus("confirmed")}
                >
                  <CheckCircle2 aria-hidden="true" />
                  Yes, it&apos;s all correct
                </Button>
                <Button
                  type="button"
                  variant="secondary"
                  size="lg"
                  className="w-full sm:flex-1"
                  onClick={() => setStatus("editing")}
                >
                  <PencilLine aria-hidden="true" />
                  No, I need to update something
                </Button>
              </div>
            </section>
          </Card>
        )}

        <p className="mt-6 text-center text-xs text-gray-400">
          Prototype — this page loads a sample alum and doesn&apos;t send
          anything to a server.
        </p>
      </div>
    </main>
  );
}

/* ---------------------------------------------------------- field control -- */

/**
 * One editable survey field, prefilled from `SAMPLE_ALUM`. Mirrors the editor
 * preview's control-per-type logic: text columns render a pre-filled input,
 * boolean columns a Yes/No radio group (plus the Pay It Forward donate link on
 * the giving field).
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
              className="flex gap-4"
              role="radiogroup"
              aria-labelledby={labelId}
            >
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

function SuccessCard({
  title,
  body,
  action,
}: {
  title: string;
  body: string;
  action?: React.ReactNode;
}) {
  return (
    <Card className="p-8 text-center">
      <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-success-50">
        <CheckCircle2
          className="h-6 w-6 text-success-600"
          aria-hidden="true"
        />
      </div>
      <h2 className="mt-4 text-lg font-semibold text-gray-900">{title}</h2>
      <p className="mx-auto mt-2 max-w-sm text-sm text-gray-500">{body}</p>
      {action ? <div className="mt-5 flex justify-center">{action}</div> : null}
    </Card>
  );
}
