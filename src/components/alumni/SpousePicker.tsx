"use client";

import { useEffect, useRef, useState } from "react";
import { clientGet, ApiClientError } from "@/lib/api-client";
import type { AlumniPage, Alumni } from "@/types/alumni";

/**
 * Spouse subsection of the alumni form.
 *
 * Two independent things:
 *   1. Free-text spouse name + birthday (always available).
 *   2. An optional link to ANOTHER alumni record, for when the spouse is also an
 *      alumnus. Searching and selecting a match stores that alumnus's id in a
 *      hidden `spouse_alumni_id` input (and fills the name fields from the
 *      match). Unlinking clears the id but leaves the typed name in place.
 *
 * Inputs are controlled here (so selecting a match can update the name fields),
 * but they carry the same `name` attributes the rest of the uncontrolled form
 * uses, so they serialize into the same FormData on submit.
 */

const BASE_INPUT =
  "w-full rounded-lg border bg-white px-3 py-2.5 text-sm text-gray-900 focus:outline-none focus:ring-2";

function inputClasses(hasError: boolean): string {
  return `${BASE_INPUT} ${
    hasError
      ? "border-danger-600 focus:ring-danger-600"
      : "border-gray-300 focus:ring-brand-blue-500"
  }`;
}

function displayName(a: Pick<Alumni, "preferred_first_name" | "first_name" | "last_name">): string {
  const first = a.preferred_first_name || a.first_name || "";
  return [first, a.last_name].filter(Boolean).join(" ").trim();
}

export type SpouseDefaults = {
  spouse_first_name?: string | null;
  spouse_last_name?: string | null;
  spouse_birth_date?: string | null;
  spouse_alumni_id?: number | null;
  spouse_alumni_name?: string | null;
};

