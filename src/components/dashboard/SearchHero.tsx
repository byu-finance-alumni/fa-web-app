"use client";

import { useRef } from "react";
import { useRouter } from "next/navigation";
import { parseAlumniQuery } from "@/lib/alumniQueryParser";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

/**
 * Dashboard search hero — the page's primary call to action. A real search
 * field that accepts either keywords or a full natural-language sentence
 * (e.g. "alumni near Las Vegas that work in investment banking"). On submit it
 * runs a lightweight keyword parser (no AI) that maps recognized facets onto
 * the alumni list's filter params and deep-links there.
 *
 * Built as an UNCONTROLLED input with a native GET-form fallback so it never
 * depends on React state to be typeable: the browser owns the field value (no
 * `value=` for React to fight), and the form natively posts to /alumni?q=... if
 * JS is slow/absent, while the onSubmit handler runs the natural-language parser
 * + client navigation when hydrated. The alumni list stays the single source of
 * truth for results.
 *
 * Presented as a card in its own right (2026-08-19 redesign) so the field is the
 * widest, tallest control on the dashboard — it sits directly under the welcome
 * heading and above the KPI strip. The greeting itself moved OUT of here and
 * into that heading; this component is now purely the search control.
 */
export function SearchHero() {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    router.push(parseAlumniQuery(inputRef.current?.value ?? ""));
  };

  return (
    <Card className="p-4 md:p-6">
      <form
        onSubmit={submit}
        action="/alumni"
        method="get"
        role="search"
        aria-label="Search alumni"
        className="flex items-center gap-3"
      >
        {/* A FILLED field, not an outlined one: on a white card the search box
            has to read as the one thing to type into, and a `gray-100` fill
            does that where a `gray-300` hairline doesn't. The border is kept
            but transparent so the blue focus border swaps in without the 1px
            reflow an added border would cause.

            The field carries its own border/ring rather than the form wrapper:
            it spans the whole card, so the focus affordance has to land on the
            input itself and not on a row that also contains the button. */}
        <input
          ref={inputRef}
          name="q"
          defaultValue=""
          placeholder="Search alumni by name, employer, title, location, or industry"
          aria-label="Search alumni by name, employer, title, location, or industry"
          autoComplete="off"
          className="h-11 min-w-0 flex-1 rounded-md border border-transparent bg-gray-100 px-4 text-base text-gray-900 transition placeholder:text-gray-500 focus:border-brand-blue-600 focus:outline-none focus:ring-2 focus:ring-brand-blue-500 focus:ring-offset-1 md:h-12"
        />
        {/* Height pinned to the field's at BOTH breakpoints: `size="lg"` is
            `h-11 md:h-10`, so overriding only `h-*` would leave the button
            2px short of the field from `md` up. */}
        <Button type="submit" size="lg" className="h-11 px-6 md:h-12">
          Search
        </Button>
      </form>
      {/* The worked example is the whole point of the hint — staff have to see
          that a sentence is allowed, so it's set in bold near-black rather than
          left as quiet grey text alongside the lead-in. */}
      <p className="mt-3 text-xs text-gray-500">
        Try plain English, e.g.{" "}
        <span className="font-semibold text-gray-900">
          “Find me all alumni in investment banking near Seattle”
        </span>
      </p>
    </Card>
  );
}
