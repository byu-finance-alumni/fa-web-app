"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  getSurveyAlumnusState,
  resetSurveyCampaign,
  type SurveyAlumniState,
} from "@/app/(app)/engineer/surveys/actions";
import { clientGet, ApiClientError } from "@/lib/api-client";
import { useToast } from "@/components/ui/Toast";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { Alumni, AlumniPage } from "@/types/alumni";

/** Typed verbatim to arm the reset — a deliberate keystroke, not a mis-click. */
const CONFIRM_WORD = "RESET";

/** Utah time, matching every other timestamp on this console. */
function formatDateTime(d: string | null | undefined): string {
  if (!d) return "—";
  return new Date(d).toLocaleString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "America/Denver",
    timeZoneName: "short",
  });
}

function formatDate(d: string | null | undefined): string {
  if (!d) return "—";
  return new Date(`${d}T00:00:00`).toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function alumniName(a: Alumni): string {
  const first = a.preferred_first_name || a.first_name || "";
  return [first, a.last_name].filter(Boolean).join(" ").trim() || `#${a.alumni_id}`;
}

/** What a response's status means to the person reading it, not the DB word. */
const RESPONSE_STATUS: Record<string, { label: string; note: string }> = {
  pending: {
    label: "Awaiting review",
    note: "not yet applied to their profile — deleting it throws the submission away unreviewed",
  },
  applied: {
    label: "Applied",
    note: "already written to their profile; deleting it removes the record of the submission, not the profile data",
  },
  rejected: {
    label: "Rejected",
    note: "staff discarded it, so nothing reached their profile",
  },
};

function plural(n: number, one: string, many: string): string {
  return `${n} ${n === 1 ? one : many}`;
}

/**
 * Engineer tool: find one alumnus and reset their survey campaign state (#395).
 *
 * Replaces hand-run SQL. Re-surveying one person needs BOTH `survey_send_log`
 * (which blocks a repeat send inside a cycle) and `survey_responses` (the
 * 365-day window) cleared — clearing one leaves them just as blocked, which is
 * what sent people back to psql a second time. The backend does both in one
 * call; this screen's job is to make sure the reset is the right thing to do
 * before it fires.
 *
 * Hence the shape: search → READ THE STATE → confirm → reset. The state panel is
 * not decoration. A person very often looks "blocked" simply because they
 * legitimately answered three months ago, and the right move is then to leave
 * them alone rather than delete a real reply — so when nothing is actually
 * blocking them the panel says so and the button warns that a reset would only
 * destroy history.
 *
 * The confirm names the person and itemizes what is lost. The backend
 * re-enforces RequireEngineer; this component only drives the request and
 * reports the counts it actually deleted.
 */
export function SurveyCampaignReset() {
  const { toast } = useToast();
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Alumni[]>([]);
  const [searching, setSearching] = useState(false);
  const [searched, setSearched] = useState(false);

  const [state, setState] = useState<SurveyAlumniState | null>(null);
  const [loadingState, setLoadingState] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // null = closed; "confirm" = the itemized warning; "type" = type-RESET.
  const [step, setStep] = useState<null | "confirm" | "type">(null);
  const [typed, setTyped] = useState("");
  const matches = typed.trim().toUpperCase() === CONFIRM_WORD;

  // Keep the latest search in charge: a slow early request must not overwrite a
  // later one's results.
  const seq = useRef(0);

  useEffect(() => {
    const q = query.trim();
    if (q.length < 2) {
      setResults([]);
      setSearching(false);
      setSearched(false);
      return;
    }
    setSearching(true);
    const mine = ++seq.current;
    const t = setTimeout(async () => {
      try {
        const page = await clientGet<AlumniPage>(
          `/alumni?q=${encodeURIComponent(q)}&limit=8`,
        );
        if (mine !== seq.current) return;
        setResults(page.items);
      } catch (e) {
        if (mine !== seq.current) return;
        if (!(e instanceof ApiClientError)) console.error(e);
        setResults([]);
      } finally {
        if (mine === seq.current) {
          setSearching(false);
          setSearched(true);
        }
      }
    }, 250);
    return () => clearTimeout(t);
  }, [query]);

  /** Load (or re-load) one alum's survey state into the panel. */
  function load(alumniId: number) {
    setError(null);
    setLoadingState(true);
    startTransition(async () => {
      const res = await getSurveyAlumnusState(alumniId);
      setLoadingState(false);
      if ("error" in res) {
        setState(null);
        setError(res.error);
        return;
      }
      setState(res.state);
    });
  }

  function select(a: Alumni) {
    setQuery("");
    setResults([]);
    setSearched(false);
    setState(null);
    load(a.alumni_id);
  }

  function clear() {
    setState(null);
    setError(null);
    setStep(null);
    setTyped("");
  }

  function run() {
    if (!state || !matches) return;
    const target = state;
    startTransition(async () => {
      const res = await resetSurveyCampaign(target.alumni_id);
      if ("error" in res) {
        toast.error(res.error);
        return;
      }
      const { name, sends_deleted, responses_deleted } = res.result;
      toast.success(
        `Reset ${name} — removed ${plural(responses_deleted, "submitted response", "submitted responses")} and ` +
          `${plural(sends_deleted, "send record", "send records")}. They can be surveyed again.`,
      );
      setStep(null);
      setTyped("");
      // Re-read the state so the panel shows the CLEARED record rather than the
      // stale pre-reset one — otherwise the screen still shows the answers that
      // were just deleted, inviting a second reset.
      load(target.alumni_id);
      router.refresh();
    });
  }

  const blocked = (state?.blocked_reasons.length ?? 0) > 0;
  const responses = state?.responses ?? [];
  const unreviewed = responses.filter((r) => r.status === "pending").length;

  return (
    <Card className="p-5">
      <h2 className="text-sm font-semibold text-gray-900">
        Reset one alum’s survey campaign
      </h2>
      <p className="mt-1 max-w-3xl text-sm text-gray-500">
        Makes a single alumnus surveyable again — the thing that used to need SQL
        by hand. It clears both of the things that hold someone out of a
        campaign: the record of the survey emails they were sent, and their
        submitted responses (which silence them for 365 days). Their survey link
        is not stored anywhere, so a fresh send simply issues a new one. Search
        for the person, read what their state actually is, then decide.
      </p>

      <div className="mt-4 max-w-md">
        <Label htmlFor="survey-reset-search">Find an alum</Label>
        <Input
          id="survey-reset-search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          autoComplete="off"
          spellCheck={false}
          placeholder="Name, email, or NetID"
          className="mt-1"
        />
        {searching ? (
          <p className="mt-2 text-xs text-gray-500">Searching…</p>
        ) : null}
        {!searching && searched && results.length === 0 ? (
          <p className="mt-2 text-xs text-gray-500">No matching alumni.</p>
        ) : null}
        {results.length > 0 ? (
          <ul className="mt-2 divide-y divide-gray-200 rounded-lg border border-gray-200">
            {results.map((a) => (
              <li key={a.alumni_id}>
                <button
                  type="button"
                  onClick={() => select(a)}
                  className="flex w-full items-baseline justify-between gap-3 px-3 py-2 text-left text-sm hover:bg-gray-50"
                >
                  <span className="font-medium text-gray-900">
                    {alumniName(a)}
                  </span>
                  <span className="shrink-0 text-xs tabular-nums text-gray-500">
                    {a.graduation_year ?? "—"} · #{a.alumni_id}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        ) : null}
      </div>

      {loadingState ? (
        <p className="mt-4 text-sm text-gray-500">Loading survey state…</p>
      ) : null}

      {error ? (
        <p className="mt-4 text-sm text-danger-600">{error}</p>
      ) : null}

      {state ? (
        <div className="mt-5 rounded-lg border border-gray-200 p-4">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <div>
              <p className="text-sm font-semibold text-gray-900">
                {state.name}
              </p>
              <p className="text-xs text-gray-500">
                Class of {state.graduation_year ?? "—"} · #{state.alumni_id}
                {state.email ? ` · ${state.email}` : " · no email on file"}
              </p>
            </div>
            <Button type="button" variant="secondary" onClick={clear}>
              Clear
            </Button>
          </div>

          {state.archived ? (
            <p className="mt-3 text-sm text-warning-600">
              This record is archived, so no campaign includes them regardless of
              anything below.
            </p>
          ) : null}

          {/* The decision this screen exists to inform. */}
          <div className="mt-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">
              Can they be surveyed right now?
            </p>
            {blocked ? (
              <ul className="mt-1 space-y-1 text-sm text-gray-700">
                {state.blocked_reasons.map((r) => (
                  <li key={r}>— {r}</li>
                ))}
              </ul>
            ) : (
              <p className="mt-1 text-sm text-gray-700">
                Yes — nothing is holding them back. A reset would unblock nothing
                and would only delete the history below.
              </p>
            )}
          </div>

          <div className="mt-4 grid gap-4 md:grid-cols-2">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                Emails sent ({state.sends.length})
              </p>
              {state.schedule_status ? (
                <p className="mt-1 text-xs text-gray-500">
                  Their cohort’s campaign is{" "}
                  <span className="font-medium text-gray-700">
                    {state.schedule_status}
                  </span>
                  , starting {formatDate(state.schedule_start_date)} (campaign #
                  {state.schedule_cycle_seq}).
                </p>
              ) : (
                <p className="mt-1 text-xs text-gray-500">
                  Their graduation year has no campaign scheduled.
                </p>
              )}
              {state.sends.length === 0 ? (
                <p className="mt-2 text-sm text-gray-700">
                  They have never been sent a survey.
                </p>
              ) : (
                <ul className="mt-2 space-y-1 text-sm text-gray-700">
                  {state.sends.map((s) => (
                    <li
                      key={`${s.graduation_year}-${s.cycle_seq}-${s.stage}`}
                      className="flex flex-wrap items-baseline gap-2"
                    >
                      <span>{s.stage_label}</span>
                      <span className="text-xs text-gray-500">
                        {formatDateTime(s.sent_at)}
                      </span>
                      {/* Only the current campaign's sends can block anything —
                          without this every long-standing alum reads as stuck. */}
                      <Badge variant={s.current_cycle ? "warning" : "muted"}>
                        {s.current_cycle
                          ? "current campaign"
                          : `campaign #${s.cycle_seq}`}
                      </Badge>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                Responses ({responses.length})
              </p>
              {responses.length === 0 ? (
                <p className="mt-2 text-sm text-gray-700">
                  They have never replied. A reset destroys no answers.
                </p>
              ) : (
                <ul className="mt-2 space-y-2 text-sm text-gray-700">
                  {responses.map((r) => {
                    const meaning =
                      RESPONSE_STATUS[r.status] ??
                      { label: r.status, note: "" };
                    return (
                      <li key={r.survey_response_id}>
                        <span className="flex flex-wrap items-baseline gap-2">
                          <span>
                            {plural(r.field_count, "field", "fields")}
                            {r.has_photo ? " + photo" : ""}
                          </span>
                          <span className="text-xs text-gray-500">
                            {formatDateTime(r.submitted_at)}
                          </span>
                          <Badge
                            variant={
                              r.status === "pending"
                                ? "warning"
                                : r.status === "applied"
                                  ? "success"
                                  : "muted"
                            }
                          >
                            {meaning.label}
                          </Badge>
                          {r.blocks_resend ? (
                            <Badge variant="danger">blocking</Badge>
                          ) : null}
                        </span>
                        {meaning.note ? (
                          <span className="mt-0.5 block text-xs text-gray-500">
                            {meaning.note}
                          </span>
                        ) : null}
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          </div>

          <div className="mt-5 flex flex-wrap items-center gap-3">
            <Button
              type="button"
              variant="destructive"
              onClick={() => setStep("confirm")}
              disabled={pending}
            >
              Reset survey campaign
            </Button>
            <p className="max-w-lg text-xs text-gray-500">
              {responses.length === 0
                ? "Nothing of theirs would be deleted except the record of the emails sent."
                : `Permanently deletes ${plural(responses.length, "submitted response", "submitted responses")}${
                    unreviewed > 0
                      ? `, ${unreviewed} of which ${unreviewed === 1 ? "has" : "have"} not been reviewed yet`
                      : ""
                  }. There is no undo.`}
            </p>
          </div>
        </div>
      ) : null}

      {step !== null && state ? (
        <div
          role="alertdialog"
          aria-modal="true"
          aria-labelledby="survey-reset-title"
          aria-describedby="survey-reset-desc"
          className="fixed inset-0 z-[100] flex items-center justify-center bg-navy-900/50 p-4"
        >
          <div className="w-full max-w-lg rounded-lg border border-gray-200 bg-white p-6 shadow-card">
            <h2
              id="survey-reset-title"
              className="mb-3 text-lg font-semibold text-gray-900"
            >
              {step === "confirm"
                ? `Delete ${state.name}’s survey answers?`
                : `Confirm resetting ${state.name}`}
            </h2>

            {step === "confirm" ? (
              <>
                {/* Names the person and itemizes the loss — a generic "are you
                    sure?" would not tell the operator that unreviewed answers
                    are about to be thrown away. */}
                <div id="survey-reset-desc" className="space-y-3 text-sm text-gray-600">
                  <p>
                    This permanently deletes{" "}
                    <span className="font-medium text-gray-900">
                      {state.name}
                    </span>
                    ’s survey record:
                  </p>
                  <ul className="space-y-1">
                    <li>
                      —{" "}
                      <span className="font-medium text-gray-900">
                        {plural(
                          responses.length,
                          "submitted response",
                          "submitted responses",
                        )}
                      </span>
                      {responses.length > 0 ? (
                        <>
                          {" "}
                          ({responses
                            .map(
                              (r) =>
                                `${plural(r.field_count, "field", "fields")}${
                                  r.has_photo ? " + photo" : ""
                                } on ${new Date(
                                  r.submitted_at,
                                ).toLocaleDateString("en-US", {
                                  month: "short",
                                  day: "numeric",
                                  year: "numeric",
                                  timeZone: "America/Denver",
                                })}`,
                            )
                            .join("; ")}
                          ).{" "}
                          {unreviewed > 0 ? (
                            <span className="font-medium text-danger-600">
                              {unreviewed === 1
                                ? "One of these is still awaiting review and has not been applied to their profile — those answers are gone, not saved."
                                : `${unreviewed} of these are still awaiting review and have not been applied to their profile — those answers are gone, not saved.`}
                            </span>
                          ) : null}
                        </>
                      ) : (
                        " — they have never replied, so no answers are lost."
                      )}
                    </li>
                    <li>
                      —{" "}
                      <span className="font-medium text-gray-900">
                        {plural(
                          state.sends.length,
                          "record of a survey email sent to them",
                          "records of survey emails sent to them",
                        )}
                      </span>
                      .
                    </li>
                  </ul>
                  <p>
                    Their Surveys tab will show no history afterwards. Nothing
                    else on their record changes, no other alum is affected, and
                    their cohort’s campaign keeps running. This cannot be undone.
                  </p>
                  {!blocked ? (
                    <p className="font-medium text-danger-600">
                      Nothing is currently blocking this alum from being
                      surveyed, so this reset would delete the above and unblock
                      nothing.
                    </p>
                  ) : null}
                </div>
                <div className="mt-5 flex justify-end gap-2">
                  <Button
                    type="button"
                    variant="secondary"
                    onClick={() => setStep(null)}
                  >
                    Cancel
                  </Button>
                  <Button
                    type="button"
                    variant="destructive"
                    autoFocus
                    onClick={() => setStep("type")}
                  >
                    Yes, continue
                  </Button>
                </div>
              </>
            ) : (
              <>
                <p id="survey-reset-desc" className="text-sm text-gray-600">
                  Type{" "}
                  <code className="rounded bg-gray-100 px-1 py-0.5 font-mono text-xs text-gray-900">
                    {CONFIRM_WORD}
                  </code>{" "}
                  to delete {state.name}’s survey answers and send history.
                </p>
                <Input
                  value={typed}
                  onChange={(e) => setTyped(e.target.value)}
                  autoFocus
                  autoComplete="off"
                  spellCheck={false}
                  aria-label={`Type ${CONFIRM_WORD} to confirm`}
                  placeholder={CONFIRM_WORD}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && matches && !pending) run();
                  }}
                  className="mt-3 focus-visible:border-danger-600 focus-visible:ring-danger-600"
                />
                <div className="mt-5 flex justify-end gap-2">
                  <Button
                    type="button"
                    variant="secondary"
                    onClick={() => {
                      setStep(null);
                      setTyped("");
                    }}
                    disabled={pending}
                  >
                    Cancel
                  </Button>
                  <Button
                    type="button"
                    variant="destructive"
                    onClick={run}
                    disabled={!matches || pending}
                  >
                    {pending ? "Resetting…" : "Reset survey campaign"}
                  </Button>
                </div>
              </>
            )}
          </div>
        </div>
      ) : null}
    </Card>
  );
}
