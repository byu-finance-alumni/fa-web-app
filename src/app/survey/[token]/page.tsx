"use client";

import { use, useEffect, useState } from "react";
import { Check, ChevronDown, ExternalLink, Heart } from "lucide-react";

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
 * an alum can open it from an email link without signing in. It reads the authored
 * questions from `localStorage` (set by staff in the "Sample survey" editor) for
 * the edit form, and the sample alum from `SAMPLE_ALUM`. Nothing calls an API;
 * success is shown inline (no app shell / ToastProvider).
 */

type Status = "review" | "confirmed" | "editing" | "submitted";

/** First name for a warm greeting ("Hi, Jordan"). */
const FIRST_NAME = SAMPLE_ALUM_NAME.split(/\s+/)[0] || SAMPLE_ALUM_NAME;

/** One label/value row in the read-only "Your information" panel. */
type InfoRow = { label: string; value: string };

// The panel shows a fixed, curated view of what's on file — nothing beyond what
// the page already displayed. "Location" collapses city + state into one line.
const SAMPLE_LOCATION = [SAMPLE_ALUM["contact.city"], SAMPLE_ALUM["contact.state"]]
  .filter(Boolean)
  .join(", ");

// Career first (company/industry lead), then contact — matching the rest of the
// survey experience.
const CAREER_ROWS: InfoRow[] = [
  { label: "Employer", value: SAMPLE_ALUM["employment.current_employer"] ?? "" },
  { label: "Current title", value: SAMPLE_ALUM["employment.current_title"] ?? "" },
  { label: "Industry", value: SAMPLE_ALUM["employment.current_industry"] ?? "" },
];
const CONTACT_ROWS: InfoRow[] = [
  { label: "Personal email", value: SAMPLE_ALUM["contact.personal_email"] ?? "" },
  { label: "Phone", value: SAMPLE_ALUM["contact.phone"] ?? "" },
  { label: "Location", value: SAMPLE_LOCATION },
  { label: "LinkedIn", value: SAMPLE_ALUM["profile.linkedin_url"] ?? "" },
];

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

  return (
    <main className="min-h-screen bg-white text-gray-900">
      {/* Full-width navy header — page name only. */}
      <header className="bg-navy-800">
        <div className="mx-auto flex h-16 max-w-[800px] items-center px-5 sm:px-8">
          <span className="text-sm font-medium text-white sm:text-base">
            Alumni Information Update
          </span>
        </div>
      </header>

      <div className="mx-auto max-w-[800px] px-5 pb-16 pt-10 sm:px-8">
        {!hydrated ? (
          <div className="space-y-4">
            <div className="h-9 w-2/3 animate-pulse rounded bg-gray-100" />
            <div className="h-48 animate-pulse rounded-lg bg-gray-100" />
          </div>
        ) : status === "submitted" ? (
          <SuccessPanel
            title="Thank you — your updates are in"
            body="Our team will review your response before any changes are applied. You can safely close this page."
          />
        ) : status === "confirmed" ? (
          <SuccessPanel
            title={`Thanks for confirming, ${FIRST_NAME}`}
            body="Your information is up to date. We appreciate you helping us keep in touch about events, mentoring, and opportunities."
            action={
              <Button variant="secondary" onClick={() => setStatus("editing")}>
                I need to make changes
              </Button>
            }
          />
        ) : status === "editing" ? (
          <>
            <div>
              <h1 className="text-3xl font-semibold leading-tight tracking-tight text-navy-800">
                Update your information
              </h1>
              <p className="mt-3 max-w-prose text-base leading-relaxed text-gray-600">
                Everything is filled in with what we have on file. Just change
                anything that is out of date.
              </p>
            </div>

            <form
              className="mt-8 space-y-6"
              onSubmit={(e) => {
                e.preventDefault();
                setStatus("submitted");
              }}
            >
              <div className="space-y-5 rounded-lg border border-gray-200 bg-white p-5 sm:p-6">
                {inlineQuestions.map((q) => (
                  <FieldControl key={q.id} question={q} />
                ))}
              </div>

              {engagementQuestions.length > 0 ? (
                <div className="overflow-hidden rounded-lg border border-gray-200 bg-white">
                  <button
                    type="button"
                    onClick={() => setEngagementOpen((o) => !o)}
                    aria-expanded={engagementOpen}
                    aria-controls="survey-engagement-panel"
                    className="flex w-full items-center justify-between gap-3 px-5 py-4 text-left transition-colors hover:bg-gray-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-blue-500 focus-visible:ring-inset sm:px-6"
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
                      className="space-y-5 border-t border-gray-200 px-5 py-5 sm:px-6"
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
                <Button
                  type="submit"
                  variant="navy"
                  size="lg"
                  className="w-full sm:w-auto"
                >
                  Submit my updates
                </Button>
              </div>
            </form>

            <TrustNote />
          </>
        ) : (
          /* status === "review" */
          <>
            <div>
              <h1 className="text-3xl font-semibold leading-tight tracking-tight text-navy-800">
                Hi, {FIRST_NAME}
              </h1>
              <p className="mt-3 max-w-prose text-base leading-relaxed text-gray-600">
                Please review the information we currently have on file. This
                should take less than a minute.
              </p>
            </div>

            {/* Your information — one bordered panel, two grouped columns. */}
            <section
              className="mt-8 rounded-lg border border-gray-200"
              aria-labelledby="your-info-heading"
            >
              <div className="border-b border-gray-200 px-5 py-3 sm:px-6">
                <h2
                  id="your-info-heading"
                  className="text-sm font-semibold text-gray-900"
                >
                  Your information
                </h2>
              </div>
              <div className="grid gap-x-10 gap-y-8 px-5 py-6 sm:grid-cols-2 sm:px-6">
                <InfoGroup title="Career information" rows={CAREER_ROWS} />
                <InfoGroup title="Contact information" rows={CONTACT_ROWS} />
              </div>
            </section>

            {/* Confirm */}
            <div className="mt-8">
              <p className="text-base font-medium text-gray-900">
                Is this information correct?
              </p>
              <div className="mt-4 flex flex-col gap-3 sm:flex-row">
                <Button
                  type="button"
                  variant="navy"
                  size="lg"
                  className="w-full sm:w-auto"
                  onClick={() => setStatus("confirmed")}
                >
                  Yes, everything is correct
                </Button>
                <Button
                  type="button"
                  variant="secondary"
                  size="lg"
                  className="w-full sm:w-auto"
                  onClick={() => setStatus("editing")}
                >
                  I need to make changes
                </Button>
              </div>
            </div>

            <TrustNote />
          </>
        )}

        <footer className="mt-12 text-center">
          <p className="text-xs text-gray-400">
            Prototype — loads a sample alum and doesn&apos;t send anything yet.
          </p>
        </footer>
      </div>
    </main>
  );
}

/* ------------------------------------------------------------ info group ---- */

/**
 * One labelled column in the "Your information" panel: a heading over a list of
 * label-above-value rows. Missing values read "Not provided" in muted text (no
 * per-field dividers — the whitespace does the grouping).
 */
function InfoGroup({ title, rows }: { title: string; rows: InfoRow[] }) {
  return (
    <div>
      <h3 className="text-sm font-semibold text-navy-800">{title}</h3>
      <dl className="mt-4 space-y-4">
        {rows.map((r) => (
          <div key={r.label}>
            <dt className="text-xs font-medium text-gray-500">{r.label}</dt>
            <dd className="mt-0.5 text-sm font-medium text-gray-900">
              {r.value ? (
                r.value
              ) : (
                <span className="font-normal text-gray-400">Not provided</span>
              )}
            </dd>
          </div>
        ))}
      </dl>
    </div>
  );
}

/* -------------------------------------------------------------- trust ------- */

/** Reassurance shown beneath the confirm / update actions. */
function TrustNote() {
  return (
    <p className="mt-8 border-t border-gray-200 pt-6 text-sm leading-relaxed text-gray-500">
      This secure form was sent by the BYU Finance Department. Your response will
      be reviewed before any changes are applied.
    </p>
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
    <div className="rounded-lg border border-gray-200 bg-white p-8 text-center sm:p-10">
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
