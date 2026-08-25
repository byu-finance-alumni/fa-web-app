import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

import { employerReachSub } from "@/lib/employerReach";

/**
 * The Companies tile's sub-line (#754).
 *
 * The tile read "Across 70 states" — more states than exist — because the
 * backend counted free-text spelling variants and non-US regions alike. With
 * that fixed the line names both dimensions, which puts four small wording
 * decisions on screen that a diff will not show you: the two plurals, the two
 * zeros, and an older backend that returns no country count at all.
 */

const DASHBOARD = "src/app/(app)/dashboard/page.tsx";
const read = (relPath: string): string =>
  readFileSync(resolve(process.cwd(), relPath), "utf8");

describe("employerReachSub", () => {
  it("names both dimensions in Jake's wording", () => {
    // Jake, 2026-08-25: the plain phrasing, chosen over "at least 4 countries"
    // after being shown both. Nothing here should hedge the country count.
    expect(employerReachSub(12, 4)).toBe("Across 12 states and 4 countries");
  });

  it("says 'state' and 'country' when either count is one", () => {
    expect(employerReachSub(1, 1)).toBe("Across 1 state and 1 country");
    expect(employerReachSub(1, 4)).toBe("Across 1 state and 4 countries");
    expect(employerReachSub(12, 1)).toBe("Across 12 states and 1 country");
  });

  it("drops the country clause rather than saying '0 countries'", () => {
    // The overwhelmingly likely everyday case: an entirely domestic roster.
    // "and 0 countries" reads as a suspiciously precise nothing, and the line
    // it falls back to is exactly what the tile carried before #754.
    expect(employerReachSub(12, 0)).toBe("Across 12 states");
    expect(employerReachSub(1, 0)).toBe("Across 1 state");
  });

  it("drops the state clause when nobody is in the US", () => {
    // Symmetric with the case above — a zero on one side never survives into
    // the sentence, whichever side it is.
    expect(employerReachSub(0, 3)).toBe("Across 3 countries");
    expect(employerReachSub(0, 1)).toBe("Across 1 country");
  });

  it("renders no line at all when both counts are zero", () => {
    // "Across 0 states" is not context, it's noise — and the tile's own value
    // already says 0. Same rule the rest of the KPI strip keeps: no line beats
    // an empty one.
    expect(employerReachSub(0, 0)).toBeNull();
  });

  it("falls back to states only against a backend without the country count", () => {
    // `employer_countries` ships from fa-web-api separately. Until it lands the
    // summary omits it, and the tile has to keep showing the figure it DOES
    // have rather than blanking the line or claiming zero countries.
    expect(employerReachSub(12, undefined)).toBe("Across 12 states");
    expect(employerReachSub(1, undefined)).toBe("Across 1 state");
    expect(employerReachSub(12, null)).toBe("Across 12 states");
  });

  it("renders no line when the state count itself is missing", () => {
    // Pre-existing behaviour, preserved: the sub-line is absent, not invented.
    expect(employerReachSub(undefined, undefined)).toBeNull();
    expect(employerReachSub(null, 4)).toBeNull();
  });

  it("survives the structural cap the backend now enforces", () => {
    // 50 states + DC. If this line ever renders a number above 51 again the
    // fault is upstream, but the sentence itself must still be well formed.
    expect(employerReachSub(51, 27)).toBe("Across 51 states and 27 countries");
  });
});

describe("the Companies tile wiring", () => {
  it("builds its sub-line from the helper, not an inline template", () => {
    // The wording used to be a ternary inside the JSX, where none of the cases
    // above could be tested. Keeping the call here is what makes these tests
    // describe what actually renders.
    const src = read(DASHBOARD);
    expect(src).toContain("employerReachSub(");
    expect(src).toContain("s?.employer_countries");
    // The old inline phrasing must not come back alongside it.
    expect(src).not.toMatch(/`Across \$\{s\.employer_states\}/);
  });

  it("declares the country count optional so the tile survives an old backend", () => {
    const src = read(DASHBOARD);
    expect(src).toMatch(/employer_countries\?: number;/);
  });
});
