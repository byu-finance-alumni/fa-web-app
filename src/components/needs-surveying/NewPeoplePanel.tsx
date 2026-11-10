"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogFooter,
} from "@/components/ui/dialog";
import { useToast } from "@/components/ui/Toast";
import { ApiClientError, clientGet, clientPost, clientPostJson, clientPutJson } from "@/lib/api-client";
import { newPeopleSurveyUrl } from "@/lib/newPeopleSurvey";
import { cn } from "@/lib/utils";
import {
  DECEASED_MESSAGE,
  EMAIL_CHANGE_CAUTION,
  NEW_PERSON_STALE_MESSAGE,
  approveRequestBody,
  approveWarningsText,
  approvedMessage,
  bulkRejectChunks,
  isEmailField,
  mergeRowKind,
  overwriteFieldsFrom,
  pruneSelection,
  toggleAll,
  toggleSelected,
  formatSubmittedDate,
  kindLabel,
  matchProfileHref,
  matchReasonLabel,
  submissionFieldLabel,
  mergeButtonLabel,
  type NewPersonDecision,
} from "@/components/needs-surveying/new-people-review";
import {
  INVITE_MAX_CHARS,
  groupSkipped,
  inviteConfirmText,
  inviteCount,
  inviteSentText,
} from "@/components/needs-surveying/new-people-invite";
import type {
  NewPeopleInviteRequest,
  NewPeopleInviteResult,
  NewPeopleLinkRead,
  NewPersonApproveResult,
  NewPersonBulkRejectRequest,
  NewPersonBulkRejectResult,
  NewPersonMergePreview,
  NewPersonPossibleMatch,
  NewPersonSubmissionItem,
} from "@/types/new-people-survey";

/**
 * The staff side of the new-people survey (api#661), as the "New people" tab of
 * the survey console, beside the year's Submissions queue.
 *
 * Mounted only inside the `surveys.manage` console (the same gate the existing
 * review queue sits behind); every route here is `RequireSurveysManage` on the
 * backend as well. No icons: text buttons only.
 */
export function NewPeoplePanel() {
  // The link card owns the fetch; the email card only needs to know whether
  // the link is on (null while it loads or if it failed to load).
  const [linkEnabled, setLinkEnabled] = useState<boolean | null>(null);
  return (
    <div className="space-y-4">
      <NewPeopleLinkCard onEnabledChange={setLinkEnabled} />
      <NewPeopleInviteCard linkEnabled={linkEnabled} />
      <NewPeopleQueue />
    </div>
  );
}

function errorText(err: unknown): string {
  return err instanceof ApiClientError && err.message ? err.message : "Something went wrong.";
}

/* ------------------------------------------------------------ link card -- */

