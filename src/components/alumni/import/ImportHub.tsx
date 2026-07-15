"use client";

import { useState } from "react";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { ImportWizard } from "@/components/alumni/import/ImportWizard";
import { PhotoImportWizard } from "@/components/alumni/import/PhotoImportWizard";
import { DonationsImportWizard } from "@/components/donations/DonationsImportWizard";

type ImportType = "alumni" | "friends" | "photos" | "pay-it-forward";

type Option = {
  value: ImportType;
  label: string;
  description: string;
};

const ALL_OPTIONS: Option[] = [
  {
    value: "alumni",
    label: "CSV — Alumni",
    description: "Bulk-add or update alumni from a spreadsheet.",
  },
  {
    value: "friends",
    label: "CSV — Friends",
    description:
      "Bulk-add or update non-alumni friends of the program from a spreadsheet.",
  },
  {
    value: "photos",
    label: "Photos",
    description:
      "Mass-upload headshots, matched to alumni by the net ID in each filename.",
  },
  {
    value: "pay-it-forward",
    label: "Pay It Forward",
    description: "Bulk-add Pay It Forward donations from a spreadsheet.",
  },
];

/**
 * Import hub (#401). A single entry point that first asks the user which KIND of
 * import to run, then renders the matching wizard inline. Preserves the existing
 * CSV import behavior — it's simply reached by picking "CSV — Alumni".
 *
 * The option list is filtered by role so a user never picks an import the
 * backend would 403: CSV/Friends/Photos need full_access+; Pay It Forward
 * (donations) needs super_admin, matching the donations import gate. The backend
 * re-enforces every one of these on each request.
 */
export function ImportHub({
  canFullAccess,
  canDonations,
}: {
  /** engineer / super_admin / full_access — the CSV, Friends, and Photos imports. */
  canFullAccess: boolean;
  /** engineer / super_admin — the Pay It Forward (donations) import. */
  canDonations: boolean;
}) {
  const options = ALL_OPTIONS.filter((o) => {
    if (o.value === "pay-it-forward") return canDonations;
    return canFullAccess;
  });

  const [selected, setSelected] = useState<ImportType>(
    options[0]?.value ?? "alumni",
  );
  const current = options.find((o) => o.value === selected) ?? options[0];

  return (
    <div className="mx-auto max-w-5xl">
      <div className="mb-6 max-w-md">
        <Label htmlFor="import-type" className="mb-1.5">
          What do you want to import?
        </Label>
        <Select
          id="import-type"
          value={selected}
          onChange={(e) => setSelected(e.target.value as ImportType)}
        >
          {options.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </Select>
        {current && (
          <p className="mt-1.5 text-xs text-gray-500">{current.description}</p>
        )}
      </div>

      {selected === "alumni" && <ImportWizard kind="alumni" />}
      {selected === "friends" && <ImportWizard kind="friend" />}
      {selected === "photos" && <PhotoImportWizard />}
      {selected === "pay-it-forward" && <DonationsImportWizard />}
    </div>
  );
}
