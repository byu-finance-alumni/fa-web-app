import { readdirSync, readFileSync } from "node:fs";
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
const layout = readFileSync(
  resolve(__dirname, "../../app/(app)/layout.tsx"),
  "utf-8",
);

/**
 * Paging the alumni list used to leave you at the BOTTOM of the next page.
 *
 * The first fix for this shipped to prod and did nothing, because it called
 * `window.scrollTo` — and the document is not what scrolls in this app. These
 * assertions pin the thing that actually made it work, and the layout fact the
 * whole fix depends on.
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

  it("scrolls the <main> container, not just the window", () => {
    // THE regression this file exists for. `window.scrollTo` on its own is a
    // no-op here and shipped to prod once already.
    expect(component).toMatch(
      /document\.querySelector\("main"\)\?\.scrollTo\(\{\s*top:\s*0/,
    );
    expect(component).toMatch(/window\.scrollTo\(\{\s*top:\s*0/);
  });

  it("re-runs when the offset changes", () => {
    expect(component).toMatch(/\}, \[offset\]\);/);
  });

  it("keys off the offset prop rather than useSearchParams", () => {
    // useSearchParams would force a Suspense boundary onto every page that
    // mounts this; the offset is already known on the server. Match the CALL,
    // not the word — it is named in the doc comment explaining this choice.
    expect(component).not.toMatch(/useSearchParams\s*\(/);
    expect(component).not.toContain('from "next/navigation"');
  });

  /**
   * The premise of the fix, asserted against the layout itself. If the shell
   * ever moves the scrollbar back onto the document, scrolling `<main>` becomes
   * the no-op and this test is where that shows up.
   */
  it("the app shell really does put the scrollbar on an inner element", () => {
    expect(layout).toMatch(/\[overflow:clip\]/);
    expect(roster).toMatch(/<main className="[^"]*overflow-auto/);
  });
});

/**
 * EVERY paginated screen, not just the alumni list.
 *
 * The fix landed on the alumni roster first and the other seven screens kept
 * the same annoyance for a while. This walks the app and derives the list of
 * paginated screens from the source rather than hard-coding it, so a NEW
 * paginated page fails here instead of silently shipping without the scroll.
 */
function tsxFilesUnder(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = resolve(dir, entry.name);
    if (entry.isDirectory()) out.push(...tsxFilesUnder(full));
    else if (entry.name.endsWith(".tsx")) out.push(full);
  }
  return out;
}

const SRC = resolve(__dirname, "../..");

/** A screen is "paginated" if it renders the Prev/Next pair. */
const paginated = tsxFilesUnder(SRC)
  .map((file) => ({ file, text: readFileSync(file, "utf-8") }))
  .filter(({ text }) => text.includes('label="Next ›"'));

describe("every paginated screen scrolls back to the top", () => {
  it("finds the paginated screens", () => {
    // Guards the guard: if the Prev/Next markup is ever restyled, this drops to
    // zero and the assertion below would pass vacuously.
    expect(paginated.length).toBeGreaterThanOrEqual(8);
  });

  it.each(paginated.map(({ file }) => file.replace(SRC, "src")))(
    "%s mounts ScrollToTopOnPageChange",
    (relative) => {
      const found = paginated.find(({ file }) =>
        file.replace(SRC, "src") === relative,
      )!;
      expect(found.text).toContain("<ScrollToTopOnPageChange offset={offset} />");
      expect(found.text).toContain(
        'import { ScrollToTopOnPageChange } from "@/components/shared/ScrollToTopOnPageChange"',
      );
    },
  );
});