export function SpousePicker({
  defaults,
  errors,
  selfId,
}: {
  defaults?: SpouseDefaults;
  errors?: Record<string, string>;
  /** The alumnus being edited — excluded from results (can't be their own spouse). */
  selfId?: number;
}) {
  const [firstName, setFirstName] = useState(defaults?.spouse_first_name ?? "");
  const [lastName, setLastName] = useState(defaults?.spouse_last_name ?? "");
  const [linkedId, setLinkedId] = useState<number | null>(
    defaults?.spouse_alumni_id ?? null,
  );
  const [linkedName, setLinkedName] = useState<string>(
    defaults?.spouse_alumni_name ??
      [defaults?.spouse_first_name, defaults?.spouse_last_name]
        .filter(Boolean)
        .join(" ") ??
      "",
  );

  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Alumni[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const boxRef = useRef<HTMLDivElement>(null);

  // Debounced typeahead against the existing alumni search endpoint.
  useEffect(() => {
    const q = query.trim();
    if (q.length < 2) {
      setResults([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    const t = setTimeout(async () => {
      try {
        const page = await clientGet<AlumniPage>(
          `/alumni?q=${encodeURIComponent(q)}&limit=8`,
        );
        setResults(page.items.filter((a) => a.alumni_id !== selfId));
        setOpen(true);
      } catch (e) {
        // A failed lookup just shows no matches; the user can still type a name.
        if (!(e instanceof ApiClientError)) console.error(e);
        setResults([]);
      } finally {
        setLoading(false);
      }
    }, 250);
    return () => clearTimeout(t);
  }, [query, selfId]);

  // Close the dropdown on outside click.
  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  function selectMatch(a: Alumni) {
    setLinkedId(a.alumni_id);
    setLinkedName(displayName(a));
    setFirstName(a.preferred_first_name || a.first_name || "");
    setLastName(a.last_name || "");
    setQuery("");
    setResults([]);
    setOpen(false);
  }

  function unlink() {
    setLinkedId(null);
    setLinkedName("");
  }

  const labelCls = "mb-1.5 block text-xs font-medium text-gray-700";

  return (
    <div className="space-y-4 rounded-xl border border-gray-200 bg-gray-50/60 p-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-gray-900">Spouse</h3>
        {linkedId !== null ? (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-brand-blue-50 px-2.5 py-1 text-xs font-medium text-brand-blue-700">
            Linked: {linkedName || `#${linkedId}`}
            <button
              type="button"
              onClick={unlink}
              className="text-brand-blue-700 hover:text-brand-blue-900"
              aria-label="Unlink spouse"
            >
              ✕
            </button>
          </span>
        ) : null}
      </div>

      {/* Hidden field carrying the linked alumni id into the form submit. */}
      <input type="hidden" name="spouse_alumni_id" value={linkedId ?? ""} />

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label htmlFor="spouse_first_name" className={labelCls}>
            Spouse first name
          </label>
          <input
            id="spouse_first_name"
            name="spouse_first_name"
            value={firstName}
            onChange={(e) => setFirstName(e.target.value)}
            aria-invalid={errors?.spouse_first_name ? true : undefined}
            className={inputClasses(!!errors?.spouse_first_name)}
          />
          {errors?.spouse_first_name ? (
            <p className="mt-1 text-xs text-danger-600">
              {errors.spouse_first_name}
            </p>
          ) : null}
        </div>
        <div>
          <label htmlFor="spouse_last_name" className={labelCls}>
            Spouse last name
          </label>
          <input
            id="spouse_last_name"
            name="spouse_last_name"
            value={lastName}
            onChange={(e) => setLastName(e.target.value)}
            aria-invalid={errors?.spouse_last_name ? true : undefined}
            className={inputClasses(!!errors?.spouse_last_name)}
          />
          {errors?.spouse_last_name ? (
            <p className="mt-1 text-xs text-danger-600">
              {errors.spouse_last_name}
            </p>
          ) : null}
        </div>
      </div>

      <div>
        <label htmlFor="spouse_birth_date" className={labelCls}>
          Spouse birthday
        </label>
        <input
          id="spouse_birth_date"
          name="spouse_birth_date"
          type="date"
          defaultValue={defaults?.spouse_birth_date ?? ""}
          aria-invalid={errors?.spouse_birth_date ? true : undefined}
          // Open the native date picker on a click anywhere in the field, not
          // just the small calendar glyph — clicking the body otherwise does
          // nothing in some browsers (QA: picker didn't open reliably).
          // showPicker() throws if unsupported / outside a user gesture, so guard it.
          onClick={(e) => {
            const el = e.currentTarget as HTMLInputElement & {
              showPicker?: () => void;
            };
            try {
              el.showPicker?.();
            } catch {
              /* unsupported or blocked — native click behaviour still applies */
            }
          }}
          style={{ colorScheme: "light" }}
          className={inputClasses(!!errors?.spouse_birth_date)}
        />
        {errors?.spouse_birth_date ? (
          <p className="mt-1 text-xs text-danger-600">
            {errors.spouse_birth_date}
          </p>
        ) : null}
      </div>

      {/* Link-to-alumnus search */}
      <div ref={boxRef} className="relative">
        <label htmlFor="spouse-search" className={labelCls}>
          Spouse is also an alumnus? Search to link their record
        </label>
        <input
          id="spouse-search"
          type="text"
          autoComplete="off"
          placeholder="Search alumni by name…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onFocus={() => results.length > 0 && setOpen(true)}
          className={inputClasses(false)}
        />
        {open && (loading || results.length > 0) ? (
          <ul className="absolute z-10 mt-1 max-h-64 w-full overflow-auto rounded-lg border border-gray-200 bg-white py-1 shadow-lg">
            {loading ? (
              <li className="px-3 py-2 text-sm text-gray-500">Searching…</li>
            ) : (
              results.map((a) => (
                <li key={a.alumni_id}>
                  <button
                    type="button"
                    onClick={() => selectMatch(a)}
                    className="flex w-full flex-col items-start px-3 py-2 text-left hover:bg-gray-50"
                  >
                    <span className="text-sm font-medium text-gray-900">
                      {displayName(a) || `Alumnus #${a.alumni_id}`}
                    </span>
                    <span className="text-xs text-gray-500">
                      {[
                        a.graduation_year ? `Class of ${a.graduation_year}` : null,
                        a.current_employer,
                      ]
                        .filter(Boolean)
                        .join(" · ")}
                    </span>
                  </button>
                </li>
              ))
            )}
          </ul>
        ) : null}
        {linkedId === null ? (
          <p className="mt-1 text-xs text-gray-500">
            Optional — leave blank to just record a name.
          </p>
        ) : null}
      </div>
    </div>
  );
}