function NewPeopleLinkCard({
  onEnabledChange,
}: {
  onEnabledChange: (enabled: boolean | null) => void;
}) {
  const { toast } = useToast();
  const [link, setLink] = useState<NewPeopleLinkRead | null>(null);
  const [loadFailed, setLoadFailed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [reissueOpen, setReissueOpen] = useState(false);

  useEffect(() => {
    let cancelled = false;
    clientGet<NewPeopleLinkRead>("/survey/new-people/link")
      .then((data) => {
        if (!cancelled) setLink(data);
      })
      .catch(() => {
        if (!cancelled) setLoadFailed(true);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const enabled = link ? link.enabled : null;
  useEffect(() => {
    onEnabledChange(enabled);
  }, [enabled, onEnabledChange]);

  // Read at render: the link only exists after the client-side fetch, so this
  // never runs during the server render.
  const url =
    link && typeof window !== "undefined"
      ? newPeopleSurveyUrl(window.location.origin, link.key)
      : "";

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(url);
      toast.success("Link copied.");
    } catch {
      toast.error("Couldn't copy. Select the link and copy it by hand.");
    }
  };

  const toggle = async () => {
    if (!link) return;
    setBusy(true);
    try {
      const next = await clientPutJson<NewPeopleLinkRead>("/survey/new-people/link", {
        enabled: !link.enabled,
      });
      setLink(next);
      toast.success(next.enabled ? "The link is on." : "The link is off.");
    } catch (err) {
      toast.error(`Couldn't change the link: ${errorText(err)}`);
    } finally {
      setBusy(false);
    }
  };

  const reissue = async () => {
    setBusy(true);
    try {
      const next = await clientPost<NewPeopleLinkRead>("/survey/new-people/link/reissue");
      setLink(next);
      setReissueOpen(false);
      toast.success("New link made. The old link no longer works.");
    } catch (err) {
      toast.error(`Couldn't make a new link: ${errorText(err)}`);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card className="overflow-hidden">
      <header className="border-b border-gray-200 px-5 py-3">
        <h2 className="text-sm font-semibold text-gray-900">New people survey link</h2>
        <p className="mt-0.5 text-xs text-gray-500">
          One link for alumni and professionals who aren&apos;t in the database yet. Copy it,
          or email it from the card below. Answers wait in the queue; nobody is added until you
          approve them.
        </p>
      </header>
      <div className="space-y-4 p-5">
        {loadFailed ? (
          <p className="text-sm text-danger-600">Couldn&apos;t load the link. Refresh to try again.</p>
        ) : !link ? (
          <p className="text-sm text-gray-500">Loading…</p>
        ) : (
          <>
            <div className="flex flex-col gap-2 lg:flex-row lg:items-center">
              <input
                readOnly
                aria-label="New people survey link"
                value={url}
                onFocus={(e) => e.currentTarget.select()}
                className={cn(
                  "h-9 w-full min-w-0 flex-1 rounded-md border border-gray-300 bg-gray-50 px-3 font-mono text-xs text-gray-900",
                  !link.enabled && "text-gray-400 line-through",
                )}
              />
              <div className="flex shrink-0 gap-2">
                <Button type="button" size="sm" variant="secondary" onClick={copy} disabled={!url}>
                  Copy
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="secondary"
                  onClick={() => setReissueOpen(true)}
                  disabled={busy}
                >
                  Make a new link
                </Button>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <button
                type="button"
                role="switch"
                aria-checked={link.enabled}
                aria-labelledby="new-people-link-switch-label"
                onClick={toggle}
                disabled={busy}
                className={cn(
                  "relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-blue-500 focus-visible:ring-offset-1 disabled:opacity-50",
                  link.enabled ? "bg-brand-blue-600" : "bg-gray-300",
                )}
              >
                <span
                  className={cn(
                    "inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform",
                    link.enabled ? "translate-x-4" : "translate-x-0.5",
                  )}
                />
              </button>
              <span id="new-people-link-switch-label" className="text-sm font-medium text-gray-700">
                {link.enabled ? "Link is on" : "Link is off"}
              </span>
              <span className="text-xs text-gray-500">
                {link.enabled
                  ? "Anyone with the link can fill out the survey."
                  : "Anyone who opens it sees “This survey link is closed.”"}
              </span>
            </div>
          </>
        )}
      </div>

      <Dialog
        open={reissueOpen}
        onOpenChange={(open) => {
          if (!busy) setReissueOpen(open);
        }}
      >
        <DialogContent title="Make a new link?">
          <DialogBody className="space-y-3 text-sm text-gray-600">
            <p className="font-medium text-gray-900">The old link stops working right away.</p>
            <p>
              Anyone who opens the old link will see &ldquo;This survey link is closed.&rdquo; Send
              the new link to anyone who still needs it. The link stays{" "}
              {link?.enabled ? "on" : "off"}.
            </p>
          </DialogBody>
          <DialogFooter>
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={() => setReissueOpen(false)}
              disabled={busy}
            >
              Keep the current link
            </Button>
            <Button type="button" variant="destructive" size="sm" onClick={reissue} disabled={busy}>
              {busy ? "Making…" : "Make a new link"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}

/* ------------------------------------------------------ email the link -- */

/**
 * "Email the link": staff paste addresses and the server emails each one the
 * survey link. The server validates, dedupes and skips (already in the
 * database, invited in the last 30 days) and reports every skip back; the
 * count in the confirm dialog is only a rough client-side count of unique
 * tokens.
 */
function NewPeopleInviteCard({ linkEnabled }: { linkEnabled: boolean | null }) {
  const [text, setText] = useState("");
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [sending, setSending] = useState(false);
  const [result, setResult] = useState<NewPeopleInviteResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const count = inviteCount(text);
  const linkOff = linkEnabled === false;
  const canSend = count > 0 && !sending && linkEnabled === true;

  const send = async () => {
    setSending(true);
    setError(null);
    setResult(null);
    try {
      const body: NewPeopleInviteRequest = { emails: text };
      const res = await clientPostJson<NewPeopleInviteResult>("/survey/new-people/invite", body);
      setResult(res);
      setText("");
      setConfirmOpen(false);
    } catch (err) {
      setError(errorText(err));
      setConfirmOpen(false);
    } finally {
      setSending(false);
    }
  };

  const groups = result ? groupSkipped(result.skipped) : [];

  return (
    <Card className="overflow-hidden">
      <header className="border-b border-gray-200 px-5 py-3">
        <h2 className="text-sm font-semibold text-gray-900">Email the link</h2>
      </header>
      <div className="space-y-3 p-5">
        <div className="space-y-1.5">
          <Label htmlFor="new-people-invite-emails">Email addresses</Label>
          <Textarea
            id="new-people-invite-emails"
            value={text}
            maxLength={INVITE_MAX_CHARS}
            onChange={(e) => setText(e.target.value)}
            disabled={sending}
            rows={4}
            aria-describedby="new-people-invite-help"
          />
          <p id="new-people-invite-help" className="text-xs text-gray-500">
            Paste one or more, separated by commas or new lines. Up to 50 at a time.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <Button type="button" size="sm" onClick={() => setConfirmOpen(true)} disabled={!canSend}>
            {sending ? "Sending…" : "Send"}
          </Button>
          {linkOff ? (
            <span className="text-xs text-gray-500">Turn the link on to send it.</span>
          ) : null}
        </div>

        {error ? <p className="text-sm text-danger-600">{error}</p> : null}

        {result ? (
          <div className="space-y-2 text-sm">
            <p className="font-medium text-gray-900">{inviteSentText(result.sent)}</p>
            {groups.length > 0 ? (
              <div className="space-y-2">
                <p className="text-gray-600">Not sent:</p>
                {groups.map((g) => (
                  <div key={g.reason}>
                    <p className="text-xs font-medium text-gray-700">
                      {g.label} ({g.emails.length})
                    </p>
                    <ul className="mt-0.5 space-y-0.5 text-xs text-gray-600">
                      {g.emails.map((email, i) => (
                        <li key={`${email}-${i}`} className="break-all font-mono">
                          {email}
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
            ) : null}
          </div>
        ) : null}
      </div>

      <Dialog
        open={confirmOpen}
        onOpenChange={(open) => {
          if (!sending) setConfirmOpen(open);
        }}
      >
        <DialogContent title={inviteConfirmText(count)}>
          <DialogBody className="text-sm text-gray-600">
            <p>
              Each address gets one email with the survey link. Addresses already in the database
              or sent in the last 30 days are skipped.
            </p>
          </DialogBody>
          <DialogFooter>
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={() => setConfirmOpen(false)}
              disabled={sending}
            >
              Cancel
            </Button>
            <Button type="button" size="sm" onClick={send} disabled={sending}>
              {sending ? "Sending…" : "Send"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}

/* ----------------------------------------------------- merge review step -- */

/**
 * The review step before a merge (round 2). Shows what the merge would change
 * on the existing record, current beside submitted, the way the year queue
 * shows a survey diff. Blank fields fill automatically; a POPULATED field is
 * only replaced when its "Replace" box is ticked, and every box starts
 * unticked, so the default is "fill blanks only".
 */
function MergeReviewDialog({
  item,
  match,
  busy,
  onClose,
  onGone,
  onConfirm,
}: {
  item: NewPersonSubmissionItem;
  match: NewPersonPossibleMatch;
  busy: boolean;
  onClose: () => void;
  onGone: () => void;
  onConfirm: (overwriteFields: string[]) => void;
}) {
  const [preview, setPreview] = useState<NewPersonMergePreview | null>(null);
  const [failed, setFailed] = useState(false);
  const [checked, setChecked] = useState<Set<string>>(() => new Set());

  useEffect(() => {
    let cancelled = false;
    clientGet<NewPersonMergePreview>(
      `/survey/new-people/submissions/${item.submission_id}/preview?alumni_id=${encodeURIComponent(
        String(match.alumni_id),
      )}`,
    )
      .then((data) => {
        if (!cancelled) setPreview(data);
      })
      .catch((err) => {
        if (cancelled) return;
        if (err instanceof ApiClientError && err.status === 404) onGone();
        else setFailed(true);
      });
    return () => {
      cancelled = true;
    };
    // `onGone` is a fresh closure each render; the fetch belongs to the ids.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [item.submission_id, match.alumni_id]);

  const toggle = (key: string) =>
    setChecked((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });

  const deceased = preview?.deceased === true;

  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open && !busy) onClose();
      }}
    >
      <DialogContent
        className="max-w-3xl"
        title={`Update ${preview?.name ?? match.name} with ${item.name}'s answers?`}
        description="Blank fields are filled automatically. Tick Replace to overwrite information already on the record."
      >
        <DialogBody className="space-y-3 text-sm">
          {failed ? (
            <p className="text-danger-600">Couldn&apos;t load the preview. Close and try again.</p>
          ) : !preview ? (
            <p className="text-gray-500">Loading…</p>
          ) : (
            <>
              {deceased ? (
                <p role="alert" className="rounded-md bg-danger-50 px-3 py-2 font-medium text-danger-600">
                  {DECEASED_MESSAGE}. Merging is turned off.
                </p>
              ) : null}
              {preview.changes.length === 0 ? (
                <p className="text-gray-500">
                  Nothing would change: the record already has every answer.
                </p>
              ) : (
                <table className="w-full table-fixed border-collapse text-left">
                  <thead>
                    <tr className="border-b border-gray-200 text-xs text-gray-500">
                      <th className="w-1/4 py-1.5 pr-3 font-medium">Field</th>
                      <th className="w-1/4 py-1.5 pr-3 font-medium">Current</th>
                      <th className="w-1/4 py-1.5 pr-3 font-medium">Submitted</th>
                      <th className="w-1/4 py-1.5 font-medium">What happens</th>
                    </tr>
                  </thead>
                  <tbody>
                    {preview.changes.map((c) => {
                      const kind = mergeRowKind(preview, c.field_key);
                      const boxId = `merge-replace-${c.field_key}`;
                      return (
                        <tr key={c.field_key} className="border-b border-gray-100 align-top">
                          <td className="py-2 pr-3 text-gray-700">
                            {submissionFieldLabel(c.field_key, c.label)}
                            {isEmailField(c.field_key) ? (
                              <p className="mt-0.5 text-xs text-warning-600">
                                {EMAIL_CHANGE_CAUTION}
                              </p>
                            ) : null}
                          </td>
                          <td className="break-words py-2 pr-3 text-gray-500">
                            {c.before || "—"}
                          </td>
                          <td className="break-words py-2 pr-3 font-medium text-gray-900">
                            {c.after || "—"}
                          </td>
                          <td className="py-2">
                            {kind === "fill" ? (
                              <span className="text-xs text-gray-500">
                                Filled automatically (blank now)
                              </span>
                            ) : (
                              <label
                                htmlFor={boxId}
                                className="inline-flex cursor-pointer items-center gap-2 text-sm text-gray-700"
                              >
                                <input
                                  id={boxId}
                                  type="checkbox"
                                  checked={checked.has(c.field_key)}
                                  onChange={() => toggle(c.field_key)}
                                  disabled={deceased}
                                  className="h-4 w-4 rounded border-gray-300 text-brand-blue-600"
                                />
                                Replace
                              </label>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
            </>
          )}
        </DialogBody>
        <DialogFooter>
          <Button type="button" variant="secondary" size="sm" onClick={onClose} disabled={busy}>
            Cancel
          </Button>
          <Button
            type="button"
            variant="navy"
            size="sm"
            disabled={busy || !preview || deceased}
            onClick={() => preview && onConfirm(overwriteFieldsFrom(preview, checked))}
          >
            {busy ? "Updating…" : `Update ${preview?.name ?? match.name}`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/* ---------------------------------------------------------------- queue -- */

function NewPeopleQueue() {
  const { toast } = useToast();
  const [items, setItems] = useState<NewPersonSubmissionItem[] | null>(null);
  const [loadFailed, setLoadFailed] = useState(false);
  const [busyId, setBusyId] = useState<number | null>(null);
  const [staleIds, setStaleIds] = useState<Set<number>>(() => new Set());
  const [rejecting, setRejecting] = useState<NewPersonSubmissionItem | null>(null);
  // Round 2: merging goes through a review step, never straight from the card.
  const [merging, setMerging] = useState<{
    item: NewPersonSubmissionItem;
    match: NewPersonPossibleMatch;
  } | null>(null);
  // Bulk reject.
  const [selected, setSelected] = useState<Set<number>>(() => new Set());
  const [bulkOpen, setBulkOpen] = useState(false);
  const [bulkBusy, setBulkBusy] = useState(false);
  // Approve warnings stay on screen until dismissed: a toast vanishes in
  // seconds, and a kind mismatch is something the reviewer may want to fix.
  const [notices, setNotices] = useState<string[]>([]);

  // Bumped to re-read the queue (Refresh, and after a 409/404).
  const [nonce, setNonce] = useState(0);
  const load = useCallback(() => setNonce((n) => n + 1), []);

  useEffect(() => {
    let cancelled = false;
    clientGet<NewPersonSubmissionItem[]>("/survey/new-people/submissions")
      .then((data) => {
        if (cancelled) return;
        setItems(data ?? []);
        setLoadFailed(false);
      })
      .catch(() => {
        if (cancelled) return;
        setItems((prev) => prev ?? []);
        setLoadFailed(true);
      });
    return () => {
      cancelled = true;
    };
  }, [nonce]);

  const remove = (id: number) => {
    setItems((prev) => (prev ? prev.filter((r) => r.submission_id !== id) : prev));
  };

  // Only ids still in the queue count as selected, so a card that left on a
  // refresh can never be rejected by a stale tick.
  const ids = (items ?? []).map((r) => r.submission_id);
  const liveSelected = pruneSelection(selected, ids);

  /** Resolves true when the approve landed. */
  const approve = async (
    item: NewPersonSubmissionItem,
    decision: NewPersonDecision,
  ): Promise<boolean> => {
    setBusyId(item.submission_id);
    try {
      const result = await clientPostJson<NewPersonApproveResult>(
        `/survey/new-people/submissions/${item.submission_id}/approve`,
        approveRequestBody(item, decision),
      );
      const mergedName =
        decision.action === "merge"
          ? item.possible_matches.find((m) => m.alumni_id === decision.alumniId)?.name
          : undefined;
      const warnings = result?.duplicate_warnings ?? [];
      // Same as the year queue: the write SUCCEEDED, so a possible duplicate is
      // `info`, never the red error toast.
      if (warnings.length > 0) {
        toast.info(
          `${approvedMessage(item, decision, mergedName)} It may duplicate an existing record: ${warnings
            .map((w) => w.message)
            .join(" ")}`,
        );
      } else {
        toast.success(approvedMessage(item, decision, mergedName));
      }
      const notes = approveWarningsText(result?.warnings, item.kind);
      if (notes.length > 0) {
        setNotices((prev) => [...prev, ...notes.map((n) => `${item.name}: ${n}`)]);
      }
      remove(item.submission_id);
      return true;
    } catch (err) {
      handleActionError(item, err, "approve");
      return false;
    } finally {
      setBusyId(null);
    }
  };

  const reject = async (item: NewPersonSubmissionItem) => {
    setBusyId(item.submission_id);
    try {
      await clientPost<undefined>(`/survey/new-people/submissions/${item.submission_id}/reject`);
      toast.success(`Rejected ${item.name}'s submission. Their answers were deleted.`);
      remove(item.submission_id);
      setRejecting(null);
    } catch (err) {
      setRejecting(null);
      handleActionError(item, err, "reject");
    } finally {
      setBusyId(null);
    }
  };

  const handleActionError = (
    item: NewPersonSubmissionItem,
    err: unknown,
    action: "approve" | "reject",
  ) => {
    if (
      err instanceof ApiClientError &&
      err.status === 409 &&
      /deceased/i.test(err.message)
    ) {
      toast.error(`${DECEASED_MESSAGE}. Nothing was merged.`);
      return;
    }
    if (err instanceof ApiClientError && err.status === 409) {
      // Refetch so the card shows what is there NOW; the flag keeps the message
      // on that card until the reviewer acts on the fresh copy.
      setStaleIds((prev) => new Set(prev).add(item.submission_id));
      toast.error(`${NEW_PERSON_STALE_MESSAGE}. It has been reloaded; check it and try again.`);
      load();
      return;
    }
    if (err instanceof ApiClientError && err.status === 404) {
      toast.error("This submission was already handled. The list has been refreshed.");
      load();
      return;
    }
    toast.error(`Couldn't ${action}: ${errorText(err)}`);
  };

  const bulkReject = async () => {
    const chosen = [...liveSelected];
    if (chosen.length === 0) return;
    setBulkBusy(true);
    let rejected = 0;
    try {
      for (const chunk of bulkRejectChunks(chosen)) {
        const body: NewPersonBulkRejectRequest = { submission_ids: chunk };
        const res = await clientPostJson<NewPersonBulkRejectResult>(
          "/survey/new-people/submissions/reject",
          body,
        );
        rejected += res?.rejected ?? 0;
      }
      toast.success(
        `Rejected ${rejected.toLocaleString()} ${rejected === 1 ? "submission" : "submissions"}. Their answers were deleted.`,
      );
    } catch (err) {
      toast.error(`Couldn't reject: ${errorText(err)}`);
    } finally {
      setBulkBusy(false);
      setBulkOpen(false);
      setSelected(new Set());
      // Re-read rather than guess: ids that were no longer pending are skipped
      // by the server, and the list should show what is actually left.
      load();
    }
  };

  const allChecked = ids.length > 0 && liveSelected.size === ids.length;

  return (
    <Card className="overflow-hidden">
      <header className="flex flex-wrap items-center justify-between gap-2 border-b border-gray-200 px-5 py-3">
        <h2 className="text-sm font-semibold text-gray-900">New people</h2>
        <div className="flex items-center gap-2">
          <Badge variant="neutral">
            {items === null ? "…" : `${items.length.toLocaleString()} to review`}
          </Badge>
          <Button type="button" size="sm" variant="ghost" onClick={load}>
            Refresh
          </Button>
        </div>
      </header>

      {ids.length > 0 ? (
        <div className="flex flex-wrap items-center gap-3 border-b border-gray-200 px-5 py-2">
          <label className="inline-flex cursor-pointer items-center gap-2 text-sm text-gray-700">
            <input
              type="checkbox"
              checked={allChecked}
              onChange={() => setSelected((prev) => toggleAll(pruneSelection(prev, ids), ids))}
              className="h-4 w-4 rounded border-gray-300 text-brand-blue-600"
            />
            Select all
          </label>
          <Button
            type="button"
            size="sm"
            variant="secondary"
            disabled={liveSelected.size === 0 || bulkBusy}
            onClick={() => setBulkOpen(true)}
          >
            Reject selected ({liveSelected.size.toLocaleString()})
          </Button>
        </div>
      ) : null}

      {notices.length > 0 ? (
        <div className="border-b border-gray-200 bg-warning-50 px-5 py-3 text-sm text-gray-900">
          <ul className="space-y-1">
            {notices.map((n, i) => (
              <li key={`${i}-${n}`}>{n}</li>
            ))}
          </ul>
          <Button
            type="button"
            size="sm"
            variant="ghost"
            className="mt-1 px-0"
            onClick={() => setNotices([])}
          >
            Dismiss
          </Button>
        </div>
      ) : null}

      <div className="space-y-2 p-3">
        {loadFailed ? (
          <p className="px-2 py-1 text-sm text-danger-600">
            Couldn&apos;t load the queue. Press Refresh to try again.
          </p>
        ) : null}
        {items === null ? (
          <p className="px-2 py-3 text-sm text-gray-500">Loading…</p>
        ) : items.length === 0 ? (
          <p className="px-2 py-3 text-sm text-gray-500">No new people waiting for review.</p>
        ) : (
          items.map((r) => {
            const busy = busyId === r.submission_id;
            const comment = r.comments && r.comments.trim() ? r.comments : null;
            return (
              <div key={r.submission_id} className="rounded-md border border-gray-200 bg-white p-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="flex min-w-0 flex-wrap items-center gap-2">
                    <input
                      type="checkbox"
                      aria-label={`Select ${r.name}`}
                      checked={liveSelected.has(r.submission_id)}
                      onChange={() => setSelected((prev) => toggleSelected(prev, r.submission_id))}
                      className="h-4 w-4 rounded border-gray-300 text-brand-blue-600"
                    />
                    <span className="truncate text-sm font-semibold text-gray-900">{r.name}</span>
                    <Badge variant="tag" size="sm">
                      {kindLabel(r.kind)}
                    </Badge>
                    {comment ? (
                      <Badge variant="tag" size="sm">
                        Has comment
                      </Badge>
                    ) : null}
                  </span>
                  <span className="shrink-0 text-xs text-gray-400">
                    {formatSubmittedDate(r.submitted_at)}
                  </span>
                </div>
                <p className="mt-0.5 text-xs text-gray-500">{r.email ?? "No email given"}</p>

                {staleIds.has(r.submission_id) ? (
                  <p role="alert" className="mt-2 text-xs text-danger-600">
                    {NEW_PERSON_STALE_MESSAGE}. Showing the latest version.
                  </p>
                ) : null}

                {r.fields.length > 0 ? (
                  <dl className="mt-2 grid gap-x-6 gap-y-1.5 sm:grid-cols-2">
                    {r.fields.map((f) => (
                      <div key={f.field_key}>
                        <dt className="text-xs text-gray-500">
                          {submissionFieldLabel(f.field_key, f.label)}
                        </dt>
                        <dd className="break-words text-sm font-medium text-gray-900">
                          {f.value || "—"}
                        </dd>
                      </div>
                    ))}
                  </dl>
                ) : null}

                {comment ? (
                  <div className="mt-3">
                    <p className="text-xs text-gray-500">Their comment</p>
                    {/* Public-form text: a React text node (escaped), never HTML. */}
                    <p className="mt-1 whitespace-pre-wrap break-words rounded-md bg-gray-50 px-3 py-2 text-sm text-gray-900">
                      {comment}
                    </p>
                    <p className="mt-1 text-xs text-gray-400">
                      Approving saves this as a note on their profile.
                    </p>
                  </div>
                ) : null}

                <div className="mt-3">
                  <p className="text-xs text-gray-500">Possible matches already in the database</p>
                  {r.possible_matches.length === 0 ? (
                    <p className="mt-1 text-sm text-gray-500">None found.</p>
                  ) : (
                    <ul className="mt-1 space-y-1">
                      {r.possible_matches.map((m) => (
                        <li key={m.alumni_id} className="flex flex-wrap items-center gap-2 text-sm">
                          <Link
                            href={matchProfileHref(m)}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="font-medium text-brand-blue-600 hover:text-brand-blue-500 hover:underline"
                          >
                            {m.name}
                          </Link>
                          <span className="text-xs text-gray-500">
                            {m.is_friend
                              ? "Friend"
                              : m.graduation_year
                                ? `Class of ${m.graduation_year}`
                                : "Alum"}
                          </span>
                          <Badge variant="warning" size="sm">
                            {matchReasonLabel(m.match_reason)}
                          </Badge>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>

                <div className="mt-3 flex flex-wrap gap-2">
                  <Button
                    type="button"
                    size="sm"
                    variant="navy"
                    disabled={busy}
                    onClick={() => approve(r, { action: "create", kind: "alum" })}
                  >
                    Add as alum
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="navy"
                    disabled={busy}
                    onClick={() => approve(r, { action: "create", kind: "friend" })}
                  >
                    Add as friend
                  </Button>
                  {r.possible_matches.map((m) => (
                    <Button
                      key={m.alumni_id}
                      type="button"
                      size="sm"
                      variant="secondary"
                      disabled={busy}
                      onClick={() => setMerging({ item: r, match: m })}
                    >
                      {mergeButtonLabel(m)}
                    </Button>
                  ))}
                  <Button
                    type="button"
                    size="sm"
                    variant="secondary"
                    disabled={busy}
                    onClick={() => setRejecting(r)}
                  >
                    Reject
                  </Button>
                </div>
              </div>
            );
          })
        )}
      </div>

      <Dialog
        open={rejecting !== null}
        onOpenChange={(open) => {
          if (!open && busyId === null) setRejecting(null);
        }}
      >
        <DialogContent title="Reject this submission?">
          <DialogBody className="space-y-3 text-sm text-gray-600">
            <p className="font-medium text-gray-900">
              {rejecting?.name}&apos;s answers will be deleted and can&apos;t be recovered.
            </p>
            <p>Nobody is added to the database. A record that the submission was rejected is kept.</p>
          </DialogBody>
          <DialogFooter>
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={() => setRejecting(null)}
              disabled={busyId !== null}
            >
              Keep it
            </Button>
            <Button
              type="button"
              variant="destructive"
              size="sm"
              onClick={() => rejecting && reject(rejecting)}
              disabled={busyId !== null}
            >
              {busyId !== null ? "Rejecting…" : "Reject"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={bulkOpen}
        onOpenChange={(open) => {
          if (!bulkBusy) setBulkOpen(open);
        }}
      >
        <DialogContent
          title={`Reject ${liveSelected.size.toLocaleString()} ${liveSelected.size === 1 ? "submission" : "submissions"}?`}
        >
          <DialogBody className="space-y-3 text-sm text-gray-600">
            <p className="font-medium text-gray-900">
              The answers in {liveSelected.size.toLocaleString()}{" "}
              {liveSelected.size === 1 ? "submission" : "submissions"} will be deleted and
              can&apos;t be recovered.
            </p>
            <p>Nobody is added to the database. A record of the rejection is kept.</p>
          </DialogBody>
          <DialogFooter>
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={() => setBulkOpen(false)}
              disabled={bulkBusy}
            >
              Keep them
            </Button>
            <Button
              type="button"
              variant="destructive"
              size="sm"
              onClick={bulkReject}
              disabled={bulkBusy || liveSelected.size === 0}
            >
              {bulkBusy ? "Rejecting…" : `Reject ${liveSelected.size.toLocaleString()}`}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {merging ? (
        <MergeReviewDialog
          key={`${merging.item.submission_id}-${merging.match.alumni_id}`}
          item={merging.item}
          match={merging.match}
          busy={busyId === merging.item.submission_id}
          onClose={() => setMerging(null)}
          onGone={() => {
            setMerging(null);
            toast.error("This submission or record is no longer available. The list has been refreshed.");
            load();
          }}
          onConfirm={async (overwriteFields) => {
            const ok = await approve(merging.item, {
              action: "merge",
              alumniId: merging.match.alumni_id,
              overwriteFields,
            });
            if (ok) setMerging(null);
          }}
        />
      ) : null}
    </Card>
  );
}
