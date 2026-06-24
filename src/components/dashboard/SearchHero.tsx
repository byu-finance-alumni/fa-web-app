"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Search } from "lucide-react";
import { parseAlumniQuery } from "@/lib/alumniQueryParser";

/**
 * Dashboard search hero — the page's primary call to action. A real search
 * field that accepts either keywords or a full natural-language sentence
 * (e.g. "alumni near Las Vegas that work in investment banking"). On submit it
 * runs a lightweight keyword parser (no AI) that maps recognized facets
 * (industry, location, intents) onto the alumni list's existing filter params
 * and deep-links there; anything it can't structure becomes a plain search.
 * The alumni list stays the single source of truth for results.
 */
export function SearchHero() {
  const router = useRouter();
  const [q, setQ] = useState("");

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    router.push(parseAlumniQuery(q));
  };

  return (
    <form
      onSubmit={submit}
      role="search"
      aria-label="Search alumni"
      className="flex h-full items-center gap-3 rounded-xl border border-gray-300 bg-white px-4 py-3 transition focus-within:border-brand-blue-600 focus-within:ring-1 focus-within:ring-brand-blue-600"
    >
      <Search className="h-5 w-5 shrink-0 text-gray-400" aria-hidden="true" />
      <input
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="Search alumni — try “near Las Vegas in investment banking”"
        aria-label="Search alumni by name, employer, title, location, or industry"
        autoComplete="off"
        className="min-w-0 flex-1 bg-transparent text-base text-gray-900 placeholder:text-gray-400 focus:outline-none"
      />
      <button
        type="submit"
        className="shrink-0 rounded-lg bg-brand-blue-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-brand-blue-500 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-blue-500"
      >
        Search
      </button>
    </form>
  );
}
