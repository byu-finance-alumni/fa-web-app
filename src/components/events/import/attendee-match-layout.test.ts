import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * Source-invariant guard for issue #829 — *"Attendee match screen: centre it
 * on the page"*.
 *
 * The wizard's root carried `max-w-5xl` without `mx-auto`, so on any viewport
 * wider than the cap it sat against the left edge while the right half of the
 * page stayed empty. Every other import wizard (events CSV, alumni import and
 * update, donations) centres the same cap with `mx-auto`, so the fix is the
 * sibling wrapper, not a new one.
 *
 * ⚠️ A passing assertion here is NOT the verification Jake asked for — the
 * last layout regression in this shell sailed through a source-text test. It
 * only stops the class from being dropped again by accident; the real check is
 * rendering the page at a wide viewport. This suite runs in Node with no DOM.
 */

function read(relPath: string): string {
  return readFileSync(resolve(process.cwd(), relPath), "utf8");
}

const WIZARD = "src/components/events/import/AttendeeMatchWizard.tsx";
const SIBLING = "src/components/events/import/EventsImportWizard.tsx";

/**
 * The `className` attribute of an exported component's outermost element:
 * the first JSX element after the first `return (` that follows
 * `export function <name>`. Helper components declared later in the same file
 * are ignored, which a whole-file match would not do.
 */
function rootClassName(src: string, component: string): string {
  const start = src.indexOf(`export function ${component}`);
  if (start < 0) throw new Error(`export function ${component} not found`);
  const body = src.slice(src.indexOf("return (", start));
  const match = body.match(/<div className="([^"]*)"/);
  if (!match) throw new Error(`${component} root <div className=...> not found`);
  return match[1];
}

describe("AttendeeMatchWizard is centred with a max width (#829)", () => {
  const classes = rootClassName(read(WIZARD), "AttendeeMatchWizard").split(
    /\s+/,
  );

  it("centres the root with auto margins", () => {
    // Match the CLASS on the root element, not the word anywhere in the file:
    // the fix's own comment names `mx-auto`, so a whole-file `toContain` would
    // pass with the class missing.
    expect(classes).toContain("mx-auto");
  });

  it("caps the width at the same token the sibling import wizards use", () => {
    expect(classes).toContain("max-w-5xl");
    const siblingClasses = rootClassName(
      read(SIBLING),
      "EventsImportWizard",
    ).split(/\s+/);
    expect(siblingClasses).toContain("mx-auto");
    expect(siblingClasses).toContain("max-w-5xl");
  });

  it("stays in the page rather than becoming a modal", () => {
    // Option 2 of the issue (a centred overlay) was explicitly NOT taken. A
    // fixed or absolute root would float over the shell and lose the <main>
    // scroll container.
    for (const cls of ["fixed", "absolute", "inset-0"]) {
      expect(classes).not.toContain(cls);
    }
  });
});
