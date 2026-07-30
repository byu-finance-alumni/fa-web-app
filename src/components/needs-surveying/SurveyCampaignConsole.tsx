"use client";

import { useCallback, useEffect, useState } from "react";
import {
  CalendarClock,
  CalendarPlus,
  Check,
  ChevronDown,
  History,
  Send,
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

// Resend send caps (Free plan): 100 emails/day, 3,000/month. Shown so staff can
// see how much headroom a send has; the backend enforces them server-side.
const DAILY_LIMIT = 100;
const MONTHLY_LIMIT = 3000;

/** Human labels for a schedule status. */
const STATUS_LABEL: Record<string, string> = {
  scheduled: "Scheduled",
  active: "Active",
  completed: "Completed",
  cancelled: "Cancelled",
};

/** Badge variant per schedule status. */
function statusVariant(
  status: string,
): "tag" | "success" | "neutral" | "muted" {
  switch (status) {
    case "active":
      return "success";
    case "scheduled":
      return "tag";
    case "completed":
      return "neutral";
    default:
      return "muted";
  }
}

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

  const [sendOpen, setSendOpen] = useState(false);
  const [sending, setSending] = useState(false);

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

  // Populate the year picker from the REAL database graduation years, load the
  // real usage tallies, and load the real schedules — all on mount.
  useEffect(() => {
    let cancelled = false;
    loadUsage();
    loadSchedules();
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
    return () => {
      cancelled = true;
    };
  }, [loadUsage, loadSchedules]);

  const selected =
    years?.find((y) => y.graduation_year === selectedYear) ?? null;
  const selectedSchedule =
    schedules?.find((s) => s.graduation_year === selectedYear) ?? null;

  const dailyLeft = Math.max(0, DAILY_LIMIT - sentToday);
  const monthlyLeft = Math.max(0, MONTHLY_LIMIT - sentThisMonth);

  // Estimated recipients for a manual send: alumni who haven't replied this
  // cycle (the backend also skips recent responders and anyone without a
  // personal email, so the actual figure may be lower).
  const notYetReplied = selected
    ? Math.max(0, selected.total_alumni - selected.responded)
    : 0;

  const changeSelectedYear = (year: number) => {
    setSelectedYear(year);
    setScheduleDate("");
  };

  const confirmSend = async () => {
    if (selectedYear === null || sending) return;
    setSending(true);
    try {
      const result = await clientPost<SurveySendResult>(
        `/survey/campaigns/${selectedYear}/send?dry_run=false`,
      );
      // Refetch the real usage + schedules now that a batch went out.
      loadUsage();
      loadSchedules();
      setSendOpen(false);

      if (result.sent > 0) {
        toast.success(
          `Sent ${result.sent.toLocaleString()} survey email${
            result.sent === 1 ? "" : "s"
          } for graduation year ${selectedYear}` +
            (result.remaining > 0
              ? ` — ${result.remaining.toLocaleString()} over today's cap; run Send again to continue.`
              : "."),
        );
      } else {
        toast.error(
          `No emails sent: ${result.total_recipients.toLocaleString()} recipient${
            result.total_recipients === 1 ? "" : "s"
          } found for ${selectedYear} (they need a personal email on file).`,
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
      setScheduleDate("");
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
          <CapacityMeters dailyLeft={dailyLeft} monthlyLeft={monthlyLeft} />
        </div>
        <p className="mt-3 border-t border-gray-200 pt-3 text-xs text-gray-400">
          Send limits are account-wide across every graduation year — 100 emails
          per day, 3,000 per month.
        </p>
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
          </TabsList>

          {/* ── Tab 1: a SINGLE box — the year's overview + status badge with
              the per-year schedule control on the right, per-stage counts, and
              the manual "Send now". ── */}
          <TabsContent value="schedule">
            <Card className="p-5">
              {/* Top: the "Last auto-send" stat on the LEFT, the per-year
                  schedule control (date + Schedule/Reschedule + status badge +
                  Cancel) filling the SCHEDULE slot on the RIGHT. */}
              <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                <div className="lg:flex-1">
                  <MiniStat
                    icon={<History className="h-4 w-4" aria-hidden="true" />}
                    label="Last auto-send"
                    value={formatWhen(selectedSchedule?.last_run_at ?? null)}
                  />
                </div>

                {/* SCHEDULE slot — the per-year schedule control (top-right of
                    the box), replacing the old "Schedule status" stat. Its
                    label matches the "Last auto-send" stat's label style. */}
                <div className="lg:w-auto lg:max-w-xs lg:border-l lg:border-gray-200 lg:pl-5">
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
                    {selectedSchedule ? (
                      <Badge variant={statusVariant(selectedSchedule.status)}>
                        {STATUS_LABEL[selectedSchedule.status] ??
                          selectedSchedule.status}
                      </Badge>
                    ) : null}
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
                    On the chosen date the survey auto-sends to graduation year{" "}
                    {selectedYear}, then follows up with non-responders at 1
                    &amp; 2 weeks.
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

              <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
                <span className="text-xs text-gray-400">
                  Each recipient gets an email with their personal survey link.
                </span>
                <Button
                  type="button"
                  size="sm"
                  onClick={() => setSendOpen(true)}
                  disabled={notYetReplied === 0}
                >
                  <Send aria-hidden="true" />
                  Send now ({notYetReplied.toLocaleString()})
                </Button>
              </div>
            </Card>
          </TabsContent>

          {/* ── Tab 2: admin review queue — real alum submissions to apply/reject.
              Keeps its own "N to review" badge inside the panel. ── */}
          <TabsContent value="submissions">
            <PendingSubmissions gradYear={selected.graduation_year} />
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
                  {notYetReplied.toLocaleString()}
                </span>{" "}
                alumni in graduation year {selectedYear} who haven&apos;t replied
                this cycle and have a personal email on file. Resend caps sends
                at {DAILY_LIMIT}/day — rerun to continue if there&apos;s a
                remainder.
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
