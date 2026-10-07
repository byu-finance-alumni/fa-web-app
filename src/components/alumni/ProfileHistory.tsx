"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ApiClientError, clientGet } from "@/lib/api-client";
import {
  describeChange,
  historyRequestPath,
  historyStartLabel,
  historyWhen,
  mergeHistoryPages,
  sourceLabel,
} from "@/lib/history";
import type { AlumniHistoryGroup, AlumniHistoryPage } from "@/types/history";
import { Button } from "@/components/ui/button";
import { LoadError } from "@/components/shared/LoadError";

/**
 * Version history for one alumni record (#45) — READ-ONLY.
 *
 * One row per save, newest first: when, who, where it came from (manual edit /
 * import / survey), and each field as `old → new` in the same style as the
 * bulk-update import's review diff. Paged with "Load more" against the
 * backend's keyset cursor.
 *
 * Rendered only for editors (the page gates the tab on the `alumni.edit`
 * capability); the backend re-checks, scopes values to the caller's role, and
 * audit-logs every read. The tab content mounts only when opened, so the first
 * page is fetched then, not on every profile view.
 *
 * Restore is deliberately absent: each change carries its `audit_id`, which a
 * later per-field restore will use.
 */
export function ProfileHistory({ alumniId }: { alumniId: number }) {
  const [groups, setGroups] = useState<AlumniHistoryGroup[]>([]);
  const [next, setNext] = useState<string | null>(null);
  const [startsOn, setStartsOn] = useState<string | null>(null);
  const [state, setState] = useState<"loading" | "ready" | "error">("loading");
  const [errorStatus, setErrorStatus] = useState<number | null>(null);
  const [loadingMore, setLoadingMore] = useState(false);
  const [moreFailed, setMoreFailed] = useState(false);
  // Guards against a double-click firing two requests for the same cursor.
  const inFlight = useRef(false);

  const loadFirst = useCallback(() => {
    setState("loading");
    clientGet<AlumniHistoryPage>(historyRequestPath(alumniId))
      .then((page) => {
        setGroups(page.items);
        setNext(page.next_before);
        setStartsOn(page.history_starts);
        setState("ready");
      })
      .catch((err: unknown) => {
        setErrorStatus(err instanceof ApiClientError ? err.status : 0);
        setState("error");
      });
  }, [alumniId]);

  useEffect(() => {
    loadFirst();
  }, [loadFirst]);

  const loadMore = () => {
    if (!next || inFlight.current) return;
    inFlight.current = true;
    setLoadingMore(true);
    setMoreFailed(false);
    clientGet<AlumniHistoryPage>(historyRequestPath(alumniId, next))
      .then((page) => {
        setGroups((shown) => mergeHistoryPages(shown, page.items));
        setNext(page.next_before);
      })
      .catch(() => setMoreFailed(true))
      .finally(() => {
        inFlight.current = false;
        setLoadingMore(false);
      });
  };

  if (state === "loading") {
    return (
      <p className="py-6 text-center text-sm text-gray-500">
        Loading history…
      </p>
    );
  }
  if (state === "error") {
    return <LoadError status={errorStatus} noun="this record's history" />;
  }

  const since = startsOn ? historyStartLabel(startsOn) : null;

  if (!groups.length) {
    return (
      <p className="py-6 text-center text-sm text-gray-500">
        No recorded changes{since ? ` since ${since}` : ""}.
      </p>
    );
  }

  return (
    <div className="space-y-3">
      <div className="overflow-x-auto rounded-md border border-gray-200">
        <table className="w-full text-left text-sm">
          <thead className="bg-gray-50 text-xs font-semibold uppercase tracking-wide text-gray-500">
            <tr>
              <th scope="col" className="px-3 py-2">
                When
              </th>
              <th scope="col" className="px-3 py-2">
                Changed by
              </th>
              <th scope="col" className="px-3 py-2">
                Source
              </th>
              <th scope="col" className="px-3 py-2">
                Changes
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {groups.map((g) => (
              <tr key={g.group_id}>
                <td className="whitespace-nowrap px-3 py-2 align-top text-gray-700">
                  {historyWhen(g.at)}
                </td>
                <td className="px-3 py-2 align-top text-gray-700">
                  {g.actor_name || "Unknown user"}
                </td>
                <td className="whitespace-nowrap px-3 py-2 align-top text-gray-700">
                  {sourceLabel(g.source)}
                </td>
                <td className="px-3 py-2 align-top text-gray-700">
                  <ul className="space-y-1">
                    {g.changes.map((c) => {
                      const v = describeChange(c);
                      return (
                        <li key={c.audit_id} className="break-words">
                          <span className="font-medium text-gray-900">
                            {v.title}
                            {v.kind === "none" ? "" : ":"}
                          </span>{" "}
                          {v.kind === "diff" ? (
                            <>
                              <span className="text-gray-500 line-through">
                                {v.old}
                              </span>{" "}
                              <span aria-hidden="true">→</span>{" "}
                              <span className="text-gray-900">{v.new}</span>
                            </>
                          ) : v.kind === "added" ? (
                            <span className="text-gray-900">{v.new}</span>
                          ) : v.kind === "removed" ? (
                            <span className="text-gray-500 line-through">
                              {v.old}
                            </span>
                          ) : v.kind === "old-hidden" ? (
                            <>
                              <span className="italic text-gray-500">
                                Earlier text hidden
                              </span>{" "}
                              <span aria-hidden="true">→</span>{" "}
                              <span className="text-gray-900">{v.new}</span>
                            </>
                          ) : v.kind === "hidden" ? (
                            <span className="italic text-gray-500">
                              Text hidden for your role
                            </span>
                          ) : null}
                        </li>
                      );
                    })}
                  </ul>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="flex items-center justify-between gap-3">
        <p className="text-xs text-gray-500">
          {since ? `Changes are recorded from ${since} onward.` : null}
        </p>
        {next ? (
          <Button
            type="button"
            variant="secondary"
            size="sm"
            onClick={loadMore}
            disabled={loadingMore}
          >
            {loadingMore ? "Loading…" : "Load more"}
          </Button>
        ) : null}
      </div>
      {moreFailed ? (
        <p className="text-right text-xs text-danger-600">
          Couldn&apos;t load more history. Try again.
        </p>
      ) : null}
    </div>
  );
}
