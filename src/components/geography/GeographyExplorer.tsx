"use client";

import { type ReactNode } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { UsStateMap } from "./UsStateMap";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
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
      <Card className="flex min-h-0 flex-col p-4 lg:col-span-3">
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
      </Card>

      {/* Ranking rail (right) — boxes size to content so nothing is clipped. */}
      <div className="flex min-h-0 flex-col gap-3">
        <RankBox
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
}: {
  title: string;
  rows: Row[];
  onRow: (key: string) => void;
  moreLabel: string;
  moreHref: string;
}) {
  const shown = rows.slice(0, 5);
  return (
    <Card className="flex flex-col p-3">
      <h3 className="mb-1 text-sm font-semibold text-gray-900">{title}</h3>
      {rows.length === 0 ? (
        <p className="py-1.5 text-sm text-gray-400">No data yet.</p>
      ) : (
        <ul>
          {shown.map((r, i) => (
            <li key={`${r.key}-${i}`}>
              <button
                type="button"
                onClick={() => onRow(r.key)}
                className="flex w-full items-center justify-between gap-2 rounded-md px-1 py-0.5 text-left hover:bg-gray-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-blue-500 focus-visible:ring-offset-1"
              >
                <span className="min-w-0 flex-1 truncate text-sm text-gray-700">
                  {r.label}
                </span>
                <span className="shrink-0 text-right text-xs font-medium tabular-nums text-gray-900">
                  {r.count}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
      {rows.length > 0 ? (
        <Button
          asChild
          variant="link"
          size="sm"
          className="mt-2 h-auto self-start px-0"
        >
          <Link href={moreHref}>{moreLabel}</Link>
        </Button>
      ) : null}
    </Card>
  );
}
