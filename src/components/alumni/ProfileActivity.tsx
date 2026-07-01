"use client";

import { useState } from "react";
import { AddInteractionButton } from "@/components/alumni/ProfileDialogs";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

export type ActivityCategory =
  | "Meetings"
  | "Calls"
  | "Notes"
  | "Events"
  | "Updates";

export interface ActivityItem {
  id: string;
  category: ActivityCategory;
  title: string;
  typeLabel: string;
  when: string | null;
  who: string | null;
  description: string | null;
}

const FILTERS: ("All" | ActivityCategory)[] = [
  "All",
  "Meetings",
  "Calls",
  "Notes",
  "Events",
  "Updates",
];

const fmt = (iso: string | null) =>
  iso
    ? new Date(iso).toLocaleDateString("en-US", {
        year: "numeric",
        month: "short",
        day: "numeric",
      })
    : "";

export function ProfileActivity({
  alumniId,
  items,
  canEdit,
}: {
  alumniId: number;
  items: ActivityItem[];
  canEdit: boolean;
}) {
  const [filter, setFilter] = useState<"All" | ActivityCategory>("All");
  const shown =
    filter === "All" ? items : items.filter((i) => i.category === filter);

  return (
    <section className="rounded-lg border border-gray-200 bg-white p-5 shadow-card">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-sm font-semibold text-gray-900">Activity</h3>
        {canEdit ? (
          <AddInteractionButton alumniId={alumniId} label="+ Log activity" primary />
        ) : null}
      </div>

      {/* Text-style underline tabs (no pills) consistent with the design
          system's Tabs primitive — #225. */}
      <div className="mb-4 flex flex-wrap items-center gap-1 border-b border-gray-200">
        {FILTERS.map((f) => {
          const active = f === filter;
          return (
            <button
              key={f}
              type="button"
              onClick={() => setFilter(f)}
              aria-pressed={active}
              className={cn(
                "-mb-px border-b-2 px-3 py-2 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-blue-500 focus-visible:ring-offset-1",
                active
                  ? "border-brand-blue-600 font-semibold text-brand-blue-600"
                  : "border-transparent text-gray-500 hover:text-gray-900",
              )}
            >
              {f}
            </button>
          );
        })}
      </div>

      {shown.length === 0 ? (
        <p className="py-8 text-center text-sm text-gray-500">
          No {filter === "All" ? "" : filter.toLowerCase() + " "}activity yet.
        </p>
      ) : (
        <ul className="space-y-1">
          {shown.map((i) => {
            return (
              <li
                key={i.id}
                className="flex gap-3 border-b border-gray-100 py-3 last:border-0"
              >
                {/* Square marker (no icon, no pill) — #225. */}
                <span
                  aria-hidden="true"
                  className="mt-1.5 h-3 w-3 shrink-0 rounded-sm bg-brand-blue-600"
                />
                <div className="min-w-0 flex-1">
                  <div className="flex items-start justify-between gap-3">
                    <p className="text-sm font-medium text-gray-900">
                      {i.title}
                      <Badge variant="neutral" className="ml-2">
                        {i.typeLabel}
                      </Badge>
                    </p>
                    <span className="shrink-0 text-xs text-gray-500">
                      {fmt(i.when)}
                      {i.who ? ` · ${i.who}` : ""}
                    </span>
                  </div>
                  {i.description ? (
                    <p className="mt-0.5 text-sm text-gray-600">{i.description}</p>
                  ) : null}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
