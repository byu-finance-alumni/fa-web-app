"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Search } from "lucide-react";
import { parseAlumniQuery } from "@/lib/alumniQueryParser";

/**
 * Search from the nav bar: a magnifying glass that opens a field (Jake,
 * 2026-08-22).
 *
 * ⚠️ AN ICON, DELIBERATELY. The house rule is text-only controls, and this is a
 * requested exception — a labelled "Search" button beside "Sign out" would read
 * as a second nav destination, and the glass is the one icon whose meaning is
 * genuinely universal. It still carries an `aria-label`, so nothing depends on
 * recognising the shape.
 *
 * ⚠️ IT SUBMITS EXACTLY LIKE THE DASHBOARD'S OWN SEARCH, on purpose. Same
 * `parseAlumniQuery`, same uncontrolled input, same native `GET /alumni?q=`
 * fallback if JS has not hydrated. Two search boxes that accept the same
 * sentence and return different results would be worse than having one, so the
 * behaviour is shared rather than reimplemented — the alumni list stays the
 * single source of truth for results.
 *
 * A PANEL, NOT AN INLINE FIELD. Expanding a field inside the row itself would
 * have to take its width from the links, which are `whitespace-nowrap` and so
 * do not yield — the row would overflow instead. Dropping a panel beneath the
 * glass matches what the group menus already do, and gives the field room to be
 * usefully wide.
 */
export function NavSearch() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Focus the field as it opens — a search you have to click twice to type into
  // is slower than the one already on the page.
  useEffect(() => {
    if (open) inputRef.current?.focus();
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    const onClick = (e: MouseEvent) => {
      if (!wrapRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("keydown", onKey);
    // `click`, not `mousedown` — mousedown fires before the submit button's own
    // click and would tear the form down before it ran.
    document.addEventListener("click", onClick);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("click", onClick);
    };
  }, [open]);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const q = inputRef.current?.value ?? "";
    if (!q.trim()) return;
    setOpen(false);
    router.push(parseAlumniQuery(q));
  };

  return (
    <div ref={wrapRef} className="relative shrink-0">
      <button
        type="button"
        aria-label="Search alumni"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        className={`flex h-9 w-9 items-center justify-center rounded-md transition ${
          open ? "bg-white/20 text-white" : "text-white/80 hover:text-white"
        }`}
      >
        <Search className="h-5 w-5" aria-hidden="true" />
      </button>

      {open ? (
        <div className="absolute right-0 top-full z-50 mt-2 w-96 rounded-lg border border-gray-200 bg-white p-2 shadow-card">
          <form
            onSubmit={submit}
            action="/alumni"
            method="get"
            role="search"
            aria-label="Search alumni"
            className="flex items-center gap-2"
          >
            <input
              ref={inputRef}
              name="q"
              defaultValue=""
              placeholder="Search alumni by name, employer, title, or location"
              className="h-9 min-w-0 flex-1 rounded-md border border-transparent bg-gray-100 px-3 text-sm text-gray-900 placeholder:text-gray-500 focus:border-brand-blue-500 focus:outline-none"
            />
            <button
              type="submit"
              className="h-9 shrink-0 rounded-md bg-brand-blue-600 px-3 text-sm font-medium text-white transition hover:bg-brand-blue-500"
            >
              Search
            </button>
          </form>
        </div>
      ) : null}
    </div>
  );
}
