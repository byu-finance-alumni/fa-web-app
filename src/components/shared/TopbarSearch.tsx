"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { Loader2, Search } from "lucide-react";
import { clientGet } from "@/lib/api-client";
import { Badge } from "@/components/ui/badge";
import type { Alumni, AlumniPage } from "@/types/alumni";

// Search from the first character. The 400ms debounce (fires only after the
// user pauses typing) is what keeps the request rate well inside the
// 100 req/60s/IP WAF rate limit, so a 1-char minimum is still safe.
const MIN_CHARS = 1;
const DEBOUNCE_MS = 400;
const MAX_MATCHES = 8;

function displayName(a: Alumni): string {
  const first = a.preferred_first_name ?? a.first_name ?? "";
  return [first, a.last_name].filter(Boolean).join(" ") || "—";
}

/**
 * Global alumni search in the top bar (07B CRM pattern). It searches alumni only
 * — the placeholder/label say so explicitly so it isn't mistaken for a
 * cross-entity search (e.g. on the Events page). Typing live-fetches matching
 * alumni into a dropdown (debounced); picking one jumps to the profile, Enter
 * routes to the full alumni search results.
 */
export function TopbarSearch({
  placeholder = "Search alumni…",
  fullWidth = false,
}: {
  placeholder?: string;
  /**
   * When true, the search spans its container's full width and is always
   * visible (for use inside a toolbar bar). Defaults to the top-bar sizing:
   * fixed responsive widths, hidden below the `sm` breakpoint.
   */
  fullWidth?: boolean;
}) {
  const router = useRouter();
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [failed, setFailed] = useState(false);
  const [matches, setMatches] = useState<Alumni[]>([]);
  const [total, setTotal] = useState(0);
  const [active, setActive] = useState(-1);
  const rootRef = useRef<HTMLFormElement>(null);
  // Monotonic sequence guards against out-of-order responses.
  const seqRef = useRef(0);

  // Debounced live search as the user types.
  useEffect(() => {
    const term = q.trim();
    if (term.length < MIN_CHARS) {
      seqRef.current++;
      setMatches([]);
      setTotal(0);
      setOpen(false);
      setLoading(false);
      setFailed(false);
      return;
    }
    setLoading(true);
    const seq = ++seqRef.current;
    const timer = setTimeout(async () => {
      try {
        // kind=all so the global quick search spans BOTH alumni and friends of
        // the program (is_alumni=false); the default /alumni search would
        // otherwise return alumni only and never surface a friend (#218).
        const page = await clientGet<AlumniPage>(
          `/alumni?q=${encodeURIComponent(term)}&kind=all&limit=${MAX_MATCHES}&offset=0`,
        );
        if (seq !== seqRef.current) return;
        setMatches(page.items);
        setTotal(page.total);
        setFailed(false);
        setActive(-1);
        setOpen(true);
      } catch {
        if (seq !== seqRef.current) return;
        setMatches([]);
        setTotal(0);
        setFailed(true);
        setOpen(true);
      } finally {
        if (seq === seqRef.current) setLoading(false);
      }
    }, DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [q]);

  // Close the dropdown on any click outside the search.
  useEffect(() => {
    function onMouseDown(e: MouseEvent) {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", onMouseDown);
    return () => document.removeEventListener("mousedown", onMouseDown);
  }, []);

  function goToFullResults() {
    const term = q.trim();
    setOpen(false);
    router.push(term ? `/alumni?q=${encodeURIComponent(term)}` : "/alumni");
  }

  function goToProfile(a: Alumni) {
    setOpen(false);
    router.push(`/alumni/${a.alumni_id}`);
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (!open || matches.length === 0) {
      if (e.key === "Escape") setOpen(false);
      return;
    }
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActive((i) => (i + 1) % matches.length);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((i) => (i <= 0 ? matches.length - 1 : i - 1));
    } else if (e.key === "Enter" && active >= 0) {
      e.preventDefault();
      goToProfile(matches[active]);
    } else if (e.key === "Escape") {
      setOpen(false);
      setActive(-1);
    }
  }

  return (
    <form
      ref={rootRef}
      onSubmit={(e) => {
        e.preventDefault();
        goToFullResults();
      }}
      role="search"
      className={`relative items-center gap-2 rounded-md border border-gray-300 bg-gray-50 px-3 py-2 focus-within:border-brand-blue-600 focus-within:ring-2 focus-within:ring-brand-blue-500 ${
        fullWidth
          ? "flex w-full"
          : "hidden w-80 sm:flex md:w-[30rem] lg:w-[36rem]"
      }`}
    >
      <Search className="h-4 w-4 shrink-0 text-gray-500" aria-hidden="true" />
      <input
        value={q}
        onChange={(e) => setQ(e.target.value)}
        onFocus={() => {
          if (matches.length > 0 || failed) setOpen(true);
        }}
        onKeyDown={onKeyDown}
        placeholder={placeholder}
        aria-label="Quick search alumni"
        role="combobox"
        aria-expanded={open}
        aria-controls="topbar-search-listbox"
        aria-activedescendant={
          active >= 0 ? `topbar-search-option-${active}` : undefined
        }
        autoComplete="off"
        className="w-full bg-transparent text-sm text-gray-900 placeholder:text-gray-500 focus:outline-none"
      />
      {loading && (
        <Loader2
          className="h-4 w-4 shrink-0 animate-spin text-gray-500"
          aria-hidden="true"
        />
      )}

      {open && (
        <ul
          id="topbar-search-listbox"
          role="listbox"
          aria-label="Alumni matches"
          className="absolute left-0 right-0 top-full z-50 mt-1 max-h-96 overflow-auto rounded-lg border border-gray-200 bg-white py-1 shadow-lg"
        >
          {failed ? (
            <li className="px-3 py-2 text-sm text-gray-500">
              Couldn&rsquo;t load matches. Press Enter to search instead.
            </li>
          ) : matches.length === 0 ? (
            <li className="px-3 py-2 text-sm text-gray-500">
              No alumni match &ldquo;{q.trim()}&rdquo;
            </li>
          ) : (
            <>
              {matches.map((a, i) => (
                <li
                  key={a.alumni_id}
                  id={`topbar-search-option-${i}`}
                  role="option"
                  aria-selected={i === active}
                >
                  <Link
                    href={`/alumni/${a.alumni_id}`}
                    onClick={() => setOpen(false)}
                    onMouseEnter={() => setActive(i)}
                    className={`flex items-center justify-between gap-3 px-3 py-2 text-sm ${
                      i === active ? "bg-brand-blue-50" : "hover:bg-gray-50"
                    }`}
                  >
                    <span className="truncate font-medium text-gray-900">
                      {displayName(a)}
                    </span>
                    <span className="flex shrink-0 items-center gap-2 text-xs text-gray-500">
                      {a.archived && (
                        <Badge variant="neutral" size="sm">
                          Archived
                        </Badge>
                      )}
                      {a.graduation_year ? `Class of ${a.graduation_year}` : ""}
                    </span>
                  </Link>
                </li>
              ))}
              {total > matches.length && (
                <li className="border-t border-gray-100">
                  <button
                    type="button"
                    onClick={goToFullResults}
                    className="w-full px-3 py-2 text-left text-sm font-medium text-brand-blue-600 hover:bg-gray-50"
                  >
                    View all {total} results
                  </button>
                </li>
              )}
            </>
          )}
        </ul>
      )}
    </form>
  );
}
