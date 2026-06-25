"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { parseAlumniQuery } from "@/lib/alumniQueryParser";
import { Button } from "@/components/ui/button";

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
    <div>
      <form
        onSubmit={submit}
        role="search"
        aria-label="Search alumni"
        className="flex items-center gap-2 rounded-lg border border-gray-200 bg-white py-1.5 pl-4 pr-1.5 shadow-card transition focus-within:border-brand-blue-600 focus-within:ring-2 focus-within:ring-brand-blue-500 focus-within:ring-offset-1"
      >
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search alumni by name, employer, title, location, or industry"
          aria-label="Search alumni by name, employer, title, location, or industry"
          autoComplete="off"
          className="min-w-0 flex-1 bg-transparent text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none"
        />
        <Button type="submit">Search</Button>
      </form>
      <p className="mt-2 px-1 text-xs text-gray-500">
        Try plain English — e.g.{" "}
        <span className="text-gray-700">
          “Find me all alumni in investment banking near Seattle”
        </span>
      </p>
    </div>
  );
}
