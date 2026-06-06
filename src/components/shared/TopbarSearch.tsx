"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Search } from "lucide-react";

/**
 * Global quick-search in the top bar (07B CRM pattern). Submitting routes to the
 * alumni search results — a real, useful global jump, not a dead control.
 */
export function TopbarSearch({
  placeholder = "Quick search…",
}: {
  placeholder?: string;
}) {
  const router = useRouter();
  const [q, setQ] = useState("");

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        const term = q.trim();
        router.push(term ? `/alumni?q=${encodeURIComponent(term)}` : "/alumni");
      }}
      className="hidden items-center gap-2 rounded-lg border border-gray-300 bg-gray-50 px-3 py-1.5 sm:flex"
    >
      <Search className="h-4 w-4 text-gray-500" aria-hidden="true" />
      <input
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder={placeholder}
        aria-label="Quick search alumni"
        className="w-44 bg-transparent text-sm text-gray-900 placeholder:text-gray-500 focus:outline-none"
      />
    </form>
  );
}
