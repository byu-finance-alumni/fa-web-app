/**
 * Types for the Pay It Forward Fund (#161). Mirror the dict payloads from the
 * backend donations endpoints (plain dicts, not in api.gen.ts). Dollar amount
 * fields are `number | null` — the backend nulls them server-side for callers
 * without amount-view permission (full_access+), so the UI must treat `null` as
 * "withheld", not "$0". Keep in sync with fa-web-api/app/api/routes/donations.py.
 */

export interface DonorYear {
  year: number;
  /** Total given that year. `null` when the caller may not see amounts. */
  total: number | null;
}

export interface Donor {
  alumni_id: number;
  name: string;
  graduation_year: number | null;
  donation_count: number;
  /** Years in which this donor gave (visible to all roles). */
  years: number[];
  /** Lifetime total. `null` when amounts are withheld. */
  lifetime_total: number | null;
  per_year: DonorYear[];
}

export interface DonationsSummary {
  /** Public counts (visible to all roles). */
  donor_count: number;
  donation_count: number;
  /** `null` when amounts are withheld. */
  total_raised: number | null;
  per_year: {
    year: number;
    donor_count: number;
    total: number | null;
  }[];
}

/** One donation entry (GET /donations/alumni/{id}). `amount`/`notes` are null
 *  when the caller may not see amounts (gated server-side). */
export interface DonationEntry {
  donation_id: number;
  year: number;
  month: number | null;
  amount: number | null;
  notes: string | null;
}

/** A single alumnus's donation history (GET /donations/alumni/{id}). */
export interface AlumniDonations {
  alumni_id: number;
  name: string;
  donation_count: number;
  lifetime_total: number | null;
  donations: DonationEntry[];
}

export interface DonationImportRow {
  row: number;
  mstid: string;
  name: string;
  /** How the donor was resolved: "mstid" (high-confidence) or "name" (fallback,
   *  worth a glance). null when the row was rejected. */
  match_method: "mstid" | "name" | null;
  month: number | null;
  year: number | null;
  amount: number | null;
  status: "importable" | "rejected";
  blockers: { code: string; message: string }[];
  warnings: { code: string; message: string }[];
}

export interface DonationImportPreview {
  columns_ok: boolean;
  header_errors: string[];
  summary: { total: number; importable: number; rejected: number };
  rows: DonationImportRow[];
}

export interface DonationImportResult {
  imported: number;
  skipped: number;
  rejects: { row: number; name: string; reason: string }[];
}
