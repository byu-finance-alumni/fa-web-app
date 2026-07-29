"use client";

import { useCallback, useEffect, useState } from "react";
import { CheckCircle2, XCircle } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { useToast } from "@/components/ui/Toast";
import { ApiClientError, clientGet, clientPost } from "@/lib/api-client";
import type { components } from "@/types/api.gen";

type ResponseItem = components["schemas"]["SurveyResponseItem"];

/**
 * Admin review queue for a graduation year: the alumni who submitted "confirm
 * your info" updates, each with a before/after diff. Apply writes the changes to
 * the record; reject discards them. Both hit the real backend and refresh the
 * list. This is the "admin confirms before anything is applied" step.
 */
export function PendingSubmissions({ gradYear }: { gradYear: number }) {
  const { toast } = useToast();
  const [items, setItems] = useState<ResponseItem[] | null>(null);
  const [busyId, setBusyId] = useState<number | null>(null);

  const load = useCallback(() => {
    let cancelled = false;
    setItems(null);
    clientGet<ResponseItem[]>(`/survey/campaigns/${gradYear}/responses`)
      .then((data) => {
        if (!cancelled) setItems(data);
      })
      .catch(() => {
        if (!cancelled) setItems([]);
      });
    return () => {
      cancelled = true;
    };
  }, [gradYear]);

  useEffect(() => load(), [load]);

  const act = async (id: number, action: "apply" | "reject", name: string) => {
    setBusyId(id);
    try {
      await clientPost(`/survey/responses/${id}/${action}`);
      toast.success(
        action === "apply"
          ? `Applied ${name}'s updates.`
          : `Rejected ${name}'s submission.`,
      );
      setItems((prev) =>
        prev ? prev.filter((r) => r.survey_response_id !== id) : prev,
      );
    } catch (err) {
      const msg =
        err instanceof ApiClientError && err.message
          ? err.message
          : "Something went wrong.";
      toast.error(`Couldn't ${action}: ${msg}`);
    } finally {
      setBusyId(null);
    }
  };

  return (
    <Card className="mt-4 overflow-hidden">
      <header className="flex flex-wrap items-center justify-between gap-2 border-b border-gray-200 px-5 py-3">
        <h2 className="text-sm font-semibold text-gray-900">
          Pending submissions
        </h2>
        <Badge variant="neutral">
          {items ? `${items.length.toLocaleString()} to review` : "…"}
        </Badge>
      </header>

      <div className="space-y-2 p-3">
        {items === null ? (
          <p className="px-2 py-3 text-sm text-gray-500">Loading…</p>
        ) : items.length === 0 ? (
          <p className="px-2 py-3 text-sm text-gray-500">
            No submissions waiting for review in this graduation year.
          </p>
        ) : (
          items.map((r) => (
            <div
              key={r.survey_response_id}
              className="rounded-md border border-gray-200 bg-white p-3"
            >
              <div className="flex items-center justify-between gap-2">
                <span className="truncate text-sm font-semibold text-gray-900">
                  {r.name}
                </span>
                <span className="shrink-0 text-xs text-gray-400">
                  {formatWhen(r.submitted_at)}
                </span>
              </div>

              {r.changes.length === 0 ? (
                <p className="mt-2 text-xs italic text-gray-400">
                  Confirmed — nothing changed.
                </p>
              ) : (
                <dl className="mt-2 space-y-1.5">
                  {r.changes.map((c) => (
                    <div key={c.field_key}>
                      <dt className="text-xs text-gray-500">{c.label}</dt>
                      <dd className="flex flex-wrap items-center gap-2 text-sm">
                        <span className="text-gray-400 line-through">
                          {c.before || "—"}
                        </span>
                        <span aria-hidden="true" className="text-gray-400">
                          →
                        </span>
                        <span className="font-medium text-gray-900">
                          {c.after || "—"}
                        </span>
                      </dd>
                    </div>
                  ))}
                </dl>
              )}

              {r.photo_preview_url ? (
                <div className="mt-3">
                  <p className="text-xs text-gray-500">New profile photo</p>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={r.photo_preview_url}
                    alt={`New profile photo submitted by ${r.name}`}
                    className="mt-1 h-16 w-16 rounded-full object-cover"
                  />
                </div>
              ) : null}

              <div className="mt-3 flex gap-2">
                <Button
                  type="button"
                  size="sm"
                  variant="navy"
                  disabled={busyId === r.survey_response_id}
                  onClick={() =>
                    act(r.survey_response_id, "apply", r.name)
                  }
                >
                  <CheckCircle2 aria-hidden="true" />
                  Apply
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="secondary"
                  disabled={busyId === r.survey_response_id}
                  onClick={() =>
                    act(r.survey_response_id, "reject", r.name)
                  }
                >
                  <XCircle aria-hidden="true" />
                  Reject
                </Button>
              </div>
            </div>
          ))
        )}
      </div>
    </Card>
  );
}

function formatWhen(iso: string): string {
  const d = new Date(iso);
  return Number.isNaN(d.getTime())
    ? ""
    : d.toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
      });
}
