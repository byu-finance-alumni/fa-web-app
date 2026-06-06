"use client";

import { useState } from "react";
import {
  Users,
  Phone,
  StickyNote,
  CalendarDays,
  PencilLine,
  type LucideIcon,
} from "lucide-react";
import { AddInteractionButton } from "@/components/alumni/ProfileDialogs";

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

const ICONS: Record<ActivityCategory, LucideIcon> = {
  Meetings: Users,
  Calls: Phone,
  Notes: StickyNote,
  Events: CalendarDays,
  Updates: PencilLine,
};

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
    <section className="rounded-xl border border-gray-300 bg-white p-5">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-[15px] font-semibold text-gray-900">Activity</h3>
        {canEdit ? (
          <AddInteractionButton alumniId={alumniId} label="+ Log activity" primary />
        ) : null}
      </div>

      <div className="mb-4 flex flex-wrap gap-1.5">
        {FILTERS.map((f) => {
          const active = f === filter;
          return (
            <button
              key={f}
              type="button"
              onClick={() => setFilter(f)}
              className={`rounded-full px-3 py-1 text-xs font-medium transition ${
                active
                  ? "bg-navy-800 text-white"
                  : "bg-gray-100 text-gray-600 hover:bg-gray-200"
              }`}
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
            const Icon = ICONS[i.category];
            return (
              <li
                key={i.id}
                className="flex gap-3 border-b border-gray-100 py-3 last:border-0"
              >
                <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-brand-blue-50 text-brand-blue-600">
                  <Icon className="h-4 w-4" aria-hidden="true" />
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-start justify-between gap-3">
                    <p className="text-sm font-medium text-gray-900">
                      {i.title}
                      <span className="ml-2 inline-flex items-center rounded-full bg-gray-100 px-2 py-0.5 text-[11px] font-medium text-gray-600">
                        {i.typeLabel}
                      </span>
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
