"use client";

import { type ReactNode } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { UsStateMap } from "./UsStateMap";
import type { GeoSummary, StateCount } from "@/types/geography";

type Row = { key: string; label: string; count: number };

export function GeographyExplorer({
  counts,
  topStates,
  topCities,
  topEmployers,
  topIndustries,
  filterQuery,
  filters,
}: {
  counts: Record<string, number>;
  topStates: StateCount[];
  topCities: GeoSummary["top_cities"];
  topEmployers: GeoSummary["top_employers"];
  topIndustries: GeoSummary["top_industries"];
  filterQuery: string;
  filters: ReactNode;
}) {
  const router = useRouter();
  // Total located alumni = sum across states (matches the per-state page count).
  const totalAlumni = Object.values(counts).reduce((a, b) => a + b, 0);

  // State clicks (map + the "Top states"/"Top cities" rank rows) now open the
  // dedicated centered-map state page, preserving active filters.
  function openState(code: string) {
    router.push(`/map/state/${code.toUpperCase()}?${filterQuery}`.replace(/\?$/, ""));
  }
  function applyFilter(key: string, value: string) {
    const p = new URLSearchParams(filterQuery);
    p.set(key, value);
    router.push(`/map?${p.toString()}`);
  }
  const breakdownHref = (dim: string) =>
    `/map/breakdown/${dim}${filterQuery ? `?${filterQuery}` : ""}`;

  return (
    <div className="grid min-h-0 flex-1 grid-cols-1 gap-4 lg:grid-cols-4 lg:grid-rows-1">
      {/* Map (left, dominant) — filters live in this card */}
      <div className="flex min-h-0 flex-col rounded-xl border border-gray-300 bg-white p-4 lg:col-span-3">
        <div className="mb-2 flex flex-wrap items-end justify-between gap-x-3 gap-y-2">
          {filters}
          <span className="mr-3 shrink-0 self-start text-xl font-semibold text-gray-900">
            {totalAlumni.toLocaleString()} alumni
          </span>
        </div>
        <div className="min-h-0 flex-1">
          <UsStateMap
            fit
            counts={counts}
            selected={null}
            onSelect={openState}
          />
        </div>
      </div>

      {/* Ranking rail (right) — stretched to match the map's height */}
      <div className="flex min-h-0 flex-col gap-4">
        <RankBox
          grow
          title="Top states"
          rows={topStates.map((s) => ({
            key: s.state,
            label: s.state_name,
            count: s.alumni_count,
          }))}
          onRow={(key) => openState(key)}
          moreLabel="View all states"
          moreHref={breakdownHref("states")}
        />
        <RankBox
          grow
          title="Top cities"
          rows={topCities.map((c) => ({
            key: c.state,
            label: `${c.city}, ${c.state}`,
            count: c.count,
          }))}
          onRow={(key) => openState(key)}
          moreLabel="View all cities"
          moreHref={breakdownHref("cities")}
        />
        <RankBox
          grow
          title="Top employers"
          rows={topEmployers.map((e) => ({
            key: e.employer,
            label: e.employer,
            count: e.count,
          }))}
          onRow={(key) => applyFilter("employer", key)}
          moreLabel="View all employers"
          moreHref={breakdownHref("employers")}
        />
        <RankBox
          grow
          title="Top industries"
          rows={topIndustries.map((i) => ({
            key: i.industry,
            label: i.industry,
            count: i.count,
          }))}
          onRow={(key) => applyFilter("industry", key)}
          moreLabel="View all industries"
          moreHref={breakdownHref("industries")}
        />
      </div>
    </div>
  );
}

/* --------------------------------------------------------------- rank box -- */

function RankBox({
  title,
  rows,
  onRow,
  moreLabel,
  moreHref,
  grow = false,
}: {
  title: string;
  rows: Row[];
  onRow: (key: string) => void;
  moreLabel: string;
  moreHref: string;
  grow?: boolean;
}) {
  const shown = rows.slice(0, 5);
  return (
    <section
      className={`flex flex-col rounded-xl border border-gray-300 bg-white p-5 ${grow ? "min-h-0 flex-1" : ""}`}
    >
      <h3 className="mb-3 text-lg font-semibold text-gray-900">{title}</h3>
      {rows.length === 0 ? (
        <p className="py-3 text-sm text-gray-400">No data yet.</p>
      ) : (
        <ul className="min-h-0 flex-1 space-y-2 overflow-hidden">
          {shown.map((r, i) => (
            <li key={`${r.key}-${i}`}>
              <button
                type="button"
                onClick={() => onRow(r.key)}
                className="flex w-full items-center gap-3 rounded-md px-1 py-0.5 text-left hover:bg-gray-50"
              >
                <span className="min-w-0 flex-1 truncate text-sm text-gray-700">
                  {r.label}
                </span>
                <span className="shrink-0 text-right text-sm font-medium tabular-nums text-gray-900">
                  {r.count}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
      {rows.length > 0 ? (
        <Link
          href={moreHref}
          className="mt-3 inline-flex items-center gap-1 self-start text-xs font-medium text-brand-blue-600 hover:text-brand-blue-500"
        >
          {moreLabel} →
        </Link>
      ) : null}
    </section>
  );
}
