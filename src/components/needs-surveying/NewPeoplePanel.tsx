"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
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
  NEW_PERSON_STALE_MESSAGE,
  approveRequestBody,
  approvedMessage,
  formatSubmittedDate,
  kindLabel,
  matchProfileHref,
  matchReasonLabel,
  mergeButtonLabel,
  type NewPersonDecision,
} from "@/components/needs-surveying/new-people-review";
import type {
  NewPeopleLinkRead,
  NewPersonApproveResult,
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
  return (
    <div className="space-y-4">
      <NewPeopleLinkCard />
      <NewPeopleQueue />
    </div>
  );
}

function errorText(err: unknown): string {
  return err instanceof ApiClientError && err.message ? err.message : "Something went wrong.";
}

/* ------------------------------------------------------------ link card -- */

function NewPeopleLinkCard() {
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
          One link for alumni and professionals who aren&apos;t in the database yet. Email it
          yourself. Answers wait in the queue below; nobody is added until you approve them.
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

/* ---------------------------------------------------------------- queue -- */

function NewPeopleQueue() {
  const { toast } = useToast();
  const [items, setItems] = useState<NewPersonSubmissionItem[] | null>(null);
  const [loadFailed, setLoadFailed] = useState(false);
  const [busyId, setBusyId] = useState<number | null>(null);
  const [staleIds, setStaleIds] = useState<Set<number>>(() => new Set());
  const [rejecting, setRejecting] = useState<NewPersonSubmissionItem | null>(null);

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

  const remove = (id: number) =>
    setItems((prev) => (prev ? prev.filter((r) => r.submission_id !== id) : prev));

  const approve = async (item: NewPersonSubmissionItem, decision: NewPersonDecision) => {
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
      remove(item.submission_id);
    } catch (err) {
      handleActionError(item, err, "approve");
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
                        <dt className="text-xs text-gray-500">{f.label}</dt>
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
                      onClick={() => approve(r, { action: "merge", alumniId: m.alumni_id })}
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
    </Card>
  );
}
