"use client";

import { useState } from "react";
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
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/components/ui/Toast";
import { cn } from "@/lib/utils";
import { SAMPLE_CAMPAIGNS, initialSentCount } from "@/lib/sampleCampaigns";
import type { ClassCampaign } from "@/types/surveyCampaign";

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
 * graduation-year picker, last/next send + round stats, and Send), an
 * expandable no-reply list for manual outreach, a dense change report (only
 * alumni who changed something, each rejectable/editable), and an admin Submit.
 */

/** Fixed demo date stamped on a send in the prototype (matches the mock cadence). */
const DEMO_SEND_DATE = "2026-07-20";

/** A change record with a local "rejected" flag layered on for staging. */
type WorkingChangeRecord = ClassCampaign["changeRecords"][number] & {
  rejected: boolean;
};

/** A class campaign whose change records carry the local rejected flag. */
type WorkingClass = Omit<ClassCampaign, "changeRecords"> & {
  changeRecords: WorkingChangeRecord[];
};

/** Deep-copy the sample campaigns into editable working state. */
function initClasses(): WorkingClass[] {
  return SAMPLE_CAMPAIGNS.map((c) => ({
    ...c,
    round1: { ...c.round1 },
    round2: { ...c.round2 },
    noReply: c.noReply.map((n) => ({ ...n })),
    changeRecords: c.changeRecords.map((r) => ({
      ...r,
      rejected: false,
      changes: r.changes.map((ch) => ({ ...ch })),
    })),
  }));
}

