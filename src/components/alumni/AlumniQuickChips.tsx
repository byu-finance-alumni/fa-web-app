"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { Check } from "lucide-react";
import { Chip } from "@/components/ui/chip";
import type { FilterOptions } from "@/types/filters";
import type { AlumniFilterState } from "@/components/alumni/AlumniFilters";

/**
 * Quick-filter chips above the alumni table. These are a fast, one-click layer
 * that COMPLEMENTS (never replaces) the full Filters slide-over: the most common
 * Industry / Grad-year / Region (state) / Status values surface as toggle chips
 * that mirror the same URL params the advanced panel writes, so a chip and the
 * panel agree and either can clear the other's selection.
 *
 * Chip values are drawn only from real backend data (`GET /alumni/filter-options`
 * for industries / states / status labels; the grad-year facet from the same
 * source) — nothing is fabricated. Toggling a chip navigates to the canonical
 * /alumni query string; the active state is derived from the current parsed
 * filters passed down from the server page.
 */

/** Canonical serializer — mirrors AlumniFilters.toQs param names so chips and the
 *  advanced panel write the same URL shape (one source of truth). */
function toQs(f: AlumniFilterState): string {
  const p = new URLSearchParams();
  if (f.q.trim()) p.set("q", f.q.trim());
  if (f.ymin.trim()) p.set("ymin", f.ymin.trim());
  if (f.ymax.trim()) p.set("ymax", f.ymax.trim());
  const appendAll = (name: string, values: string[]) => {
    for (const v of values) p.append(name, v);
  };
  appendAll("past_employer", f.pastEmployer);
  appendAll("industry", f.industry);
  appendAll("title", f.title);
  appendAll("seniority", f.seniority);
  appendAll("city", f.city);
  appendAll("state", f.state);
  appendAll("tag", f.tag);
  appendAll("status_label", f.statusLabel);
  appendAll("leadership_role", f.leadership);
  appendAll("survey_status", f.surveyStatus);
  if (f.contactedAfter) p.set("contacted_after", f.contactedAfter);
  if (f.contactedBefore) p.set("contacted_before", f.contactedBefore);
  if (f.neverContacted) p.set("never_contacted", "1");
  if (f.attended) p.set("attended", "1");
  if (f.donor) p.set("donor", "1");
  if (f.mentor) p.set("mentor", "1");
  if (f.speaker) p.set("speaker", "1");
  if (f.cfa) p.set("cfa", "1");
  if (f.cpa) p.set("cpa", "1");
  if (f.archived) p.set("archived", "1");
  if (f.deceased === "only") p.set("deceased", "1");
  if (f.deceased === "exclude") p.set("deceased", "0");
  if (f.missingEmail) p.set("missing_email", "1");
  if (f.missingEmployer) p.set("missing_employer", "1");
  if (f.duplicate) p.set("duplicate", "1");
  if (f.sort && f.sort !== "name") p.set("sort", f.sort);
  return p.toString();
}

/** Toggle one value within a multi-select facet array. */
function toggleValue(values: string[], value: string): string[] {
  return values.includes(value)
    ? values.filter((v) => v !== value)
    : [...values, value];
}

/** How many leading values to surface per facet so the row stays scannable. */
const MAX_PER_FACET = 4;

export function AlumniQuickChips({
  filters,
  options,
}: {
  filters: AlumniFilterState;
  options?: FilterOptions;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  if (!options) return null;

  const navigate = (next: AlumniFilterState) => {
    const qs = toQs(next);
    startTransition(() => {
      router.push(qs ? `/alumni?${qs}` : "/alumni");
    });
  };

  // Build the chip groups from real option lists only.
  const industries = (options.industries ?? []).slice(0, MAX_PER_FACET);
  const states = (options.states ?? []).slice(0, MAX_PER_FACET);
  const statusLabels = (options.status_labels ?? []).slice(0, MAX_PER_FACET);
  // Most-recent grad years first (the backend returns them; sort desc to lead
  // with the newest cohorts staff filter by most often).
  const gradYears = [...(options.graduation_years ?? [])]
    .sort((a, b) => b - a)
    .slice(0, MAX_PER_FACET);

  type ChipDef = { key: string; label: string; active: boolean; next: AlumniFilterState };

  const groups: { heading: string; chips: ChipDef[] }[] = [];

  if (industries.length) {
    groups.push({
      heading: "Industry",
      chips: industries.map((v) => ({
        key: `industry-${v}`,
        label: v,
        active: filters.industry.includes(v),
        next: { ...filters, industry: toggleValue(filters.industry, v) },
      })),
    });
  }

  if (gradYears.length) {
    groups.push({
      heading: "Grad year",
      chips: gradYears.map((y) => {
        const ys = String(y);
        // A grad-year chip selects an exact year (ymin === ymax === year);
        // toggling it off clears the range.
        const active = filters.ymin === ys && filters.ymax === ys;
        return {
          key: `grad-${ys}`,
          label: ys,
          active,
          next: active
            ? { ...filters, ymin: "", ymax: "" }
            : { ...filters, ymin: ys, ymax: ys },
        };
      }),
    });
  }

  if (states.length) {
    groups.push({
      heading: "Region",
      chips: states.map((v) => ({
        key: `state-${v}`,
        label: v,
        active: filters.state.includes(v),
        next: { ...filters, state: toggleValue(filters.state, v) },
      })),
    });
  }

  if (statusLabels.length) {
    groups.push({
      heading: "Status",
      chips: statusLabels.map((v) => ({
        key: `status-${v}`,
        label: v,
        active: filters.statusLabel.includes(v),
        next: { ...filters, statusLabel: toggleValue(filters.statusLabel, v) },
      })),
    });
  }

  if (groups.length === 0) return null;

  return (
    <div
      className="mb-3 flex flex-wrap items-center gap-x-4 gap-y-2"
      aria-busy={isPending}
    >
      {groups.map((group) => (
        <div key={group.heading} className="flex flex-wrap items-center gap-1.5">
          <span className="text-xs font-semibold uppercase tracking-wide text-gray-400">
            {group.heading}
          </span>
          {group.chips.map((chip) => (
            <Chip
              key={chip.key}
              type="button"
              active={chip.active}
              aria-pressed={chip.active}
              onClick={() => navigate(chip.next)}
            >
              {chip.active ? <Check aria-hidden="true" /> : null}
              {chip.label}
            </Chip>
          ))}
        </div>
      ))}
    </div>
  );
}
