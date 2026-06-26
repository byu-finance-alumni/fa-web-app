"use client";

import { Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { components } from "@/types/api.gen";

type RadiusAlumniRow = components["schemas"]["RadiusAlumniRow"];

/** Quote a CSV field per RFC 4180 (wrap + double inner quotes when needed). */
function csvCell(value: string | number | null | undefined): string {
  if (value === null || value === undefined) return "";
  const s = String(value);
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

/**
 * Downloads the CURRENTLY DISPLAYED radius results as a CSV, built entirely
 * client-side from the rows (no server export endpoint). Columns: name, city,
 * state, grad year, employer, title, distance_miles.
 */
export function RadiusExportButton({
  items,
  place,
  miles,
}: {
  items: RadiusAlumniRow[];
  place?: string;
  miles: number;
}) {
  function onExport() {
    const header = [
      "name",
      "city",
      "state",
      "graduation_year",
      "current_employer",
      "current_title",
      "distance_miles",
    ];
    const rows = items.map((r) =>
      [
        r.name,
        r.city,
        r.state,
        r.graduation_year,
        r.current_employer,
        r.current_title,
        r.distance_miles.toFixed(1),
      ]
        .map(csvCell)
        .join(","),
    );
    const csv = [header.join(","), ...rows].join("\r\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);

    const slug = (place ?? "radius")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "");
    const a = document.createElement("a");
    a.href = url;
    a.download = `alumni-within-${miles}mi-${slug || "center"}.csv`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }

  return (
    <Button
      type="button"
      variant="secondary"
      size="sm"
      onClick={onExport}
      disabled={items.length === 0}
    >
      <Download className="h-4 w-4" aria-hidden="true" />
      Export CSV
    </Button>
  );
}
