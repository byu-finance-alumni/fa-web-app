"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { clientGet } from "@/lib/api-client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { AlumniPage, Alumni } from "@/types/alumni";

function displayName(
  a: Pick<Alumni, "preferred_first_name" | "first_name" | "last_name">,
): string {
  const first = a.preferred_first_name || a.first_name || "";
  const last = a.last_name || "";
  return [last, first].filter(Boolean).join(", ") || "—";
}

/**
 * Home speed-dial action for "Log interaction" / "Add note", which both need a
 * specific alumnus. Opens a search sheet; picking someone routes to their profile
 * with `?log=<kind>`, where {@link ProfileLogLauncher} opens the matching form.
 */
export function QuickLogButton({
  kind,
  label,
}: {
  kind: "interaction" | "note";
  label: string;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const [results, setResults] = useState<Alumni[]>([]);
  const [loading, setLoading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) inputRef.current?.focus();
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const term = q.trim();
    if (term.length < 2) {
      setResults([]);
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    const t = setTimeout(async () => {
      try {
        const page = await clientGet<AlumniPage>(
          `/alumni?q=${encodeURIComponent(term)}&limit=8`,
        );
        if (!cancelled) setResults(page.items);
      } catch {
        if (!cancelled) setResults([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }, 250);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [q, open]);

  const pick = (a: Alumni) => {
    setOpen(false);
    router.push(`/alumni/${a.alumni_id}?log=${kind}`);
  };

  return (
    <>
      <Button
        type="button"
        onClick={() => {
          setQ("");
          setResults([]);
          setOpen(true);
        }}
      >
        {label}
      </Button>

      {open ? (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-navy-900/40 p-0 sm:items-center sm:p-4"
          onClick={() => setOpen(false)}
        >
          <div
            className="flex max-h-[80vh] w-full max-w-md flex-col rounded-t-2xl bg-white shadow-xl sm:rounded-lg"
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-label={label}
          >
            <div className="border-b border-gray-200 p-4">
              <p className="text-sm font-semibold text-gray-900">{label}</p>
              <p className="mt-0.5 text-xs text-gray-500">
                Search for the alumnus first.
              </p>
              <Input
                ref={inputRef}
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Search a name…"
                aria-label="Search alumni"
                autoComplete="off"
                className="mt-3"
              />
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto p-2 pb-[max(0.5rem,env(safe-area-inset-bottom))]">
              {loading ? (
                <p className="p-3 text-sm text-gray-500">Searching…</p>
              ) : q.trim().length < 2 ? (
                <p className="p-3 text-sm text-gray-400">
                  Type at least 2 letters to search.
                </p>
              ) : results.length === 0 ? (
                <p className="p-3 text-sm text-gray-500">No matches.</p>
              ) : (
                results.map((a) => (
                  <button
                    key={a.alumni_id}
                    type="button"
                    onClick={() => pick(a)}
                    className="flex w-full items-center justify-between gap-2 rounded-lg px-3 py-2.5 text-left hover:bg-gray-50"
                  >
                    <span className="min-w-0 truncate text-sm font-medium text-gray-900">
                      {displayName(a)}
                    </span>
                    <span className="shrink-0 truncate text-xs text-gray-500">
                      {[
                        a.graduation_year ? `Class of ${a.graduation_year}` : null,
                        a.current_employer,
                      ]
                        .filter(Boolean)
                        .join(" · ")}
                    </span>
                  </button>
                ))
              )}
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
