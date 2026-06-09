"use client";

import { useEffect, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { X, ArrowLeft, ChevronRight, AlertTriangle } from "lucide-react";
import { clientGet } from "@/lib/api-client";
import { UsStateMap } from "./UsStateMap";
import type {
  CityDetail,
  GeoAlumniPage,
  GeoSummary,
  StateCount,
  StateDetail,
} from "@/types/geography";

const LIMIT = 50;

type Row = { key: string; label: string; count: number };

export function GeographyExplorer({
  counts,
  topStates,
  topCities,
  topEmployers,
  topIndustries,
  filterQuery,
  initialState,
  filters,
}: {
  counts: Record<string, number>;
  topStates: StateCount[];
  topCities: GeoSummary["top_cities"];
  topEmployers: GeoSummary["top_employers"];
  topIndustries: GeoSummary["top_industries"];
  filterQuery: string;
  initialState: string | null;
  filters: ReactNode;
}) {
  const router = useRouter();
  const [state, setState] = useState<string | null>(initialState);
  const [city, setCity] = useState<string | null>(null);
  const [detail, setDetail] = useState<StateDetail | null>(null);
  const [alumni, setAlumni] = useState<GeoAlumniPage | null>(null);
  const [cityDetail, setCityDetail] = useState<CityDetail | null>(null);
  const [offset, setOffset] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);

  const fq = filterQuery ? `${filterQuery}&` : "";

  useEffect(() => {
    if (!state || city) return;
    let cancelled = false;
    setLoading(true);
    setError(false);
    Promise.all([
      clientGet<StateDetail>(`/geography/states/${state}?${filterQuery}`),
      clientGet<GeoAlumniPage>(
        `/geography/states/${state}/alumni?${fq}sort=name&limit=${LIMIT}&offset=${offset}`,
      ),
    ])
      .then(([d, a]) => {
        if (!cancelled) {
          setDetail(d);
          setAlumni(a);
        }
      })
      .catch(() => {
        // Surface a real error state instead of an indefinite "…" placeholder
        // (the deployed client fetch can reject on network/CORS/expired token).
        if (!cancelled) setError(true);
      })
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [state, city, offset, filterQuery, fq, reloadKey]);

  useEffect(() => {
    if (!state || !city) return;
    let cancelled = false;
    setLoading(true);
    setError(false);
    clientGet<CityDetail>(
      `/geography/cities?state=${state}&city=${encodeURIComponent(city)}&${filterQuery}`,
    )
      .then((d) => !cancelled && setCityDetail(d))
      .catch(() => {
        if (!cancelled) setError(true);
      })
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [state, city, filterQuery, reloadKey]);

  function openState(code: string) {
    setCity(null);
    setCityDetail(null);
    setOffset(0);
    setDetail(null);
    setAlumni(null);
    setError(false);
    setState(code);
  }
  function close() {
    setState(null);
    setCity(null);
    setDetail(null);
    setAlumni(null);
    setCityDetail(null);
    setError(false);
  }
  function applyFilter(key: string, value: string) {
    const p = new URLSearchParams(filterQuery);
    p.set(key, value);
    router.push(`/map?${p.toString()}`);
  }
  const breakdownHref = (dim: string) =>
    `/map/breakdown/${dim}${filterQuery ? `?${filterQuery}` : ""}`;

  return (
    <>
      <div className="grid min-h-0 flex-1 grid-cols-1 gap-4 lg:grid-cols-4 lg:grid-rows-1">
        {/* Map (left, dominant) — filters live in this card */}
        <div className="flex min-h-0 flex-col rounded-xl border border-gray-300 bg-white p-4 lg:col-span-3">
          <div className="mb-2 flex flex-wrap items-end gap-2">{filters}</div>
          <div className="min-h-0 flex-1">
            <UsStateMap
              fit
              counts={counts}
              selected={state}
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

      {state ? (
        <Drawer
          loading={loading}
          error={error}
          stateLabel={
            topStates.find((s) => s.state === state)?.state_name ??
            state ??
            "State"
          }
          city={city}
          detail={detail}
          alumni={alumni}
          cityDetail={cityDetail}
          offset={offset}
          onRetry={() => {
            setError(false);
            setReloadKey((k) => k + 1);
          }}
          onClose={close}
          onCity={(c) => {
            setCityDetail(null);
            setCity(c);
          }}
          onBack={() => {
            setCity(null);
            setCityDetail(null);
          }}
          onPage={setOffset}
        />
      ) : null}
    </>
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
  const max = Math.max(1, ...rows.map((r) => r.count));
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
                <span className="w-28 shrink-0 truncate text-sm text-gray-700">
                  {r.label}
                </span>
                <div className="h-2 flex-1 overflow-hidden rounded-full bg-gray-100">
                  <div
                    className="h-full rounded-full bg-brand-blue-600"
                    style={{ width: `${Math.round((r.count / max) * 100)}%` }}
                  />
                </div>
                <span className="w-8 shrink-0 text-right text-sm font-medium tabular-nums text-gray-900">
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

/* ----------------------------------------------------------------- drawer -- */

function Drawer({
  loading,
  error,
  stateLabel,
  city,
  detail,
  alumni,
  cityDetail,
  offset,
  onClose,
  onCity,
  onBack,
  onPage,
  onRetry,
}: {
  loading: boolean;
  error: boolean;
  stateLabel: string;
  city: string | null;
  detail: StateDetail | null;
  alumni: GeoAlumniPage | null;
  cityDetail: CityDetail | null;
  offset: number;
  onClose: () => void;
  onCity: (city: string) => void;
  onBack: () => void;
  onPage: (offset: number) => void;
  onRetry: () => void;
}) {
  return (
    <>
      <button
        type="button"
        aria-label="Close"
        onClick={onClose}
        className="fixed inset-0 z-30 cursor-default bg-navy-900/30"
      />
      <aside className="fixed inset-y-0 right-0 z-40 flex w-full flex-col bg-gray-100 shadow-xl sm:w-[440px]">
        {city && cityDetail ? (
          <Header
            title={`${cityDetail.city}, ${cityDetail.state}`}
            subtitle={`${cityDetail.alumni_count.toLocaleString()} alumni`}
            onClose={onClose}
            onBack={onBack}
          />
        ) : (
          <Header
            title={detail?.state_name ?? stateLabel}
            subtitle={
              detail
                ? `${detail.alumni_count.toLocaleString()} alumni`
                : error
                  ? "Couldn’t load details"
                  : "Loading…"
            }
            onClose={onClose}
          />
        )}

        <div className="flex-1 space-y-4 overflow-auto p-5">
          {error && !detail && !cityDetail ? (
            <DrawerError onRetry={onRetry} />
          ) : loading && !detail && !cityDetail ? (
            <DrawerSkeleton />
          ) : city && cityDetail ? (
            <>
              <Mini title="Employers" rows={cityDetail.employers.map((e) => [e.employer, e.count])} />
              <Mini title="Industries" rows={cityDetail.industries.map((i) => [i.industry, i.count])} />
              <Mini title="By graduation year" rows={cityDetail.by_graduation_year.map((y) => [String(y.year), y.count])} />
              <AlumniList rows={cityDetail.alumni.map((a) => ({ id: a.alumni_id, name: a.name, meta: [a.current_employer, a.graduation_year ? `'${String(a.graduation_year).slice(-2)}` : null] }))} />
            </>
          ) : detail ? (
            <>
              <Mini title="Top cities" rows={detail.cities.map((c) => [c.city, c.count])} onRow={(label) => onCity(label)} />
              <Mini title="Top employers" rows={detail.employers.map((e) => [e.employer, e.count])} />
              <Mini title="Top industries" rows={detail.industries.map((i) => [i.industry, i.count])} />
              <Mini title="By graduation year" rows={detail.by_graduation_year.map((y) => [String(y.year), y.count])} />
              <div className="rounded-xl border border-gray-300 bg-white p-4">
                <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-500">
                  Alumni
                </p>
                {alumni && alumni.items.length > 0 ? (
                  <>
                    <AlumniList
                      rows={alumni.items.map((a) => ({
                        id: a.alumni_id,
                        name: a.name,
                        meta: [a.current_title, a.current_employer, a.city],
                      }))}
                      bare
                    />
                    <div className="mt-3 flex items-center justify-between text-sm">
                      <span className="text-gray-500">
                        {offset + 1}–{Math.min(offset + LIMIT, alumni.total)} of{" "}
                        {alumni.total}
                      </span>
                      <div className="flex gap-2">
                        <PageBtn
                          enabled={offset > 0}
                          onClick={() => onPage(Math.max(0, offset - LIMIT))}
                          label="‹ Prev"
                        />
                        <PageBtn
                          enabled={offset + LIMIT < alumni.total}
                          onClick={() => onPage(offset + LIMIT)}
                          label="Next ›"
                        />
                      </div>
                    </div>
                  </>
                ) : (
                  <p className="py-3 text-sm text-gray-400">No alumni found.</p>
                )}
              </div>
            </>
          ) : null}
        </div>
      </aside>
    </>
  );
}

function Header({
  title,
  subtitle,
  onClose,
  onBack,
}: {
  title: string;
  subtitle: string;
  onClose: () => void;
  onBack?: () => void;
}) {
  return (
    <div className="flex items-start justify-between gap-3 border-b border-gray-300 bg-white p-5">
      <div className="min-w-0">
        {onBack ? (
          <button
            type="button"
            onClick={onBack}
            className="mb-1 inline-flex items-center gap-1 text-xs font-medium text-brand-blue-600 hover:text-brand-blue-500"
          >
            <ArrowLeft className="h-3.5 w-3.5" /> Back to state
          </button>
        ) : null}
        <h3 className="truncate text-xl font-semibold text-gray-900">{title}</h3>
        <p className="text-sm text-gray-500">{subtitle}</p>
      </div>
      <button
        type="button"
        onClick={onClose}
        aria-label="Close"
        className="rounded-lg border border-gray-300 bg-white p-1.5 text-gray-500 hover:bg-gray-50"
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}

function Mini({
  title,
  rows,
  onRow,
}: {
  title: string;
  rows: [string, number][];
  onRow?: (label: string) => void;
}) {
  if (rows.length === 0) return null;
  return (
    <div className="rounded-xl border border-gray-300 bg-white p-4">
      <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-500">
        {title}
      </p>
      <ul className="space-y-1.5">
        {rows.map(([label, count]) => {
          const body = (
            <div className="flex items-center justify-between gap-2 text-sm">
              <span className="truncate text-gray-700">{label}</span>
              <span className="flex shrink-0 items-center gap-1 font-medium tabular-nums text-gray-900">
                {count}
                {onRow ? <ChevronRight className="h-3.5 w-3.5 text-gray-400" /> : null}
              </span>
            </div>
          );
          return (
            <li key={label}>
              {onRow ? (
                <button
                  type="button"
                  onClick={() => onRow(label)}
                  className="block w-full rounded px-1 text-left hover:bg-gray-50"
                >
                  {body}
                </button>
              ) : (
                body
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function AlumniList({
  rows,
  bare = false,
}: {
  rows: { id: number; name: string; meta: (string | null)[] }[];
  bare?: boolean;
}) {
  const list = (
    <ul className="divide-y divide-gray-100">
      {rows.map((a) => (
        <li key={a.id} className="py-2">
          <Link href={`/alumni/${a.id}`} className="block hover:opacity-80">
            <p className="text-sm font-medium text-gray-900">{a.name}</p>
            <p className="text-xs text-gray-500">
              {a.meta.filter(Boolean).join(" · ") || "—"}
            </p>
          </Link>
        </li>
      ))}
    </ul>
  );
  if (bare) return rows.length ? list : <p className="py-3 text-sm text-gray-400">No alumni found.</p>;
  return (
    <div className="rounded-xl border border-gray-300 bg-white p-4">
      <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-500">
        Alumni
      </p>
      {rows.length ? list : <p className="py-3 text-sm text-gray-400">No alumni found.</p>}
    </div>
  );
}

function PageBtn({
  enabled,
  onClick,
  label,
}: {
  enabled: boolean;
  onClick: () => void;
  label: string;
}) {
  return (
    <button
      type="button"
      disabled={!enabled}
      onClick={onClick}
      className="rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-sm font-medium text-gray-700 enabled:hover:bg-gray-50 disabled:text-gray-300"
    >
      {label}
    </button>
  );
}

function DrawerError({ onRetry }: { onRetry: () => void }) {
  return (
    <div className="rounded-xl border border-danger-600/20 bg-danger-50 p-5 text-center">
      <AlertTriangle className="mx-auto mb-2 h-6 w-6 text-danger-600" />
      <p className="text-sm font-semibold text-gray-900">
        Couldn’t load this state
      </p>
      <p className="mt-1 text-sm text-gray-500">
        Something went wrong fetching the details. Please try again.
      </p>
      <button
        type="button"
        onClick={onRetry}
        className="mt-3 rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50"
      >
        Try again
      </button>
    </div>
  );
}

function DrawerSkeleton() {
  return (
    <div className="space-y-4">
      {Array.from({ length: 3 }).map((_, i) => (
        <div
          key={i}
          className="h-28 animate-pulse rounded-xl border border-gray-300 bg-white"
        />
      ))}
    </div>
  );
}
