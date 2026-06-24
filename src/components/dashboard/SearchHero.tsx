"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Search } from "lucide-react";

/**
 * Dashboard search hero — the page's primary call to action (Figma "Dashboard —
 * Redesign"). A large, prominent search field that NEVER renders results inline:
 * submitting deep-links into the alumni list (`/alumni?q=<term>`), which stays
 * the single source of truth for search + filtering. Live, as-you-type matches
 * are handled by the global `TopbarSearch` in the top bar.
 */
export function SearchHero() {
  const router = useRouter();
  const [q, setQ] = useState("");

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const term = q.trim();
    router.push(term ? `/alumni?q=${encodeURIComponent(term)}` : "/alumni");
  };

  return (
    <form
      onSubmit={submit}
      role="search"
      aria-label="Search alumni"
      className="flex items-center gap-4 rounded-xl border border-gray-300 bg-white px-6 py-5 transition focus-within:border-brand-blue-600 focus-within:ring-1 focus-within:ring-brand-blue-600"
    >
      <Search
        className="h-6 w-6 shrink-0 text-brand-blue-600"
        aria-hidden="true"
      />
      <div className="min-w-0 flex-1">
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search alumni"
          aria-label="Search alumni by name, employer, title, or city"
          autoComplete="off"
          className="w-full bg-transparent text-lg font-semibold text-gray-900 placeholder:text-gray-900 focus:outline-none"
        />
        <p className="mt-0.5 text-sm text-gray-500">
          name · employer · title · city
        </p>
      </div>
    </form>
  );
}
