"use client";

import { useCallback, useEffect, useState } from "react";
import {
  CalendarClock,
  CalendarPlus,
  Check,
  CheckCircle2,
  ChevronDown,
  History,
  Send,
  Settings2,
  XCircle,
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { useToast } from "@/components/ui/Toast";
import { cn } from "@/lib/utils";
import {
  ApiClientError,
  clientGet,
  clientPost,
  clientPostJson,
} from "@/lib/api-client";
import { PendingSubmissions } from "@/components/needs-surveying/PendingSubmissions";
import { CampaignProgressTable } from "@/components/needs-surveying/CampaignProgressTable";
import type { components } from "@/types/api.gen";

/** Distinct graduation years present in the DB, straight off the OpenAPI. */
type GradYearCount = components["schemas"]["GraduationYearCount"];
/** The send endpoint's result, straight off the OpenAPI. */
type SurveySendResult = components["schemas"]["SurveySendResult"];
/** Real send usage (emails sent today / this month) for the daily/monthly tallies. */
type SurveyUsage = components["schemas"]["SurveyUsage"];
/** One graduation year's auto-send schedule + per-stage sent counts. */
type SurveyScheduleItem = components["schemas"]["SurveyScheduleItem"];
/** Body for creating/replacing a year's schedule. */
type SurveyScheduleCreateRequest =
  components["schemas"]["SurveyScheduleCreateRequest"];
/**
 * Account-wide send-cap config from GET/POST `/survey/send-config`. Not in the
 * OpenAPI yet (backend feature landing in parallel), so typed locally. When
 * `enabled` is false the cap is off — sends are limited only by Resend itself.
 */
type SurveySendConfig = {
  enabled: boolean;
  daily_limit: number;
  monthly_limit: number;
};

/**
 * Who a year's survey reaches, and who it does not (#392). From
 * GET `/survey/campaigns/{year}/recipients`. Not in the OpenAPI yet (the
 * backend change lands in parallel), so typed locally like `SurveySendConfig`
 * above — regenerate `api.gen.ts` once the API is on dev and delete this.
 *
 * The buckets partition the cohort:
 *   cohort_total = suppressed + already_responded + unreachable + eligible
 *   recipients   = eligible - duplicate_emails
 *
 * `suppressed` (Deceased / Do Not Contact) and `unreachable` (no usable
 * address) are deliberately separate and must NOT be summed in the UI. One is a
 * decision to honour, the other a gap to close.
 */
type SurveyRecipientBreakdown = {
  graduation_year: number;
  cohort_total: number;
  suppressed: number;
  already_responded: number;
  unreachable: number;
  eligible: number;
  duplicate_emails: number;
  recipients: number;
  work_email_fallback: number;
};

/** One alumnus the campaign cannot email, from `/campaigns/{year}/unreachable`. */
type SurveyUnreachableAlum = {
  alumni_id: number;
  name: string;
  reason: string;
  reason_label: string;
  personal_email: string | null;
  work_email: string | null;
};

/**
 * The send result plus the fields #392 and #405 added. Spelled out here rather
 * than regenerating `api.gen.ts` by hand; all optional so this stays correct
 * against an API that has not yet deployed the change.
 */
type SendResult = SurveySendResult & {
  stage_complete?: boolean;
  breakdown?: SurveyRecipientBreakdown | null;
  /**
   * The send had to start this year's campaign because there wasn't one (#405).
   *
   * A manual send used to write only send-log rows, and the campaign is what
   * drives the day 0 / +7 / +14 reminders — so the initial went out, both
   * reminders silently never did, and the console listed no campaign for the
   * year. The backend now leaves one behind; this is what lets the toast say so
   * rather than leaving the operator to notice a new row appear.
   */
  campaign_created?: boolean;
};

/**
 * The sentence appended to the send toast when the send started the campaign.
 *
 * Worth saying out loud on both outcomes. On a successful send it names a
 * consequence the operator did not explicitly ask for (two reminders are now
 * scheduled). On a ZERO send it is the entire point of what just happened —
 * every recipient was already emailed by an earlier send that left no campaign,
 * and this call is what repaired it — so an unqualified "no emails sent" would
 * report that as a failure.
 */
export function campaignCreatedNote(result: SendResult, year: number): string {
  if (!result.campaign_created) return "";
  return ` A campaign for ${year} was started so the reminders go out; it is now listed under Schedule & send.`;
}

/**
 * Send re-surveys BY GRADUATION YEAR — the campaign console on the Needs
 * Surveying tab. Driven entirely by real backend data (no mock/prototype state):
 *
 *   • GET /survey/graduation-years — the DB's classes, each with a total-alumni
 *     count and how many distinct alumni have replied in the last year.
 *   • GET /survey/usage — real Resend usage (emails sent today / this month).
 *   • GET /survey/schedules — each year's auto-send schedule + per-stage counts.
 *   • POST /survey/campaigns/{year}/send — a manual "send now" (Resend enforces
 *     the daily cap server-side).
 *   • POST /survey/schedules + POST /survey/schedules/{year}/cancel — create /
 *     replace / cancel the auto-send schedule for a year.
 *
 * Layout: an account card (Resend usage + caps) and the graduation-year picker
 * stay pinned at the top as shared context, then two tabs — "Schedule & send"
 * (a single box: the year's overview + status badge with the per-year schedule
 * control on the right, per-stage sent counts, and manual send) and
 * "Submissions" (the admin review queue) — so the console isn't one long scroll.
 * The bulk "schedule all years" dialog lives in the page header
 * (`SurveyBulkScheduler`), not here.
 */

// Fallback send caps used only until GET /survey/send-config resolves (and if
// it ever fails). The live caps come from that endpoint and are staff-editable.
const DEFAULT_DAILY_LIMIT = 100;
const DEFAULT_MONTHLY_LIMIT = 3000;

/** Today as an ISO `YYYY-MM-DD` (local, no tz drift) — the min for scheduling. */
function todayIso(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/** Format an ISO `YYYY-MM-DD` as e.g. "Mar 3, 2026" (no timezone drift). */
function formatDate(iso: string): string {
  if (!iso) return "Not scheduled";
  return new Date(`${iso}T00:00:00`).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

/** Format a full timestamp (e.g. `last_run_at`) as e.g. "Mar 3, 2026". */
function formatWhen(iso: string | null): string {
  if (!iso) return "Never";
  const d = new Date(iso);
  return Number.isNaN(d.getTime())
    ? "Never"
    : d.toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
      });
}

/**
 * Why a send emailed nobody (#392).
 *
 * The old message blamed a missing personal email for EVERY zero-send,
 * whatever the cause. That is the bug Jake reported: his cohort had personal
 * emails on file and had simply all replied inside the 365-day re-survey
 * window, but the console told him they had no addresses. A wrong diagnosis
 * sends staff chasing data that is already correct.
 *
 * Ordered most-specific first, so the reason given is the one that actually
 * stopped the send rather than the first bucket that happens to be non-zero.
 */
export function zeroSendReason(result: SendResult): string {
  const b = result.breakdown;
  if (result.stage_complete) {
    return "everyone eligible has already received every email in this campaign.";
  }
  if (!b) {
    return `${result.total_recipients.toLocaleString()} recipient${
      result.total_recipients === 1 ? "" : "s"
    } were found, but none were due this send.`;
  }
  if (b.cohort_total === 0) return "there are no alumni in this graduation year.";
  if (b.recipients > 0) {
    // People were available; something downstream stopped the send (the daily
    // cap, or a stage everyone has already had).
    return `${b.recipients.toLocaleString()} can be emailed, but none were due — check today's send cap.`;
  }
  const parts: string[] = [];
  if (b.already_responded > 0) {
    parts.push(
      `${b.already_responded.toLocaleString()} already replied within the last year`,
    );
  }
  if (b.unreachable > 0) {
    parts.push(
      `${b.unreachable.toLocaleString()} have no usable email address`,
    );
  }
  if (b.suppressed > 0) {
    parts.push(
      `${b.suppressed.toLocaleString()} are marked Deceased or Do Not Contact`,
    );
  }
  if (b.duplicate_emails > 0) {
    parts.push(
      `${b.duplicate_emails.toLocaleString()} share an address with another recipient`,
    );
  }
  if (parts.length === 0) return "nobody in this year is due for the survey.";
  return `${parts.join("; ")}.`;
}

export function SurveyCampaignConsole() {
  const { toast } = useToast();

  // Real database graduation years (null while loading, [] when the DB has none).
  const [years, setYears] = useState<GradYearCount[] | null>(null);
  // Real auto-send schedules, keyed by graduation year (null while loading).
  const [schedules, setSchedules] = useState<SurveyScheduleItem[] | null>(null);
  const [selectedYear, setSelectedYear] = useState<number | null>(null);

  // Which tab is showing — "schedule" (Schedule & send, the default) or
  // "submissions" (the review queue). Both tabs act on the selected year.
  const [activeTab, setActiveTab] = useState("schedule");

  // Real Resend usage against the caps — emails actually sent today / this
  // calendar month, from GET /survey/usage. 0 until the fetch resolves.
  const [sentToday, setSentToday] = useState(0);
  const [sentThisMonth, setSentThisMonth] = useState(0);

  // Account-wide send-cap config from GET /survey/send-config (null while
  // loading). Drives the capacity meters, caption, and send-dialog copy.
  const [sendConfig, setSendConfig] = useState<SurveySendConfig | null>(null);

  const [sendOpen, setSendOpen] = useState(false);
  const [sending, setSending] = useState(false);

  // Who the selected year's survey reaches and who it cannot (#392). Null while
  // loading or if the fetch fails — never substituted with a local estimate.
  const [breakdown, setBreakdown] = useState<SurveyRecipientBreakdown | null>(
    null,
  );
  // The unreachable drill-down: the count is actionable only with names behind
  // it. Fetched lazily, on expand.
  const [unreachableOpen, setUnreachableOpen] = useState(false);
  const [unreachable, setUnreachable] = useState<
    SurveyUnreachableAlum[] | null
  >(null);

  // "Edit caps" dialog — draft values, prefilled from sendConfig on open.
  const [capsOpen, setCapsOpen] = useState(false);
  const [savingCaps, setSavingCaps] = useState(false);
  const [capEnabledDraft, setCapEnabledDraft] = useState(true);
  const [dailyDraft, setDailyDraft] = useState(DEFAULT_DAILY_LIMIT);
  const [monthlyDraft, setMonthlyDraft] = useState(DEFAULT_MONTHLY_LIMIT);

  // Schedule form for the selected year.
  const [scheduleDate, setScheduleDate] = useState("");
  const [scheduling, setScheduling] = useState(false);
  const [cancelling, setCancelling] = useState(false);

  // Real send usage (today / this month). Refetched after each send so the
  // numbers reflect what actually went out.
  const loadUsage = useCallback(() => {
    clientGet<SurveyUsage>("/survey/usage")
      .then((u) => {
        if (!u) return;
        setSentToday(u.sent_today);
        setSentThisMonth(u.sent_this_month);
      })
      .catch(() => {
        /* keep the last-known tallies if the usage fetch fails */
      });
  }, []);

  // Real auto-send schedules (per-year start date, status, per-stage counts).
  const loadSchedules = useCallback(() => {
    clientGet<SurveyScheduleItem[]>("/survey/schedules")
      .then((s) => setSchedules(s ?? []))
      .catch(() => setSchedules([]));
  }, []);

  // Account-wide send-cap config. Keeps the last-known config if the fetch fails.
  const loadConfig = useCallback(() => {
    clientGet<SurveySendConfig>("/survey/send-config")
      .then((c) => {
        if (c) setSendConfig(c);
      })
      .catch(() => {
        /* keep the last-known config if the fetch fails */
      });
  }, []);

  // Populate the year picker from the REAL database graduation years, load the
  // real usage tallies, and load the real schedules — all on mount.
  useEffect(() => {
    let cancelled = false;
    loadUsage();
    loadSchedules();
    loadConfig();
    clientGet<GradYearCount[]>("/survey/graduation-years")
      .then((data) => {
        if (cancelled) return;
        const list = data ?? [];
        setYears(list);
        setSelectedYear((cur) =>
          cur !== null && list.some((y) => y.graduation_year === cur)
            ? cur
            : (list[0]?.graduation_year ?? null),
        );
      })
      .catch(() => {
        if (!cancelled) setYears([]);
      });
    // Stay in sync with the bulk "Schedule all years" dialog (and any other
    // surface): re-fetch schedules whenever one is created/cancelled elsewhere.
    const onSchedulesChanged = () => loadSchedules();
    if (typeof window !== "undefined") {
      window.addEventListener("survey:schedules-changed", onSchedulesChanged);
    }
    return () => {
      cancelled = true;
      if (typeof window !== "undefined") {
        window.removeEventListener(
          "survey:schedules-changed",
          onSchedulesChanged,
        );
      }
    };
  }, [loadUsage, loadSchedules, loadConfig]);

  const selected =
    years?.find((y) => y.graduation_year === selectedYear) ?? null;
  // Only a RUNNABLE schedule (scheduled/active) counts as "this year is
  // scheduled". A cancelled/completed row is treated as no schedule, so the
  // control clears (blank date, "Schedule" not "Reschedule", no Cancel button)
  // and a cancelled year can't look — or be silently re-created as — live.
  const selectedSchedule =
    schedules?.find(
      (s) =>
        s.graduation_year === selectedYear &&
        (s.status === "scheduled" || s.status === "active"),
    ) ?? null;

  // Prefill the per-year date input from the selected year's existing schedule
  // (set individually OR via the bulk "all years" dialog), or clear it when the
  // year has no schedule. Runs whenever the selected year's schedule date
  // changes — i.e. on year change or when the loaded schedules refresh.
  const selectedStartDate = selectedSchedule?.start_date ?? "";
  useEffect(() => {
    setScheduleDate(selectedStartDate);
  }, [selectedStartDate]);

  // Effective caps for display + math. Until the config loads, fall back to the
  // previous defaults; when the cap is disabled, the limits are effectively
  // unlimited (Resend is the only ceiling), so the meters/preview show "No cap".
  const capEnabled = sendConfig ? sendConfig.enabled : true;
  const dailyLimit = capEnabled
    ? (sendConfig?.daily_limit ?? DEFAULT_DAILY_LIMIT)
    : Infinity;
  const monthlyLimit = capEnabled
    ? (sendConfig?.monthly_limit ?? DEFAULT_MONTHLY_LIMIT)
    : Infinity;

  const dailyLeft = Math.max(0, dailyLimit - sentToday);
  const monthlyLeft = Math.max(0, monthlyLimit - sentThisMonth);

  // How many a send would ACTUALLY email, from the backend (#392).
  //
  // This used to be `total_alumni - responded`, computed here. That arithmetic
  // knew nothing about suppression, alumni with no usable address, or the
  // shared-address dedupe, so the button promised a number the send could not
  // deliver — on dev it read 228 where the sender would send 2. The backend now
  // owns the figure and the send reports the same one back, so the two cannot
  // disagree. `null` until it loads; fall back to nothing rather than to a
  // guess, because a wrong number here is exactly the bug.
  const recipientCount = breakdown?.recipients ?? null;
  const canSend = recipientCount !== null && recipientCount > 0;

  // The real recipient breakdown for the selected year. Refetched on year
  // change and after every send, so the console never shows a figure that
  // predates what just went out.
  const loadBreakdown = useCallback((year: number | null) => {
    if (year === null) {
      setBreakdown(null);
      return;
    }
    clientGet<SurveyRecipientBreakdown>(`/survey/campaigns/${year}/recipients`)
      .then((b) => setBreakdown(b ?? null))
      .catch(() => setBreakdown(null));
  }, []);

  useEffect(() => {
    // Clear first so a stale year's numbers can never be read as this year's.
    setBreakdown(null);
    setUnreachable(null);
    setUnreachableOpen(false);
    loadBreakdown(selectedYear);
  }, [selectedYear, loadBreakdown]);

  // The unreachable names, fetched lazily when staff expand the list.
  const toggleUnreachable = () => {
    const opening = !unreachableOpen;
    setUnreachableOpen(opening);
    if (opening && unreachable === null && selectedYear !== null) {
      clientGet<SurveyUnreachableAlum[]>(
        `/survey/campaigns/${selectedYear}/unreachable`,
      )
        .then((list) => setUnreachable(list ?? []))
        .catch(() => setUnreachable([]));
    }
  };

  const changeSelectedYear = (year: number) => {
    // The auto-fill effect prefills the date input from this year's schedule.
    setSelectedYear(year);
  };

  const confirmSend = async () => {
    if (selectedYear === null || sending) return;
    setSending(true);
    try {
      const result = await clientPost<SendResult>(
        `/survey/campaigns/${selectedYear}/send?dry_run=false`,
      );
      // Refetch the real usage + schedules now that a batch went out, and the
      // breakdown so the on-screen count matches what just happened.
      loadUsage();
      loadSchedules();
      loadBreakdown(selectedYear);
      if (result.breakdown) setBreakdown(result.breakdown);
      setSendOpen(false);

      if (result.sent > 0) {
        toast.success(
          `Sent ${result.sent.toLocaleString()} survey email${
            result.sent === 1 ? "" : "s"
          } for graduation year ${selectedYear}` +
            (result.remaining > 0
              ? ` — ${result.remaining.toLocaleString()} over today's cap; run Send again to continue.`
              : ".") +
            campaignCreatedNote(result, selectedYear),
        );
      } else if (result.campaign_created) {
        // Nothing new went out because this year had already been emailed by a
        // send that left no campaign behind — and that is exactly what this call
        // just fixed. Reporting it as a plain failure would hide the repair.
        toast.success(
          `No new emails were needed for ${selectedYear}: ${zeroSendReason(result)}` +
            campaignCreatedNote(result, selectedYear),
        );
      } else {
        toast.error(`No emails sent for ${selectedYear}: ${zeroSendReason(result)}`);
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

  const submitSchedule = async () => {
    if (selectedYear === null || !scheduleDate || scheduling) return;
    setScheduling(true);
    try {
      const body: SurveyScheduleCreateRequest = {
        graduation_year: selectedYear,
        start_date: scheduleDate,
      };
      await clientPostJson<SurveyScheduleItem>("/survey/schedules", body);
      loadSchedules();
      // Keep the bulk scheduler (and any other surface) in sync.
      if (typeof window !== "undefined") {
        window.dispatchEvent(new Event("survey:schedules-changed"));
      }
      toast.success(
        `Scheduled graduation year ${selectedYear} to auto-send on ${formatDate(
          scheduleDate,
        )}.`,
      );
    } catch (err) {
      const msg =
        err instanceof ApiClientError && err.message
          ? err.message
          : "the request failed.";
      toast.error(`Couldn't schedule: ${msg}`);
    } finally {
      setScheduling(false);
    }
  };

  const cancelSchedule = async () => {
    if (selectedYear === null || cancelling) return;
    setCancelling(true);
    try {
      await clientPost(`/survey/schedules/${selectedYear}/cancel`);
      loadSchedules();
      // Keep the bulk scheduler (and any other surface) in sync.
      if (typeof window !== "undefined") {
        window.dispatchEvent(new Event("survey:schedules-changed"));
      }
      toast.success(`Cancelled the schedule for graduation year ${selectedYear}.`);
    } catch (err) {
      const msg =
        err instanceof ApiClientError && err.message
          ? err.message
          : "the request failed.";
      toast.error(`Couldn't cancel: ${msg}`);
    } finally {
      setCancelling(false);
    }
  };

  // Open the "Edit caps" dialog, prefilling the drafts from the live config.
  const openCaps = () => {
    setCapEnabledDraft(sendConfig?.enabled ?? true);
    setDailyDraft(sendConfig?.daily_limit ?? DEFAULT_DAILY_LIMIT);
    setMonthlyDraft(sendConfig?.monthly_limit ?? DEFAULT_MONTHLY_LIMIT);
    setCapsOpen(true);
  };

  const saveCaps = async () => {
    if (savingCaps) return;
    setSavingCaps(true);
    try {
      const body: SurveySendConfig = {
        enabled: capEnabledDraft,
        daily_limit: Math.max(0, Math.trunc(dailyDraft) || 0),
        monthly_limit: Math.max(0, Math.trunc(monthlyDraft) || 0),
      };
      const updated = await clientPostJson<SurveySendConfig>(
        "/survey/send-config",
        body,
      );
      setSendConfig(updated ?? body);
      setCapsOpen(false);
      toast.success(
        capEnabledDraft
          ? `Send cap updated — ${body.daily_limit.toLocaleString()}/day, ${body.monthly_limit.toLocaleString()}/month.`
          : "Send cap turned off — sends are now limited only by Resend.",
      );
    } catch (err) {
      const msg =
        err instanceof ApiClientError && err.message
          ? err.message
          : "the request failed.";
      toast.error(`Couldn't update send caps: ${msg}`);
    } finally {
      setSavingCaps(false);
    }
  };

  return (
    <>
      {/* ── Account usage + Resend send caps — for the WHOLE account, across
          every graduation year (not the selected year). ── */}
      <Card className="p-5">
        <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">
              Sent this month
            </p>
            <p className="text-3xl font-semibold tabular-nums tracking-tight text-navy-800">
              {sentThisMonth.toLocaleString()}
            </p>
            <p className="text-xs text-gray-400">
              survey emails across the whole account, all graduation years
            </p>
          </div>
          <CapacityMeters
            enabled={capEnabled}
            dailyLeft={dailyLeft}
            dailyTotal={dailyLimit}
            monthlyLeft={monthlyLeft}
            monthlyTotal={monthlyLimit}
          />
        </div>
        <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-gray-200 pt-3">
          <p className="text-xs text-gray-400">
            {capEnabled
              ? `Send limits are account-wide across every graduation year — ${dailyLimit.toLocaleString()} emails per day, ${monthlyLimit.toLocaleString()} per month.`
              : "No send cap — sends are limited only by Resend."}
          </p>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={openCaps}
          >
            <Settings2 aria-hidden="true" />
            Edit caps
          </Button>
        </div>
      </Card>

      {/* ── Graduation-year picker — pinned above the tabs; the selected year
          drives both tabs. Also carries the load/empty/select states. ── */}
      <Card className="mt-4 p-5">
        {years === null ? (
          <p className="py-6 text-sm text-gray-500">Loading graduation years…</p>
        ) : years.length === 0 ? (
          <p className="py-6 text-sm text-gray-500">
            No graduation years found in the database yet.
          </p>
        ) : (
          <div className="min-w-[13rem]">
            <Label htmlFor="grad-year">Graduation year</Label>
            {/* Radix dropdown (not a native <select>) so we can FORCE the menu
                to open downward — a native select's open direction is
                browser-controlled and can't be pinned. */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  id="grad-year"
                  type="button"
                  className={cn(
                    "mt-1 flex h-11 w-full items-center justify-between rounded-md border border-gray-300 bg-white px-3 text-base text-gray-900 md:h-9 md:text-sm",
                    "focus-visible:border-brand-blue-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-blue-500 focus-visible:ring-offset-1",
                  )}
                >
                  <span className={cn(selectedYear === null && "text-gray-400")}>
                    {selectedYear ?? "Select a year"}
                  </span>
                  <ChevronDown
                    className="ml-2 h-4 w-4 shrink-0 text-gray-400"
                    aria-hidden="true"
                  />
                </button>
              </DropdownMenuTrigger>
              {/* Pinned downward: side/align/sideOffset + avoidCollisions={false}
                  so Radix never flips it up. Scrolls internally when a class has
                  many years. Width tracks the trigger. */}
              <DropdownMenuContent
                side="bottom"
                align="start"
                sideOffset={4}
                avoidCollisions={false}
                className="max-h-72 w-[var(--radix-dropdown-menu-trigger-width)] overflow-y-auto"
              >
                {years.map((y) => (
                  <DropdownMenuItem
                    key={y.graduation_year}
                    className="justify-between"
                    onSelect={() => changeSelectedYear(y.graduation_year)}
                  >
                    {y.graduation_year}
                    {y.graduation_year === selectedYear ? (
                      <Check
                        className="h-4 w-4 text-brand-blue-600"
                        aria-hidden="true"
                      />
                    ) : null}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
            {selected ? (
              <p className="mt-1 flex flex-wrap items-center gap-2 text-xs text-gray-500">
                {selected.total_alumni.toLocaleString()} alumni graduated this
                year
                <Badge variant="tag">
                  {selected.responded.toLocaleString()} replied
                </Badge>
              </p>
            ) : (
              <p className="mt-1 text-xs text-gray-500">
                Select a graduation year to get started.
              </p>
            )}
          </div>
        )}
      </Card>

      {/* ── Tabs: keep the console from being one long scroll. Both tabs act on
          the selected year, so they only render once a year is chosen. ── */}
      {selected !== null ? (
        <Tabs
          value={activeTab}
          onValueChange={setActiveTab}
          className="mt-4 w-full"
        >
          {/* `overflow-y-hidden` alongside `overflow-x-auto` prevents a stray
              vertical scrollbar on the tab strip (same fix as #530). */}
          <TabsList className="w-full overflow-x-auto overflow-y-hidden">
            <TabsTrigger value="schedule">Schedule &amp; send</TabsTrigger>
            <TabsTrigger value="submissions">Submissions</TabsTrigger>
            <TabsTrigger value="progress">Progress</TabsTrigger>
          </TabsList>

          {/* ── Tab 1: a SINGLE box — the year's overview + status badge with
              the per-year schedule control on the right, per-stage counts, and
              the manual "Send now". ── */}
          <TabsContent value="schedule">
            <Card className="p-5">
              {/* Top: the "Last auto-send" stat on the LEFT, the per-year
                  schedule control (date + Schedule/Reschedule + status badge +
                  Cancel) filling the SCHEDULE slot on the RIGHT. */}
              <div className="flex flex-col gap-4 lg:flex-row lg:items-start">
                <div className="lg:flex-1 lg:pr-5">
                  <MiniStat
                    icon={<History className="h-4 w-4" aria-hidden="true" />}
                    label="Last auto-send"
                    value={formatWhen(selectedSchedule?.last_run_at ?? null)}
                  />
                  {/* Reply tally for the selected class — replied vs. the class
                      total, with the not-yet-replied count. */}
                  <div className="mt-3">
                    <MiniStat
                      icon={
                        <CheckCircle2 className="h-4 w-4" aria-hidden="true" />
                      }
                      label="Replies"
                      value={
                        selected
                          ? `${selected.responded.toLocaleString()} of ${selected.total_alumni.toLocaleString()} replied`
                          : "—"
                      }
                      sub={
                        recipientCount !== null
                          ? `${recipientCount.toLocaleString()} can be emailed`
                          : undefined
                      }
                    />
                  </div>
                </div>

                {/* SCHEDULE slot — the per-year schedule control (top-right of
                    the box), replacing the old "Schedule status" stat. Equal
                    width with the left column so the divider sits centered. Its
                    label matches the "Last auto-send" stat's label style. */}
                <div className="lg:flex-1 lg:border-l lg:border-gray-200 lg:pl-5">
                  <Label
                    htmlFor="schedule-date"
                    className="flex items-center gap-1 text-xs font-medium text-gray-500"
                  >
                    <span className="text-gray-400">
                      <CalendarClock className="h-4 w-4" aria-hidden="true" />
                    </span>
                    Schedule
                  </Label>
                  <div className="mt-1 flex flex-wrap items-center gap-2">
                    <Input
                      id="schedule-date"
                      type="date"
                      min={todayIso()}
                      value={scheduleDate}
                      onChange={(e) => setScheduleDate(e.target.value)}
                      className="w-[10.5rem]"
                    />
                    <Button
                      type="button"
                      size="sm"
                      onClick={submitSchedule}
                      disabled={!scheduleDate || scheduling}
                    >
                      <CalendarPlus aria-hidden="true" />
                      {scheduling
                        ? "Scheduling…"
                        : selectedSchedule
                          ? "Reschedule"
                          : "Schedule"}
                    </Button>
                    {selectedSchedule &&
                    selectedSchedule.status !== "cancelled" &&
                    selectedSchedule.status !== "completed" ? (
                      <Button
                        type="button"
                        variant="secondary"
                        size="sm"
                        onClick={cancelSchedule}
                        disabled={cancelling}
                      >
                        <XCircle aria-hidden="true" />
                        {cancelling ? "Cancelling…" : "Cancel schedule"}
                      </Button>
                    ) : null}
                  </div>
                  <p className="mt-2 text-xs text-gray-400">
                    On the chosen date, the survey automatically sends to the{" "}
                    {selectedYear !== null
                      ? `Class of ${selectedYear}`
                      : "selected class"}
                    , then follows up with anyone who hasn&apos;t replied after 1
                    and 2 weeks.
                  </p>
                </div>
              </div>

              {/* Per-stage sent counts from the real schedule (0s if none yet). */}
              <div className="mt-4 border-t border-gray-200 pt-4">
                <p className="text-xs font-medium text-gray-500">
                  Emails sent — initial, then 1-week &amp; 2-week reminders to
                  non-responders
                </p>
                <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-3">
                  <StageStat
                    label="Initial"
                    count={selectedSchedule?.sent_initial ?? 0}
                  />
                  <StageStat
                    label="1-week reminder"
                    count={selectedSchedule?.sent_reminder_1 ?? 0}
                  />
                  <StageStat
                    label="2-week reminder"
                    count={selectedSchedule?.sent_reminder_2 ?? 0}
                  />
                </div>
              </div>

              {/* ── Cannot be reached (#392) ──────────────────────────────
                  Alumni this campaign wants to email and can't, because there
                  is no usable address on either column. Before this they were
                  simply absent: a campaign reaching 180 of 200 looked identical
                  to one reaching all 180 it had.

                  Deliberately NOT merged with suppression. Deceased / Do Not
                  Contact alumni are excluded from this list by the backend —
                  they are a decision to honour, not a gap to close, and listing
                  them here would read as an instruction to go find their
                  address. The suppressed figure is shown separately below.

                  Text-only: no icons in new UI. */}
              {breakdown && breakdown.unreachable > 0 ? (
                <div className="mt-4 rounded-md border border-amber-300 bg-amber-50 px-4 py-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="text-sm font-medium text-navy-800">
                      Cannot be reached —{" "}
                      <span className="tabular-nums">
                        {breakdown.unreachable.toLocaleString()}
                      </span>{" "}
                      {breakdown.unreachable === 1 ? "alumnus" : "alumni"} with
                      no usable email address
                    </p>
                    <Button
                      type="button"
                      variant="secondary"
                      size="sm"
                      onClick={toggleUnreachable}
                    >
                      {unreachableOpen ? "Hide list" : "Show list"}
                    </Button>
                  </div>
                  <p className="mt-1 text-xs text-gray-500">
                    They are not counted as recipients and no email is attempted.
                    Add an address to bring them into the next send.
                  </p>
                  {unreachableOpen ? (
                    unreachable === null ? (
                      <p className="mt-3 text-xs text-gray-500">Loading…</p>
                    ) : unreachable.length === 0 ? (
                      <p className="mt-3 text-xs text-gray-500">
                        Nobody to show.
                      </p>
                    ) : (
                      <ul className="mt-3 divide-y divide-amber-200 border-t border-amber-200">
                        {unreachable.map((a) => (
                          <li
                            key={a.alumni_id}
                            className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 py-2"
                          >
                            <a
                              href={`/alumni/${a.alumni_id}`}
                              className="text-sm font-medium text-navy-800 underline underline-offset-2"
                            >
                              {a.name}
                            </a>
                            <span className="text-xs text-gray-600">
                              {a.reason_label}
                              {/* Show the offending value so a typo can be
                                  fixed on sight rather than chased. */}
                              {a.personal_email || a.work_email ? (
                                <span className="ml-1 text-gray-400">
                                  ({a.personal_email || a.work_email})
                                </span>
                              ) : null}
                            </span>
                          </li>
                        ))}
                      </ul>
                    )
                  ) : null}
                </div>
              ) : null}

              {/* Suppressed is its own line, never folded into the count above:
                  never-email-them and can't-email-them are different states. */}
              {breakdown && breakdown.suppressed > 0 ? (
                <p className="mt-2 text-xs text-gray-500">
                  {breakdown.suppressed.toLocaleString()} more{" "}
                  {breakdown.suppressed === 1 ? "alumnus is" : "alumni are"}{" "}
                  marked Deceased or Do Not Contact and are never emailed. This
                  is separate from the alumni above — no action needed.
                </p>
              ) : null}

              <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
                <span className="text-xs text-gray-400">
                  Each recipient gets an email with their personal survey link.
                </span>
                <Button
                  type="button"
                  size="sm"
                  onClick={() => setSendOpen(true)}
                  disabled={!canSend}
                >
                  <Send aria-hidden="true" />
                  {recipientCount === null
                    ? "Send now"
                    : `Send now (${recipientCount.toLocaleString()})`}
                </Button>
              </div>
            </Card>
          </TabsContent>

          {/* ── Tab 2: admin review queue — real alum submissions to apply/reject.
              Keeps its own "N to review" badge inside the panel. ── */}
          <TabsContent value="submissions">
            <PendingSubmissions gradYear={selected.graduation_year} />
          </TabsContent>

          {/* ── Tab 3: every graduation year at once (#543). The ONE panel here
              that is not about the selected year — it is the overview you check
              before deciding which year to work on. Reads the schedules already
              fetched for the picker, so opening this tab costs no request. ── */}
          <TabsContent value="progress">
            <CampaignProgressTable schedules={schedules} />
          </TabsContent>
        </Tabs>
      ) : null}

      {/* Send dialog */}
      <Dialog open={sendOpen} onOpenChange={setSendOpen}>
        <DialogContent
          title={`Send survey — graduation year ${selectedYear ?? ""}`}
          description="Emails each recipient their personal survey link."
        >
          <DialogBody className="space-y-4">
            <div className="flex items-start gap-2 rounded-md border border-brand-blue-300/50 bg-brand-blue-50 px-4 py-3 text-sm text-navy-800">
              <Send className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
              <span>
                Goes to the{" "}
                <span className="font-semibold tabular-nums">
                  {(recipientCount ?? 0).toLocaleString()}
                </span>{" "}
                alumni in graduation year {selectedYear} who haven&apos;t replied
                this cycle and have an email we can send to — their personal
                address, or their work address when there is no personal one.{" "}
                {breakdown && breakdown.work_email_fallback > 0
                  ? `${breakdown.work_email_fallback.toLocaleString()} will be reached at a work address. `
                  : ""}
                {breakdown && breakdown.unreachable > 0
                  ? `${breakdown.unreachable.toLocaleString()} cannot be reached at all and are listed under "Cannot be reached". `
                  : ""}
                {capEnabled
                  ? `Sends are capped at ${dailyLimit.toLocaleString()}/day — rerun to continue if there's a remainder; everything goes out in a single same-day batch when it fits.`
                  : "No send cap — everything goes out in a single same-day batch, limited only by Resend."}
              </span>
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
              {sending ? "Sending…" : "Send now"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit send caps dialog */}
      <Dialog open={capsOpen} onOpenChange={setCapsOpen}>
        <DialogContent
          title="Edit send caps"
          description="Account-wide daily & monthly limits across every graduation year."
        >
          <DialogBody className="space-y-4">
            <label className="flex cursor-pointer items-start gap-2 text-sm text-gray-700">
              <input
                type="checkbox"
                checked={capEnabledDraft}
                onChange={(e) => setCapEnabledDraft(e.target.checked)}
                className="mt-0.5 h-4 w-4 rounded border-gray-300 text-brand-blue-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-blue-500 focus-visible:ring-offset-1"
              />
              <span>
                <span className="font-medium text-gray-900">
                  Enforce daily &amp; monthly send cap
                </span>
                <span className="mt-0.5 block text-xs text-gray-400">
                  Turn this off if you upgrade your Resend plan — sends will then
                  be limited only by Resend.
                </span>
              </span>
            </label>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <Label htmlFor="caps-daily">Daily limit</Label>
                <Input
                  id="caps-daily"
                  type="number"
                  min={0}
                  value={dailyDraft}
                  disabled={!capEnabledDraft}
                  onChange={(e) => setDailyDraft(e.target.valueAsNumber || 0)}
                  className="mt-1"
                />
              </div>
              <div>
                <Label htmlFor="caps-monthly">Monthly limit</Label>
                <Input
                  id="caps-monthly"
                  type="number"
                  min={0}
                  value={monthlyDraft}
                  disabled={!capEnabledDraft}
                  onChange={(e) => setMonthlyDraft(e.target.valueAsNumber || 0)}
                  className="mt-1"
                />
              </div>
            </div>
          </DialogBody>
          <DialogFooter>
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={() => setCapsOpen(false)}
            >
              Cancel
            </Button>
            <Button
              type="button"
              size="sm"
              onClick={saveCaps}
              disabled={savingCaps}
            >
              {savingCaps ? "Saving…" : "Save"}
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

/* -------------------------------------------------------------- stage stat -- */

/** One stage's real sent count in the three-send annual cadence. */
function StageStat({ label, count }: { label: string; count: number }) {
  const sent = count > 0;
  return (
    <div
      className={cn(
        "rounded-md border p-2.5",
        sent ? "border-gray-200 bg-white" : "border-dashed border-gray-300 bg-gray-50",
      )}
    >
      <p className="text-xs font-semibold text-gray-900">{label}</p>
      <p className="mt-1 text-xs tabular-nums text-gray-700">
        {count.toLocaleString()} sent
      </p>
    </div>
  );
}

/* --------------------------------------------------------------- capacity ---- */

/**
 * Send capacity — the daily and monthly caps shown as two separate
 * remaining-capacity meters so staff can see how much room a send has. When the
 * cap is disabled (`enabled` false) each meter shows "No cap" instead of a
 * misleading bar — sends are then limited only by Resend.
 */
function CapacityMeters({
  enabled,
  dailyLeft,
  dailyTotal,
  monthlyLeft,
  monthlyTotal,
}: {
  enabled: boolean;
  dailyLeft: number;
  dailyTotal: number;
  monthlyLeft: number;
  monthlyTotal: number;
}) {
  return (
    <div
      className="flex flex-wrap gap-x-5 gap-y-2"
      title={
        enabled
          ? `Send cap: ${dailyTotal.toLocaleString()} emails/day · ${monthlyTotal.toLocaleString()}/month`
          : "No send cap — limited only by Resend"
      }
    >
      <CapacityMeter
        label="Today"
        left={dailyLeft}
        total={dailyTotal}
        enabled={enabled}
      />
      <CapacityMeter
        label="This month"
        left={monthlyLeft}
        total={monthlyTotal}
        enabled={enabled}
      />
    </div>
  );
}

function CapacityMeter({
  label,
  left,
  total,
  enabled,
}: {
  label: string;
  left: number;
  total: number;
  enabled: boolean;
}) {
  // Cap off (or a non-finite total) — no meaningful bar to draw; show "No cap".
  if (!enabled || !Number.isFinite(total)) {
    return (
      <div className="min-w-[9rem]">
        <div className="flex items-baseline justify-between gap-2 text-xs">
          <span className="font-medium text-gray-500">{label}</span>
          <span className="font-semibold text-gray-700">No cap</span>
        </div>
        <Progress
          value={0}
          className="mt-1 h-1.5"
          barClassName="bg-brand-blue-500"
        />
      </div>
    );
  }
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
