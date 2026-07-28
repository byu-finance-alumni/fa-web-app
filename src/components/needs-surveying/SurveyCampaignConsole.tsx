"use client";

import { useEffect, useState } from "react";
import {
  CalendarClock,
  CheckCircle2,
  ChevronDown,
  Copy,
  History,
  MailX,
  Pencil,
  Send,
  Undo2,
  X,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/components/ui/Toast";
import { cn } from "@/lib/utils";
import { ApiClientError, clientGet, clientPost } from "@/lib/api-client";
import { PendingSubmissions } from "@/components/needs-surveying/PendingSubmissions";
import { SAMPLE_CAMPAIGNS, initialSentCount } from "@/lib/sampleCampaigns";
import type { components } from "@/types/api.gen";
import type { ClassCampaign, SurveyRound } from "@/types/surveyCampaign";

/** Distinct graduation years present in the DB, straight off the OpenAPI. */
type GradYearCount = components["schemas"]["GraduationYearCount"];
/** The send endpoint's result, straight off the OpenAPI. */
type SurveySendResult = components["schemas"]["SurveySendResult"];

/**
 * Send re-surveys BY GRADUATION YEAR — the campaign console on the Needs
 * Surveying tab (frontend-only PROTOTYPE).
 *
 * There is NO backend for survey campaigns, so everything here is staged in
 * component state seeded from `SAMPLE_CAMPAIGNS` (deep-copied so sends, rejects,
 * and edits never touch the module constant). No email is sent and no record is
 * written.
 *
 * Kept intentionally compact: one overview card (surveys-sent counter, the
 * graduation-year picker, last/next send + the 3-send stepper, and Send), an
 * expandable no-reply list for manual outreach, a dense change report (only
 * alumni who changed something, each rejectable/editable), and an admin Submit.
 */

/** Fixed demo date stamped on a send in the prototype (matches the mock cadence). */
const DEMO_SEND_DATE = "2026-07-20";

// Resend send caps (Free plan): 100 emails/day, 3,000/month. Surfaced so a batch
// never silently blows past them — a big class batch has to spread across days.
const DAILY_LIMIT = 100;
const MONTHLY_LIMIT = 3000;

/** A change record with a local "rejected" flag layered on for staging. */
type WorkingChangeRecord = ClassCampaign["changeRecords"][number] & {
  rejected: boolean;
};

/** One day's batch in a multi-day send (100/day under the Resend daily cap). */
interface SendBatch {
  date: string;
  count: number;
  sent: boolean;
}

/** A class campaign with the local rejected flag + any staged send schedule. */
type WorkingClass = Omit<ClassCampaign, "changeRecords"> & {
  changeRecords: WorkingChangeRecord[];
  /** Multi-day delivery schedule, set once a send is kicked off. */
  schedule?: SendBatch[];
};

/** Deep-copy the sample campaigns into editable working state. */
function initClasses(): WorkingClass[] {
  return SAMPLE_CAMPAIGNS.map((c) => ({
    ...c,
    patches: c.patches.map((p) => ({ ...p })),
    noReply: c.noReply.map((n) => ({ ...n })),
    changeRecords: c.changeRecords.map((r) => ({
      ...r,
      rejected: false,
      changes: r.changes.map((ch) => ({ ...ch })),
    })),
  }));
}

/** A never-surveyed class (all three sends pending) with a real alumni count —
 *  used for graduation years that come from the DB but have no campaign yet. */
function freshClass(gradYear: number, totalAlumni: number): WorkingClass {
  return {
    gradYear,
    totalAlumni,
    patches: [
      { label: "Initial", sentDate: null, recipients: totalAlumni, responses: 0 },
      { label: "1-week reminder", sentDate: null, recipients: 0, responses: 0 },
      { label: "2-week reminder", sentDate: null, recipients: 0, responses: 0 },
    ],
    nextSendDate: "",
    noReply: [],
    noChangeCount: 0,
    changeRecords: [],
    submitted: false,
  };
}

/** Build the working class list from the DB's real graduation years (newest
 *  first). A year that also has sample campaign data keeps it (for the demo),
 *  with its alumni count refreshed; every other year is a fresh, ready-to-send
 *  class. This is what makes the picker list the actual DB years (incl. 1900). */
function classesFromYears(years: GradYearCount[]): WorkingClass[] {
  const sample = new Map(initClasses().map((c) => [c.gradYear, c]));
  return years.map((y) => {
    const existing = sample.get(y.graduation_year);
    return existing
      ? { ...existing, totalAlumni: y.total_alumni }
      : freshClass(y.graduation_year, y.total_alumni);
  });
}

/** Format an ISO `YYYY-MM-DD` as e.g. "Mar 3, 2026" (no timezone drift). Blank
 *  dates (a class that's never been scheduled) read "Not scheduled". */
function formatDate(iso: string): string {
  if (!iso) return "Not scheduled";
  return new Date(`${iso}T00:00:00`).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

/** ISO date `n` days after `iso` (local, no tz drift). */
function addDays(iso: string, n: number): string {
  const d = new Date(`${iso}T00:00:00`);
  d.setDate(d.getDate() + n);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/**
 * Split a send into daily batches under the 100/day cap: the first batch uses
 * whatever daily capacity is left today (marked sent), then 100/day on the
 * following days (scheduled). Total is clamped to the month's remaining capacity.
 */
function buildSchedule(
  target: number,
  dailyRemaining: number,
  monthlyRemaining: number,
  startIso: string,
): { batches: SendBatch[]; total: number; cappedByMonth: boolean } {
  const total = Math.min(target, monthlyRemaining);
  const batches: SendBatch[] = [];
  let remaining = total;
  const firstCount = Math.min(remaining, dailyRemaining);
  if (firstCount > 0) {
    batches.push({ date: startIso, count: firstCount, sent: true });
    remaining -= firstCount;
  }
  let dayOffset = 0;
  while (remaining > 0) {
    dayOffset += 1;
    const count = Math.min(remaining, DAILY_LIMIT);
    batches.push({ date: addDays(startIso, dayOffset), count, sent: false });
    remaining -= count;
  }
  return { batches, total, cappedByMonth: target > monthlyRemaining };
}

export function SurveyCampaignConsole() {
  const { toast } = useToast();

  const [classes, setClasses] = useState<WorkingClass[]>(initClasses);
  const [sentCount, setSentCount] = useState(() =>
    initialSentCount(SAMPLE_CAMPAIGNS),
  );
  // Rolling Resend usage against the caps (seeded so a full class batch visibly
  // bumps against the 100/day limit).
  const [sentToday, setSentToday] = useState(0);
  const [sentThisMonth, setSentThisMonth] = useState(640);
  const [selectedYear, setSelectedYear] = useState<number>(
    SAMPLE_CAMPAIGNS[0].gradYear,
  );
  const [noReplyOpen, setNoReplyOpen] = useState(false);

  const [sendOpen, setSendOpen] = useState(false);
  const [sending, setSending] = useState(false);
  const [customMessage, setCustomMessage] = useState("");
  const [submitOpen, setSubmitOpen] = useState(false);

  // Inline edit of one alum's proposed "after" values (one record at a time).
  const [editingId, setEditingId] = useState<number | null>(null);
  const [drafts, setDrafts] = useState<string[]>([]);

  // Populate the year picker from the REAL database graduation years (so it
  // lists every class in the DB, including the 1900 test cohort) — falling back
  // to the sample campaigns while loading or if the request fails.
  useEffect(() => {
    let cancelled = false;
    clientGet<GradYearCount[]>("/survey/graduation-years")
      .then((years) => {
        if (cancelled || !years || years.length === 0) return;
        const next = classesFromYears(years);
        setClasses(next);
        setSentCount(initialSentCount(next));
        setSelectedYear((cur) =>
          next.some((c) => c.gradYear === cur) ? cur : next[0].gradYear,
        );
      })
      .catch(() => {
        /* keep the sample-campaign fallback so the console still renders */
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const selected =
    classes.find((c) => c.gradYear === selectedYear) ?? classes[0];

  const activeChanges = selected.changeRecords.filter((r) => !r.rejected);
  const rejectedCount = selected.changeRecords.length - activeChanges.length;
  const applyCount = activeChanges.length;
  const noReplyCount = selected.noReply.length;

  // Last time this graduation year was surveyed (the most recent sent patch).
  const sentPatches = selected.patches.filter((p) => p.sentDate !== null);
  const lastSent =
    sentPatches.length > 0 ? sentPatches[sentPatches.length - 1].sentDate : null;

  // Which send is next for this year: the first patch whose `sentDate` is still
  // null. Patch 1 (index 0) is the initial send to all eligible; patches 2–3 are
  // the 1-week and 2-week reminders to the current no-reply set. −1 means every
  // send has gone out.
  const nextPatchIndex = selected.patches.findIndex((p) => p.sentDate === null);
  const hasNextPatch = nextPatchIndex !== -1;
  const nextPatchNumber = nextPatchIndex + 1; // 1-based label
  const sendStage: "first" | "followup" =
    nextPatchIndex === 0 ? "first" : "followup";
  const sendTargetCount = hasNextPatch
    ? sendStage === "first"
      ? selected.patches[0].recipients
      : noReplyCount
    : 0;
  const sendLabel = hasNextPatch
    ? `Send patch ${nextPatchNumber}`
    : "All patches sent";
  // Split this send into 100/day batches: today's batch goes now, the rest are
  // scheduled on the following days.
  const dailyLeft = Math.max(0, DAILY_LIMIT - sentToday);
  const monthlyLeft = Math.max(0, MONTHLY_LIMIT - sentThisMonth);
  const plan = buildSchedule(
    sendTargetCount,
    dailyLeft,
    monthlyLeft,
    DEMO_SEND_DATE,
  );
  const todayBatch = plan.batches.find((b) => b.sent)?.count ?? 0;
  const scheduledLater = plan.total - todayBatch;
  const sendDisabled =
    selected.submitted || sendTargetCount === 0 || plan.total === 0;

  const changeSelectedYear = (year: number) => {
    setSelectedYear(year);
    setNoReplyOpen(false);
    setEditingId(null);
    setDrafts([]);
  };

  const confirmSend = async () => {
    if (!hasNextPatch || sending) return;
    setSending(true);
    try {
      // REAL send: hit the backend, which emails every eligible alum in this
      // year (with a personal email) via Resend, up to the daily cap.
      const result = await clientPost<SurveySendResult>(
        `/survey/campaigns/${selectedYear}/send?dry_run=false`,
      );

      // Reflect the real outcome in the UI.
      setClasses((prev) =>
        prev.map((c) =>
          c.gradYear === selectedYear
            ? {
                ...c,
                patches: c.patches.map((p, i) =>
                  i === nextPatchIndex
                    ? { ...p, sentDate: DEMO_SEND_DATE, recipients: result.prepared }
                    : p,
                ),
              }
            : c,
        ),
      );
      setSentCount((n) => n + result.sent);
      setSentThisMonth((m) => m + result.sent);
      setSentToday((d) => d + result.sent);
      setSendOpen(false);
      setCustomMessage("");

      if (result.sent > 0) {
        toast.success(
          `Sent ${result.sent.toLocaleString()} survey email${result.sent === 1 ? "" : "s"} for graduation year ${selectedYear}` +
            (result.remaining > 0
              ? ` — ${result.remaining.toLocaleString()} over today's cap; run Send again to continue.`
              : "."),
        );
      } else {
        toast.error(
          `No emails sent: ${result.total_recipients.toLocaleString()} recipient${result.total_recipients === 1 ? "" : "s"} found for ${selectedYear} (they need a personal email on file).`,
        );
      }
    } catch (err) {
      const msg =
        err instanceof ApiClientError && err.message
          ? err.message
          : "the request failed — check the backend Resend config.";
      toast.error(`Couldn't send: ${msg}`);
    } finally {
      setSending(false);
    }
  };

  const toggleReject = (alumniId: number) => {
    if (editingId === alumniId) {
      setEditingId(null);
      setDrafts([]);
    }
    setClasses((prev) =>
      prev.map((c) =>
        c.gradYear === selectedYear
          ? {
              ...c,
              changeRecords: c.changeRecords.map((r) =>
                r.alumniId === alumniId ? { ...r, rejected: !r.rejected } : r,
              ),
            }
          : c,
      ),
    );
  };

  const startEdit = (rec: WorkingChangeRecord) => {
    setEditingId(rec.alumniId);
    setDrafts(rec.changes.map((ch) => ch.after));
  };

  const cancelEdit = () => {
    setEditingId(null);
    setDrafts([]);
  };

  const saveEdit = (alumniId: number) => {
    setClasses((prev) =>
      prev.map((c) =>
        c.gradYear === selectedYear
          ? {
              ...c,
              changeRecords: c.changeRecords.map((r) =>
                r.alumniId === alumniId
                  ? {
                      ...r,
                      changes: r.changes.map((ch, i) => ({
                        ...ch,
                        after: (drafts[i] ?? ch.after).trim() || ch.after,
                      })),
                    }
                  : r,
              ),
            }
          : c,
      ),
    );
    setEditingId(null);
    setDrafts([]);
  };

  const confirmSubmit = () => {
    setClasses((prev) =>
      prev.map((c) =>
        c.gradYear === selectedYear ? { ...c, submitted: true } : c,
      ),
    );
    setSubmitOpen(false);
    toast.success(
      `Applied ${applyCount} ${
        applyCount === 1 ? "change" : "changes"
      } to graduation year ${selectedYear}.`,
    );
  };

  const copyEmails = async () => {
    const emails = selected.noReply.map((n) => n.email).join(", ");
    try {
      await navigator.clipboard.writeText(emails);
      toast.success(
        `Copied ${noReplyCount} email ${
          noReplyCount === 1 ? "address" : "addresses"
        }.`,
      );
    } catch {
      toast.error("Couldn't copy to the clipboard.");
    }
  };

  return (
    <>
      {/* ── Account totals + Resend send caps — for the WHOLE account, across
          every graduation year (not the selected year). ── */}
      <Card className="p-5">
        <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">
              Total surveys sent
            </p>
            <p className="text-3xl font-semibold tabular-nums tracking-tight text-navy-800">
              {sentCount.toLocaleString()}
            </p>
            <p className="text-xs text-gray-400">
              across the whole account, all graduation years
            </p>
          </div>
          <CapacityMeters dailyLeft={dailyLeft} monthlyLeft={monthlyLeft} />
        </div>
        <p className="mt-3 border-t border-gray-200 pt-3 text-xs text-gray-400">
          Send limits are account-wide across every graduation year — 100 emails
          per day, 3,000 per month.
        </p>
      </Card>

      {/* ── Year overview: picker, last/next send + patch stepper, and Send. ── */}
      <Card className="mt-4 p-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-[13rem]">
            <Label htmlFor="grad-year">Graduation year</Label>
            <Select
              id="grad-year"
              value={selectedYear}
              onChange={(e) => changeSelectedYear(Number(e.target.value))}
              className="mt-1"
            >
              {classes.map((c) => (
                <option key={c.gradYear} value={c.gradYear}>
                  {c.gradYear}
                </option>
              ))}
            </Select>
            <p className="mt-1 flex items-center gap-2 text-xs text-gray-500">
              {selected.totalAlumni.toLocaleString()} alumni graduated this year
              {selected.submitted ? (
                <Badge variant="success">
                  <CheckCircle2 className="h-3.5 w-3.5" aria-hidden="true" />
                  Applied
                </Badge>
              ) : null}
            </p>
          </div>
        </div>

        {/* Last / next annual send. */}
        <div className="mt-4 grid grid-cols-2 gap-x-4 gap-y-3 border-t border-gray-200 pt-4">
          <MiniStat
            icon={<History className="h-4 w-4" aria-hidden="true" />}
            label="Last sent"
            value={lastSent ? formatDate(lastSent) : "Never"}
          />
          <MiniStat
            icon={<CalendarClock className="h-4 w-4" aria-hidden="true" />}
            label="Next send due"
            value={formatDate(selected.nextSendDate)}
            sub="annual"
          />
        </div>

        {/* Three annual sends — a compact stepper. */}
        <div className="mt-4">
          <p className="text-xs font-medium text-gray-500">
            Send patches — initial, then 1-week &amp; 2-week reminders to
            non-responders
          </p>
          <ol className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-3">
            {selected.patches.map((p, i) => (
              <PatchStep
                key={i}
                index={i}
                patch={p}
                isNext={hasNextPatch && i === nextPatchIndex}
              />
            ))}
          </ol>
        </div>

        <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
          <span className="text-xs text-gray-400">
            Each recipient gets an email with their personal survey link.
          </span>
          <Button
            type="button"
            size="sm"
            onClick={() => setSendOpen(true)}
            disabled={sendDisabled}
          >
            <Send aria-hidden="true" />
            {hasNextPatch
              ? `${sendLabel} (${sendTargetCount.toLocaleString()})`
              : sendLabel}
          </Button>
        </div>

        {/* Multi-day delivery schedule, shown once a send is under way. */}
        {selected.schedule && selected.schedule.length > 0 ? (
          <div className="mt-3 rounded-md border border-brand-blue-300/50 bg-brand-blue-50 p-3">
            <p className="text-xs font-semibold text-navy-800">
              Delivery schedule —{" "}
              {selected.schedule
                .reduce((s, b) => s + b.count, 0)
                .toLocaleString()}{" "}
              over {selected.schedule.length}{" "}
              {selected.schedule.length === 1 ? "day" : "days"} at {DAILY_LIMIT}
              /day
            </p>
            <ul className="mt-2 grid gap-1 sm:grid-cols-2">
              {selected.schedule.map((b) => (
                <li
                  key={b.date}
                  className="flex items-center justify-between gap-2 text-xs"
                >
                  <span className="text-gray-700">{formatDate(b.date)}</span>
                  <span className="flex items-center gap-2">
                    <span className="tabular-nums font-medium text-gray-900">
                      {b.count.toLocaleString()}
                    </span>
                    {b.sent ? (
                      <Badge variant="success">Sent</Badge>
                    ) : (
                      <Badge variant="neutral">Scheduled</Badge>
                    )}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        ) : null}
      </Card>

      {/* ── No reply (expandable): non-responders' names + emails. Hidden until
          there's actually a no-reply list (i.e. after the first batch). ── */}
      {noReplyCount > 0 ? (
      <Card className="mt-4 overflow-hidden">
        <button
          type="button"
          onClick={() => setNoReplyOpen((o) => !o)}
          aria-expanded={noReplyOpen}
          aria-controls="no-reply-panel"
          className="flex w-full items-center justify-between gap-3 px-5 py-3 text-left transition-colors hover:bg-gray-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-blue-500 focus-visible:ring-offset-1"
        >
          <span className="flex items-center gap-2">
            <MailX className="h-4 w-4 text-warning-600" aria-hidden="true" />
            <span className="text-sm font-semibold text-gray-900">No reply</span>
            <Badge variant="warning">
              {noReplyCount.toLocaleString()} to reach out to
            </Badge>
          </span>
          <ChevronDown
            className={cn(
              "h-4 w-4 shrink-0 text-gray-400 transition-transform",
              noReplyOpen && "rotate-180",
            )}
            aria-hidden="true"
          />
        </button>

        {noReplyOpen ? (
          <div id="no-reply-panel" className="border-t border-gray-200">
            <div className="flex flex-wrap items-center justify-between gap-2 px-5 py-2.5">
              <p className="text-xs text-gray-500">
                Reach out manually, or send the follow-up above.
              </p>
              <Button type="button" variant="secondary" size="sm" onClick={copyEmails}>
                <Copy aria-hidden="true" />
                Copy all emails
              </Button>
            </div>
            <ul className="divide-y divide-gray-100 border-t border-gray-200">
              {selected.noReply.map((n) => (
                <li
                  key={n.alumniId}
                  className="flex flex-wrap items-center justify-between gap-x-4 gap-y-0.5 px-5 py-2 text-sm"
                >
                  <span className="font-medium text-gray-900">{n.name}</span>
                  <a
                    href={`mailto:${n.email}`}
                    className="text-brand-blue-600 hover:underline"
                  >
                    {n.email}
                  </a>
                </li>
              ))}
            </ul>
          </div>
        ) : null}
      </Card>
      ) : null}

      {/* ── Admin review queue: real alum submissions to apply/reject ── */}
      <PendingSubmissions gradYear={selected.gradYear} />

      {/* ── Legacy demo change report — only shown for sample-data years ── */}
      {selected.changeRecords.length > 0 ? (
        <>
      <Card className="mt-4">
        <header className="flex flex-wrap items-center justify-between gap-2 border-b border-gray-200 px-5 py-3">
          <h2 className="text-sm font-semibold text-gray-900">Change report</h2>
          <Badge variant="neutral">
            {applyCount.toLocaleString()} to apply
            {rejectedCount > 0
              ? ` · ${rejectedCount.toLocaleString()} rejected`
              : ""}
          </Badge>
        </header>

        <div className="space-y-2 p-3">
          {selected.changeRecords.length === 0 ? (
            <p className="px-2 py-3 text-sm text-gray-500">
              No alumni in this graduation year proposed any changes.
            </p>
          ) : (
            selected.changeRecords.map((rec) => {
              const editing = editingId === rec.alumniId;
              return (
                <div
                  key={rec.alumniId}
                  className={cn(
                    "rounded-md border p-3 transition-colors",
                    rec.rejected
                      ? "border-gray-200 bg-gray-50 opacity-70"
                      : "border-gray-200 bg-white",
                  )}
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex min-w-0 items-center gap-2">
                      <span className="truncate text-sm font-semibold text-gray-900">
                        {rec.name}
                      </span>
                      {rec.rejected ? (
                        <Badge variant="danger">Rejected</Badge>
                      ) : (
                        <span className="shrink-0 text-xs text-gray-400">
                          {rec.changes.length}{" "}
                          {rec.changes.length === 1 ? "change" : "changes"}
                        </span>
                      )}
                    </div>

                    {!selected.submitted ? (
                      <div className="flex shrink-0 items-center gap-1">
                        {rec.rejected ? (
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => toggleReject(rec.alumniId)}
                          >
                            <Undo2 aria-hidden="true" />
                            Undo
                          </Button>
                        ) : (
                          <>
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              onClick={() =>
                                editing ? cancelEdit() : startEdit(rec)
                              }
                            >
                              {editing ? (
                                <>
                                  <X aria-hidden="true" />
                                  Cancel
                                </>
                              ) : (
                                <>
                                  <Pencil aria-hidden="true" />
                                  Change
                                </>
                              )}
                            </Button>
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              className="text-danger-600 hover:bg-danger-50 hover:text-danger-600"
                              onClick={() => toggleReject(rec.alumniId)}
                            >
                              <X aria-hidden="true" />
                              Reject
                            </Button>
                          </>
                        )}
                      </div>
                    ) : null}
                  </div>

                  <ul className="mt-1.5 space-y-1">
                    {rec.changes.map((ch, i) => (
                      <li
                        key={ch.fieldKey}
                        className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm"
                      >
                        <span className="text-xs font-medium text-gray-500">
                          {ch.label}:
                        </span>
                        <span className="text-gray-400 line-through">
                          {ch.before || "—"}
                        </span>
                        <span aria-hidden="true" className="text-gray-400">
                          →
                        </span>
                        {editing ? (
                          <Input
                            aria-label={`New value for ${ch.label}`}
                            value={drafts[i] ?? ch.after}
                            onChange={(e) =>
                              setDrafts((d) => {
                                const next = [...d];
                                next[i] = e.target.value;
                                return next;
                              })
                            }
                            className="h-8 w-auto min-w-[10rem] flex-1"
                          />
                        ) : (
                          <span className="font-medium text-gray-900">
                            {ch.after || "—"}
                          </span>
                        )}
                      </li>
                    ))}
                  </ul>

                  {editing ? (
                    <div className="mt-2 flex justify-end gap-2">
                      <Button
                        type="button"
                        variant="secondary"
                        size="sm"
                        onClick={cancelEdit}
                      >
                        Cancel
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        onClick={() => saveEdit(rec.alumniId)}
                      >
                        <CheckCircle2 aria-hidden="true" />
                        Save
                      </Button>
                    </div>
                  ) : null}
                </div>
              );
            })
          )}

          <p className="px-2 pt-1 text-xs text-gray-400">
            {selected.noChangeCount.toLocaleString()} alumni responded with no
            changes and aren&apos;t listed.
          </p>
        </div>
      </Card>

      {/* ── Submit ── */}
      <Card className="mt-4 p-4">
        {selected.submitted ? (
          <div className="flex items-start gap-2">
            <CheckCircle2
              className="mt-0.5 h-5 w-5 shrink-0 text-success-600"
              aria-hidden="true"
            />
            <p className="text-sm text-gray-700">
              <span className="font-semibold text-gray-900">
                Applied {applyCount.toLocaleString()}{" "}
                {applyCount === 1 ? "change" : "changes"}
              </span>{" "}
              to graduation year {selectedYear} — now in effect. Editing is
              locked.
            </p>
          </div>
        ) : (
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm text-gray-600">
              <span className="font-semibold text-gray-900">
                {applyCount.toLocaleString()}{" "}
                {applyCount === 1 ? "change" : "changes"}
              </span>{" "}
              will be applied to graduation year {selectedYear}
              {rejectedCount > 0
                ? `; ${rejectedCount.toLocaleString()} rejected discarded`
                : ""}
              .
            </p>
            <Button
              type="button"
              variant="navy"
              onClick={() => setSubmitOpen(true)}
              disabled={applyCount === 0}
            >
              <CheckCircle2 aria-hidden="true" />
              Submit changes
            </Button>
          </div>
        )}
      </Card>
        </>
      ) : null}

      {/* Send dialog */}
      <Dialog open={sendOpen} onOpenChange={setSendOpen}>
        <DialogContent
          title={`Send patch ${nextPatchNumber}${
            sendStage === "first" ? " · initial" : " · follow-up"
          } — graduation year ${selectedYear}`}
          description="Emails each recipient their personal survey link."
        >
          <DialogBody className="space-y-4">
            <div className="flex items-start gap-2 rounded-md border border-brand-blue-300/50 bg-brand-blue-50 px-4 py-3 text-sm text-navy-800">
              <MailX className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
              <span>
                {sendStage === "first" ? (
                  <>
                    The initial survey — goes to all{" "}
                    <span className="font-semibold tabular-nums">
                      {selected.patches[0].recipients.toLocaleString()}
                    </span>{" "}
                    alumni in graduation year {selectedYear}.
                  </>
                ) : (
                  <>
                    Goes to the{" "}
                    <span className="font-semibold tabular-nums">
                      {noReplyCount.toLocaleString()}
                    </span>{" "}
                    alumni who haven&apos;t replied yet.
                  </>
                )}
              </span>
            </div>
            <div>
              <Label htmlFor="send-message">Custom message (optional)</Label>
              <Textarea
                id="send-message"
                value={customMessage}
                onChange={(e) => setCustomMessage(e.target.value)}
                placeholder={
                  sendStage === "first"
                    ? "Add a short note to include in the survey email…"
                    : "Add a short note to include in the follow-up…"
                }
                className="mt-1"
              />
            </div>

            {/* Delivery schedule — batched at 100/day: today's batch sends now,
                the rest are scheduled on the following days. */}
            <div className="rounded-md border border-gray-200 bg-gray-50 p-3">
              <p className="text-xs font-semibold text-gray-700">
                Delivery schedule — {DAILY_LIMIT}/day
              </p>
              <ul className="mt-1.5 space-y-1">
                {plan.batches.map((b) => (
                  <li
                    key={b.date}
                    className="flex items-center justify-between text-xs"
                  >
                    <span className={b.sent ? "text-gray-900" : "text-gray-500"}>
                      {b.sent ? "Today · " : ""}
                      {formatDate(b.date)}
                    </span>
                    <span className="flex items-center gap-2">
                      <span className="tabular-nums font-medium text-gray-900">
                        {b.count.toLocaleString()}
                      </span>
                      {b.sent ? (
                        <Badge variant="tag">Sends now</Badge>
                      ) : (
                        <Badge variant="neutral">Scheduled</Badge>
                      )}
                    </span>
                  </li>
                ))}
              </ul>
              {plan.cappedByMonth ? (
                <p className="mt-2 text-xs text-danger-600">
                  Capped at the {MONTHLY_LIMIT.toLocaleString()}/month limit —{" "}
                  {plan.total.toLocaleString()} of{" "}
                  {sendTargetCount.toLocaleString()} scheduled this month.
                </p>
              ) : null}
            </div>
          </DialogBody>
          <DialogFooter>
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={() => setSendOpen(false)}
            >
              Cancel
            </Button>
            <Button
              type="button"
              size="sm"
              onClick={confirmSend}
              disabled={sending}
            >
              <Send aria-hidden="true" />
              {sending
                ? "Sending…"
                : scheduledLater > 0
                  ? `Send ${todayBatch.toLocaleString()} now`
                  : `Send to ${plan.total.toLocaleString()}`}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Submit dialog */}
      <Dialog open={submitOpen} onOpenChange={setSubmitOpen}>
        <DialogContent
          title={`Apply changes — graduation year ${selectedYear}`}
          description="Applies the approved changes to each alum's record."
        >
          <DialogBody className="space-y-3">
            <p className="text-sm text-gray-700">
              You&apos;re about to apply{" "}
              <span className="font-semibold tabular-nums">
                {applyCount.toLocaleString()}
              </span>{" "}
              {applyCount === 1 ? "change" : "changes"} to graduation year{" "}
              {selectedYear}.
              {rejectedCount > 0
                ? ` ${rejectedCount.toLocaleString()} rejected ${
                    rejectedCount === 1 ? "change" : "changes"
                  } will be discarded.`
                : ""}
            </p>
            <p className="text-xs text-gray-400">
              Applying updates each alum&apos;s record and locks further editing
              for this graduation year.
            </p>
          </DialogBody>
          <DialogFooter>
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={() => setSubmitOpen(false)}
            >
              Cancel
            </Button>
            <Button type="button" variant="navy" size="sm" onClick={confirmSubmit}>
              <CheckCircle2 aria-hidden="true" />
              Apply {applyCount.toLocaleString()}{" "}
              {applyCount === 1 ? "change" : "changes"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

/* ------------------------------------------------------------------ ministat -- */

function MiniStat({
  label,
  value,
  sub,
  icon,
}: {
  label: string;
  value: string;
  sub?: string;
  icon?: React.ReactNode;
}) {
  return (
    <div>
      <p className="flex items-center gap-1 text-xs font-medium text-gray-500">
        {icon ? <span className="text-gray-400">{icon}</span> : null}
        {label}
      </p>
      <p className="mt-0.5 text-sm font-semibold text-gray-900">
        {value}
        {sub ? (
          <span className="ml-1 font-normal text-gray-400">{sub}</span>
        ) : null}
      </p>
    </div>
  );
}

/* -------------------------------------------------------------- patch step -- */

/**
 * One patch in the three-send annual stepper: number, label, sent date, and
 * "replied" stats. The next patch to send is highlighted in brand blue.
 */
function PatchStep({
  index,
  patch,
  isNext,
}: {
  index: number;
  patch: SurveyRound;
  isNext: boolean;
}) {
  const { sentDate, recipients, responses } = patch;
  const sent = sentDate !== null;
  const rate =
    recipients > 0 ? Math.round((responses / recipients) * 100) : 0;
  const name =
    patch.label ??
    (index === 0
      ? "Initial"
      : index === 1
        ? "1-week reminder"
        : "2-week reminder");
  return (
    <li
      className={cn(
        "rounded-md border p-2.5",
        isNext
          ? "border-brand-blue-300 bg-brand-blue-50"
          : sent
            ? "border-gray-200 bg-white"
            : "border-dashed border-gray-300 bg-gray-50",
      )}
    >
      <div className="flex items-center justify-between gap-1">
        <span className="inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-navy-800 px-1 text-[11px] font-semibold tabular-nums text-white">
          {index + 1}
        </span>
        {sent ? (
          <Badge variant="success" size="sm">
            Sent
          </Badge>
        ) : isNext ? (
          <Badge variant="tag" size="sm">
            Next
          </Badge>
        ) : (
          <Badge variant="muted" size="sm">
            Pending
          </Badge>
        )}
      </div>
      <p className="mt-1.5 text-xs font-semibold text-gray-900">{name}</p>
      <p className="text-[11px] text-gray-400">
        {sentDate ? formatDate(sentDate) : "Not sent"}
      </p>
      {sent ? (
        <p className="mt-1 text-xs tabular-nums text-gray-700">
          {responses.toLocaleString()}/{recipients.toLocaleString()} replied
          <span className="ml-1 text-gray-400">· {rate}%</span>
        </p>
      ) : (
        <p className="mt-1 text-xs text-gray-400">
          {recipients > 0
            ? `${recipients.toLocaleString()} to target`
            : "targets no-reply set"}
        </p>
      )}
    </li>
  );
}

/* --------------------------------------------------------------- capacity ---- */

/**
 * Resend send capacity — the daily (100) and monthly (3,000) caps shown as two
 * separate remaining-capacity meters so staff can see how much room a send has.
 */
function CapacityMeters({
  dailyLeft,
  monthlyLeft,
}: {
  dailyLeft: number;
  monthlyLeft: number;
}) {
  return (
    <div
      className="flex flex-wrap gap-x-5 gap-y-2"
      title="Resend Free plan: 100 emails/day · 3,000/month"
    >
      <CapacityMeter label="Today" left={dailyLeft} total={DAILY_LIMIT} />
      <CapacityMeter
        label="This month"
        left={monthlyLeft}
        total={MONTHLY_LIMIT}
      />
    </div>
  );
}

function CapacityMeter({
  label,
  left,
  total,
}: {
  label: string;
  left: number;
  total: number;
}) {
  const usedPct = ((total - left) / total) * 100;
  const empty = left === 0;
  const low = left / total <= 0.15;
  return (
    <div className="min-w-[9rem]">
      <div className="flex items-baseline justify-between gap-2 text-xs">
        <span className="font-medium text-gray-500">{label}</span>
        <span
          className={cn(
            "tabular-nums font-semibold",
            empty ? "text-danger-600" : "text-gray-700",
          )}
        >
          {left.toLocaleString()}
          <span className="font-normal text-gray-400">
            /{total.toLocaleString()} left
          </span>
        </span>
      </div>
      <Progress
        value={usedPct}
        className="mt-1 h-1.5"
        barClassName={
          empty
            ? "bg-danger-600"
            : low
              ? "bg-warning-600"
              : "bg-brand-blue-500"
        }
      />
    </div>
  );
}
