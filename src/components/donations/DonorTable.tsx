"use client";

import { useState } from "react";
import Link from "next/link";
import { Card } from "@/components/ui/card";
import type { Donor } from "@/types/donations";

function money(value: number | null): string {
  if (value === null) return "—";
  return value.toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  });
}

/**
 * Donor list with an expandable per-year breakdown. Names + the years a donor
 * gave are always shown; the Lifetime and per-year amount columns render "—"
 * when amounts are withheld (showAmounts=false), since the backend sends null.
 */
export function DonorTable({
  donors,
  showAmounts,
}: {
  donors: Donor[];
  showAmounts: boolean;
}) {
  const [open, setOpen] = useState<Set<number>>(new Set());
  const toggle = (id: number) =>
    setOpen((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  return (
    <Card className="overflow-hidden p-0">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-gray-200 bg-gray-50 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">
            <th className="px-4 py-2.5">Donor</th>
            <th className="px-4 py-2.5">Years given</th>
            <th className="px-4 py-2.5 text-right">Gifts</th>
            <th className="px-4 py-2.5 text-right">Lifetime</th>
            <th className="px-4 py-2.5" aria-label="Expand" />
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100">
          {donors.map((d) => {
            const isOpen = open.has(d.alumni_id);
            return (
              <DonorRows
                key={d.alumni_id}
                donor={d}
                isOpen={isOpen}
                onToggle={() => toggle(d.alumni_id)}
                showAmounts={showAmounts}
              />
            );
          })}
        </tbody>
      </table>
    </Card>
  );
}

function DonorRows({
  donor,
  isOpen,
  onToggle,
  showAmounts,
}: {
  donor: Donor;
  isOpen: boolean;
  onToggle: () => void;
  showAmounts: boolean;
}) {
  const years = donor.years.length ? donor.years.join(", ") : "—";
  return (
    <>
      <tr className="hover:bg-gray-50">
        <td className="px-4 py-2.5">
          <Link
            href={`/alumni/${donor.alumni_id}`}
            className="font-medium text-brand-blue-600 hover:underline"
          >
            {donor.name}
          </Link>
          {donor.graduation_year ? (
            <span className="ml-2 text-xs text-gray-400">
              Class of {donor.graduation_year}
            </span>
          ) : null}
        </td>
        <td className="px-4 py-2.5 text-gray-700">{years}</td>
        <td className="px-4 py-2.5 text-right tabular-nums text-gray-700">
          {donor.donation_count}
        </td>
        <td
          className={`px-4 py-2.5 text-right tabular-nums ${
            showAmounts ? "font-semibold text-gray-900" : "text-gray-400"
          }`}
        >
          {money(donor.lifetime_total)}
        </td>
        <td className="px-4 py-2.5 text-right">
          {donor.per_year.length > 0 && (
            <button
              type="button"
              onClick={onToggle}
              aria-expanded={isOpen}
              className="text-xs font-semibold text-brand-blue-600 hover:underline"
            >
              {isOpen ? "Hide" : "By year"}
            </button>
          )}
        </td>
      </tr>
      {isOpen &&
        donor.per_year.map((py) => (
          <tr key={py.year} className="bg-gray-50/60">
            <td className="px-4 py-1.5 pl-8 text-xs text-gray-500" colSpan={3}>
              {py.year}
            </td>
            <td
              className={`px-4 py-1.5 text-right text-xs tabular-nums ${
                showAmounts ? "text-gray-700" : "text-gray-400"
              }`}
            >
              {money(py.total)}
            </td>
            <td />
          </tr>
        ))}
    </>
  );
}
