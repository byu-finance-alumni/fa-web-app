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
import { Badge, type BadgeProps } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { Alumni, AlumniPage } from "@/types/alumni";

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

/**
 * What a response's status means to the person reading it, not the DB word.
 *
 * Each note now describes what the row IS, not what a reset would do to it —
 * because a reset does nothing to it. The old copy ("deleting it throws the
 * submission away unreviewed") described behaviour that no longer exists.
 *
 * ⚠️ EVERY value `survey_responses.status` can hold must appear here. The
 * lookup falls back to the raw DB word, which is how `confirmed` (#755) would
 * have shown up in the engineer console as a bare lowercase "confirmed" with no
 * explanation next to three neighbours that all have one. The tone lives here
 * too, so a new status can never render with a colour chosen by an `else`
 * branch that has never heard of it.
 */
export const RESPONSE_STATUS: Record<
  string,
  { label: string; note: string; tone: BadgeProps["variant"] }
> = {
  pending: {
    label: "Awaiting review",
    note: "still in the review queue; a reset leaves it there, and it can still be applied to their profile",
    tone: "warning",
  },
  applied: {
    label: "Applied",
    note: "already written to their profile",
    tone: "success",
  },
  rejected: {
    label: "Rejected",
    note: "staff discarded it, so nothing reached their profile",
    tone: "muted",
  },
  // Added by #755: pressing "Yes, everything is correct" now POSTs
  // (`confirmed_only`) instead of flipping a client-side flag that recorded
  // nothing. It is a REPLY — it proves we reached them and that the record is
  // right — but it carries no changes, so there is nothing in it for a reviewer
  // to accept or discard. Hence `neutral` rather than `warning` (nothing is
  // waiting on anyone) or `muted` (it is not a dud).
  confirmed: {
    label: "Confirmed, no changes",
    note: "they replied to say everything we hold was already correct, so there is nothing to review or apply",
    tone: "neutral",
  },
};

function plural(n: number, one: string, many: string): string {
  return `${n} ${n === 1 ? one : many}`;
}

