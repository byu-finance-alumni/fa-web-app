import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const component = readFileSync(
  resolve(__dirname, "ScrollToTopOnPageChange.tsx"),
  "utf-8",
);
const roster = readFileSync(
  resolve(__dirname, "../alumni/AlumniRoster.tsx"),
  "utf-8",
);

/**
 * Paging the alumni list used to leave you where you were — at the BOTTOM of the
 * previous page, now looking at the last row of the next one. These assertions
 * pin the three things that make the fix work; each of them is silently
 * undoable by an ordinary-looking edit.
 */
describe("scroll to top when the page of results changes", () => {
  it("is mounted by the alumni roster and fed the offset", () => {
    expect(roster).toContain(
      'import { ScrollToTopOnPageChange } from "@/components/shared/ScrollToTopOnPageChange"',
    );
    expect(roster).toContain("<ScrollToTopOnPageChange offset={offset} />");
  });

  it("is a client component — the effect cannot run on the server", () => {
    expect(component.startsWith('"use client";')).toBe(true);
  });

  it("scrolls the document to the top", () => {
    expect(component).toMatch(/window\.scrollTo\(\{\s*top:\s*0/);
  });

  it("does not scroll on first render, only when the offset changes", () => {
    // A deep link or a bookmark already carrying ?offset= must not yank the
    // viewport on arrival; the ref makes the initial render a no-op.
    expect(component).toContain("useRef(offset)");
    expect(component).toMatch(/if \(previous\.current === offset\) return;/);
  });

  it("keys the effect on the offset prop, not on useSearchParams", () => {
    // useSearchParams would force a Suspense boundary onto every page that
    // mounts this; the offset is already known on the server. Match the CALL,
    // not the word — it is named in the doc comment explaining this choice.
    expect(component).not.toMatch(/useSearchParams\s*\(/);
    expect(component).not.toContain('from "next/navigation"');
    expect(component).toMatch(/\}, \[offset\]\);/);
  });
});