/** Format an ISO `YYYY-MM-DD` as e.g. "Mar 3, 2026" (no timezone drift). */
function formatDate(iso: string): string {
  return new Date(`${iso}T00:00:00`).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export function SurveyCampaignConsole() {
  const { toast } = useToast();

  const [classes, setClasses] = useState<WorkingClass[]>(initClasses);
  const [sentCount, setSentCount] = useState(() =>
    initialSentCount(SAMPLE_CAMPAIGNS),
  );
  const [selectedYear, setSelectedYear] = useState<number>(
    SAMPLE_CAMPAIGNS[0].gradYear,
  );
  const [noReplyOpen, setNoReplyOpen] = useState(false);

  const [sendOpen, setSendOpen] = useState(false);
  const [customMessage, setCustomMessage] = useState("");
  const [submitOpen, setSubmitOpen] = useState(false);

  // Inline edit of one alum's proposed "after" values (one record at a time).
  const [editingId, setEditingId] = useState<number | null>(null);
  const [drafts, setDrafts] = useState<string[]>([]);

  const selected =
    classes.find((c) => c.gradYear === selectedYear) ?? classes[0];

  const activeChanges = selected.changeRecords.filter((r) => !r.rejected);
  const rejectedCount = selected.changeRecords.length - activeChanges.length;
  const applyCount = activeChanges.length;
  const noReplyCount = selected.noReply.length;

  // Last time this graduation year was surveyed (the later of the two rounds).
  const lastSent = selected.round2.sentDate ?? selected.round1.sentDate;
  const r1Rate =
    selected.round1.recipients > 0
      ? Math.round(
          (selected.round1.responses / selected.round1.recipients) * 100,
        )
      : 0;

  // Which send is next for this year: the initial "first batch" (round 1) if it
  // hasn't gone out, otherwise the no-reply follow-up (round 2).
  const round1Sent = selected.round1.sentDate !== null;
  const round2Sent = selected.round2.sentDate !== null;
  const sendStage: "first" | "followup" = round1Sent ? "followup" : "first";
  const sendTargetCount =
    sendStage === "first" ? selected.round1.recipients : noReplyCount;
  const sendLabel =
    sendStage === "first"
      ? "Send first batch"
      : round2Sent
        ? "Resend follow-up"
        : "Send follow-up";
  const sendDisabled = selected.submitted || sendTargetCount === 0;

  const changeSelectedYear = (year: number) => {
    setSelectedYear(year);
    setNoReplyOpen(false);
    setEditingId(null);
    setDrafts([]);
  };

  const confirmSend = () => {
    if (sendStage === "first") {
      // First batch: stamp round 1 as sent and count the whole eligible year.
      const recipients = selected.round1.recipients;
      setClasses((prev) =>
        prev.map((c) =>
          c.gradYear === selectedYear
            ? { ...c, round1: { ...c.round1, sentDate: DEMO_SEND_DATE } }
            : c,
        ),
      );
      setSentCount((n) => n + recipients);
      toast.success(
        `Prototype: initial survey staged for ${recipients} alumni in graduation year ${selectedYear}. No email was sent.`,
      );
    } else {
      // Follow-up: stamp round 2 as sent to the current no-reply list.
      setClasses((prev) =>
        prev.map((c) =>
          c.gradYear === selectedYear
            ? {
                ...c,
                round2: {
                  ...c.round2,
                  sentDate: DEMO_SEND_DATE,
                  recipients: c.noReply.length,
                },
              }
            : c,
        ),
      );
      setSentCount((n) => n + noReplyCount);
      toast.success(
        `Prototype: follow-up staged for ${noReplyCount} non-responders in graduation year ${selectedYear}. No email was sent.`,
      );
    }
    setSendOpen(false);
    setCustomMessage("");
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
      `Prototype: applied ${applyCount} ${
        applyCount === 1 ? "change" : "changes"
      } to graduation year ${selectedYear}. No records were written.`,
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
      {/* ── Overview: picker + counter, then last/next send + round stats + Send ── */}
      <Card className="p-5">
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

          <div className="text-right">
            <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">
              Total surveys sent
            </p>
            <p className="text-2xl font-semibold tabular-nums tracking-tight text-navy-800">
              {sentCount.toLocaleString()}
            </p>
            <p className="text-xs text-gray-400">across all years &amp; rounds</p>
          </div>
        </div>

        {/* Compact stat row — last/next send + both rounds. */}
        <div className="mt-4 grid grid-cols-2 gap-x-4 gap-y-3 border-t border-gray-200 pt-4 lg:grid-cols-4">
          <MiniStat
            icon={<History className="h-4 w-4" aria-hidden="true" />}
            label="Last sent"
            value={lastSent ? formatDate(lastSent) : "Never"}
          />
          <MiniStat
            icon={<CalendarClock className="h-4 w-4" aria-hidden="true" />}
            label="Next send due"
            value={formatDate(selected.nextSendDate)}
          />
          <MiniStat
            label="Round 1 · initial"
            value={`${selected.round1.responses}/${selected.round1.recipients} replied`}
            sub={`${r1Rate}%`}
          />
          <MiniStat
            label="Round 2 · no-reply"
            value={
              selected.round2.sentDate
                ? `${selected.round2.responses}/${selected.round2.recipients} replied`
                : "Not sent"
            }
            sub={selected.round2.sentDate ? formatDate(selected.round2.sentDate) : undefined}
          />
        </div>

        <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
          <span className="text-xs text-gray-400">
            Prototype — sends are staged locally; no email is sent.
          </span>
          <Button
            type="button"
            size="sm"
            onClick={() => setSendOpen(true)}
            disabled={sendDisabled}
          >
            <Send aria-hidden="true" />
            {sendLabel} ({sendTargetCount.toLocaleString()})
          </Button>
        </div>
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

      {/* ── Change report: only alumni who actually changed something ── */}
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
              locked. (Prototype — no records were written.)
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

      {/* Send dialog */}
      <Dialog open={sendOpen} onOpenChange={setSendOpen}>
        <DialogContent
          title={`${
            sendStage === "first" ? "Send first batch" : "Send follow-up"
          } — graduation year ${selectedYear}`}
          description="Prototype — no email is actually sent."
        >
          <DialogBody className="space-y-4">
            <div className="flex items-start gap-2 rounded-md border border-brand-blue-300/50 bg-brand-blue-50 px-4 py-3 text-sm text-navy-800">
              <MailX className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
              <span>
                {sendStage === "first" ? (
                  <>
                    The initial survey — goes to all{" "}
                    <span className="font-semibold tabular-nums">
                      {selected.round1.recipients.toLocaleString()}
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
                placeholder="Add a short note to include in the follow-up…"
                className="mt-1"
              />
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
            <Button type="button" size="sm" onClick={confirmSend}>
              <Send aria-hidden="true" />
              Send to {sendTargetCount.toLocaleString()}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Submit dialog */}
      <Dialog open={submitOpen} onOpenChange={setSubmitOpen}>
        <DialogContent
          title={`Apply changes — graduation year ${selectedYear}`}
          description="Prototype — no records are actually written."
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
              Prototype only — this locks further editing for the year but does
              not write to any record.
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