/**
 * Engineer tool: find one alumnus and make them surveyable again (#395).
 *
 * Replaces hand-run SQL. Re-surveying one person needs BOTH `survey_send_log`
 * (which blocks a repeat send inside a cycle) and `survey_responses` (the
 * 365-day window) to stop counting — lifting one leaves them just as blocked,
 * which is what sent people back to psql a second time. The backend does both by
 * recording a reset, and DELETES NOTHING (Jake, 2026-08-05).
 *
 * That inverts what this screen is for. It used to be a last-chance warning
 * before destruction: the confirm named the person and itemized what was about
 * to be lost. Nothing is lost now, so the confirm's job is the opposite one —
 * say plainly that the answers survive (people will assume otherwise, and this
 * very button used to delete them), and put the real consequence, another email
 * going out, where the warning used to be.
 *
 * Hence: search → read the state → one confirm → reset. The type-RESET step went
 * with the destruction it guarded; the state panel stays, because "they answered
 * three months ago" is still usually a reason to leave someone alone.
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
  const [confirming, setConfirming] = useState(false);

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
    setConfirming(false);
  }

  function run() {
    if (!state) return;
    const target = state;
    startTransition(async () => {
      const res = await resetSurveyCampaign(target.alumni_id);
      if ("error" in res) {
        toast.error(res.error);
        return;
      }
      const { name, responses_preserved, pending_preserved } = res.result;
      toast.success(
        `${name} can be surveyed again. ` +
          (responses_preserved > 0
            ? `${plural(
                responses_preserved,
                "earlier response is",
                "earlier responses are",
              )} still on their record` +
              (pending_preserved > 0
                ? `, including ${pending_preserved} awaiting review.`
                : ".")
            : "Nothing was removed."),
      );
      setConfirming(false);
      // Re-read so the panel shows the post-reset state — everything still
      // listed, nothing blocking — rather than the stale pre-reset one.
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
        Makes a single alumnus eligible for their cohort’s next survey send
        again, keeping their earlier answers and send history.
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

          {/* Someone reset before has superseded rows below; without this they
              read as unexplained history. */}
          {state.reset_count > 0 ? (
            <p className="mt-3 text-sm text-gray-500">
              Already reset {plural(state.reset_count, "time", "times")}, most
              recently {formatDateTime(state.last_reset_at)}.
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
                Yes. Nothing is holding them back, so a reset would change
                nothing.
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
                      key={`${s.graduation_year}-${s.cycle_seq}-${s.stage}-${s.sent_at}`}
                      className="flex flex-wrap items-baseline gap-2"
                    >
                      <span>{s.stage_label}</span>
                      <span className="text-xs text-gray-500">
                        {formatDateTime(s.sent_at)}
                      </span>
                      {/* Only the current campaign's un-superseded sends block
                          anything — without this every long-standing alum reads
                          as stuck. */}
                      <Badge
                        variant={
                          s.current_cycle
                            ? "warning"
                            : s.superseded
                              ? "neutral"
                              : "muted"
                        }
                      >
                        {s.current_cycle
                          ? "current campaign"
                          : s.superseded
                            ? "before a reset"
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
                  They have never replied.
                </p>
              ) : (
                <ul className="mt-2 space-y-2 text-sm text-gray-700">
                  {responses.map((r) => {
                    const meaning =
                      RESPONSE_STATUS[r.status] ??
                      { label: r.status, note: "", tone: "neutral" as const };
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
                          <Badge variant={meaning.tone}>{meaning.label}</Badge>
                          {r.blocks_resend ? (
                            <Badge variant="danger">blocking</Badge>
                          ) : null}
                          {r.superseded ? (
                            <Badge variant="neutral">previous cycle</Badge>
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
              variant="navy"
              onClick={() => setConfirming(true)}
              disabled={pending}
            >
              Reset survey campaign
            </Button>
            <p className="max-w-lg text-xs text-gray-500">
              {blocked
                ? "They are included in the next send for their cohort; nothing of theirs is deleted."
                : "Nothing is blocking them, so this would only record a reset."}
            </p>
          </div>
        </div>
      ) : null}

      {confirming && state ? (
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
              Survey {state.name} again?
            </h2>

            {/* Names the person, says what survives, and puts the one real
                consequence — another email — where the warning used to be. This
                button DID delete their answers until today, so "nothing is
                deleted" has to be stated, not implied. */}
            <div id="survey-reset-desc" className="space-y-3 text-sm text-gray-600">
              <p>
                <span className="font-medium text-gray-900">{state.name}</span>{" "}
                becomes eligible for their cohort’s next survey send, so they
                will receive another survey email.
              </p>
              <p className="font-medium text-gray-900">Nothing is deleted.</p>
              <ul className="space-y-1">
                <li>
                  —{" "}
                  {responses.length === 0
                    ? "They have never replied, so there are no answers to keep."
                    : `Their ${plural(
                        responses.length,
                        "submitted response stays",
                        "submitted responses stay",
                      )} in the database and on their Surveys tab, marked as a previous cycle.`}
                </li>
                {unreviewed > 0 ? (
                  <li>
                    —{" "}
                    <span className="font-medium text-gray-900">
                      {unreviewed === 1
                        ? "One of those is still awaiting review"
                        : `${unreviewed} of those are still awaiting review`}
                    </span>{" "}
                    and stays in the review queue, so you can still apply{" "}
                    {unreviewed === 1 ? "it" : "them"} to their profile
                    afterwards, submitted photo included.
                  </li>
                ) : null}
                <li>
                  —{" "}
                  {state.sends.length === 0
                    ? "No survey email has ever been sent to them."
                    : `The ${plural(
                        state.sends.length,
                        "record of the survey email sent to them stays",
                        "records of the survey emails sent to them stay",
                      )}; they simply stop counting against the next send.`}
                </li>
              </ul>
              <p>
                Nothing else on their record changes, no other alum is affected,
                and their cohort’s campaign keeps running.
              </p>
              {!blocked ? (
                <p className="font-medium text-warning-600">
                  Nothing is currently blocking this alum, so this reset would
                  change nothing.
                </p>
              ) : null}
            </div>
            <div className="mt-5 flex justify-end gap-2">
              <Button
                type="button"
                variant="secondary"
                onClick={() => setConfirming(false)}
                disabled={pending}
              >
                Cancel
              </Button>
              <Button
                type="button"
                variant="navy"
                autoFocus
                onClick={run}
                disabled={pending}
              >
                {pending ? "Resetting…" : "Reset survey campaign"}
              </Button>
            </div>
          </div>
        </div>
      ) : null}
    </Card>
  );
}
