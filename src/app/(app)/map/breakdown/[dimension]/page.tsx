import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { apiGet, ApiError } from "@/lib/api";
import { Topbar } from "@/components/shell/Topbar";
import type { Breakdown } from "@/types/geography";

const FILTER_KEYS = ["employer", "industry", "year", "region", "tag"] as const;
const VALID = ["states", "cities", "employers", "industries"];

type SP = Record<string, string | undefined>;

function filterQs(sp: SP): string {
  const p = new URLSearchParams();
  for (const k of FILTER_KEYS) if (sp[k]) p.set(k, sp[k]!);
  return p.toString();
}

// Where a row links back on the map.
function rowHref(dimension: string, key: string, label: string, qs: string): string {
  const amp = qs ? `${qs}&` : "";
  if (dimension === "states" || dimension === "cities")
    return `/map?${amp}state=${key}`;
  if (dimension === "employers")
    return `/map?${amp}employer=${encodeURIComponent(label)}`;
  return `/map?${amp}industry=${encodeURIComponent(label)}`;
}

export default async function BreakdownPage({
  params,
  searchParams,
}: {
  params: Promise<{ dimension: string }>;
  searchParams: Promise<SP>;
}) {
  const { dimension } = await params;
  if (!VALID.includes(dimension)) notFound();
  const sp = await searchParams;
  const qs = filterQs(sp);

  let data: Breakdown | null = null;
  let notProvisioned = false;
  try {
    data = await apiGet<Breakdown>(
      `/geography/breakdown?dimension=${dimension}&${qs}`,
    );
  } catch (e) {
    if (e instanceof ApiError && e.status === 403) notProvisioned = true;
    else throw e;
  }

  const items = data?.items ?? [];
  const total = items.reduce((sum, i) => sum + i.count, 0);
  const max = Math.max(1, ...items.map((i) => i.count));

  return (
    <>
      <Topbar title="Map" />
      <main className="flex-1 overflow-auto p-6">
        <nav className="mb-4 flex items-center gap-2 text-sm">
          <Link
            href={`/map${qs ? `?${qs}` : ""}`}
            className="flex items-center gap-1 text-gray-500 hover:text-brand-blue-600"
          >
            <ChevronLeft className="h-4 w-4" /> Map
          </Link>
          <span className="text-gray-300">/</span>
          <span className="font-medium text-gray-900">
            All {data?.title ?? dimension}
          </span>
        </nav>

        {notProvisioned ? (
          <div className="rounded-xl border border-gray-300 bg-white p-4 text-sm text-gray-700">
            Your account is authenticated but not yet provisioned.
          </div>
        ) : (
          <div className="mx-auto max-w-3xl">
            <div className="mb-4 flex items-end justify-between">
              <div>
                <h2 className="text-2xl font-semibold text-gray-900">
                  {data?.title ?? "Breakdown"}
                </h2>
                <p className="text-sm text-gray-500">
                  {items.length} {dimension} · {total.toLocaleString()} alumni
                </p>
              </div>
            </div>

            {items.length === 0 ? (
              <div className="rounded-xl border border-gray-300 bg-white p-10 text-center text-sm text-gray-500">
                No data for this breakdown.
              </div>
            ) : (
              <div className="overflow-hidden rounded-xl border border-gray-300 bg-white">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-300 bg-gray-50 text-left text-[11px] font-semibold uppercase tracking-wide text-gray-500">
                      <th className="w-12 px-4 py-3">#</th>
                      <th className="px-4 py-3">{data?.title?.slice(0, -1)}</th>
                      <th className="w-40 px-4 py-3">Share</th>
                      <th className="w-24 px-4 py-3 text-right">Alumni</th>
                    </tr>
                  </thead>
                  <tbody>
                    {items.map((i, idx) => (
                      <tr
                        key={`${i.key}-${i.label}-${idx}`}
                        className="border-b border-gray-300 last:border-0 hover:bg-brand-blue-50/40"
                      >
                        <td className="px-4 py-3 tabular-nums text-gray-400">
                          {idx + 1}
                        </td>
                        <td className="px-4 py-3">
                          <Link
                            href={rowHref(dimension, i.key, i.label, qs)}
                            className="font-medium text-gray-900 hover:text-brand-blue-600"
                          >
                            {i.label}
                            {i.sublabel && i.sublabel !== i.label ? (
                              <span className="font-normal text-gray-500">
                                {" "}
                                · {i.sublabel}
                              </span>
                            ) : null}
                          </Link>
                        </td>
                        <td className="px-4 py-3">
                          <div className="h-2 w-full overflow-hidden rounded-full bg-gray-100">
                            <div
                              className="h-full rounded-full bg-brand-blue-600"
                              style={{
                                width: `${Math.round((i.count / max) * 100)}%`,
                              }}
                            />
                          </div>
                        </td>
                        <td className="px-4 py-3 text-right font-medium tabular-nums text-gray-900">
                          {i.count.toLocaleString()}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </main>
    </>
  );
}
