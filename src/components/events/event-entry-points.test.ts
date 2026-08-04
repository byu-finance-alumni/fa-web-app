import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * Source-invariant guards for issue #611 — *"'Add event' goes to the CSV
 * import — the no-attendees create form is unreachable"*.
 *
 * A staff member could not create an event because she had no attendee list.
 * The plain create form (`/events/new`) already existed and needed no CSV, but
 * every button labelled "Add event" pointed at `/events/import`, which requires
 * a file. Three properties are protected here:
 *
 *   1. **Every "Add event" entry point reaches the create form.** If any of them
 *      drifts back to `/events/import`, the form goes unreachable again and the
 *      wall returns. The CSV import must stay reachable — as its own
 *      clearly-labelled secondary action, not as the default.
 *   2. **An event can be created with zero attendees.** The create page carries
 *      no file input and the create action posts the event alone.
 *   3. **Attendees can be brought later**, from the event itself, by BOTH
 *      routes: one at a time and by uploading a list.
 *
 * These are structural facts about specific files, so they are guarded the way
 * `session-invariants.test.ts` guards the session rules: by reading the source.
 * The suites here run in Node with no DOM, so rendering is not an option.
 */

function read(relPath: string): string {
  return readFileSync(resolve(process.cwd(), relPath), "utf8");
}

const DASHBOARD = "src/app/(app)/dashboard/page.tsx";
const EVENTS_PAGE = "src/app/(app)/events/page.tsx";
const TOOLBAR = "src/components/events/EventsToolbar.tsx";
const NEW_PAGE = "src/app/(app)/events/new/page.tsx";
const WIZARD = "src/components/events/EventWizard.tsx";
const EDIT_PAGE = "src/app/(app)/events/[id]/edit/page.tsx";
const ACTIONS = "src/app/(app)/events/actions.ts";
const ATTENDEE_MANAGER = "src/components/events/AttendeeManager.tsx";

/** Every line that renders the literal "Add event" as a link's own text. */
function addEventLinkLines(src: string): string[] {
  const lines = src.split("\n");
  return lines.flatMap((line, i) => {
    if (!line.includes(">Add event<")) return [];
    // The href may sit on the same line or on the `<Link` line just above.
    return [lines.slice(Math.max(0, i - 2), i + 1).join("\n")];
  });
}

describe('"Add event" reaches the create form, not the CSV import (#611)', () => {
  it("the dashboard quick-add FAB links straight to /events/new", () => {
    const blocks = addEventLinkLines(read(DASHBOARD));
    expect(blocks.length).toBeGreaterThan(0);
    for (const block of blocks) {
      expect(block).toContain("/events/new");
      expect(block).not.toContain("/events/import");
    }
  });

  it.each([
    ["the events page FAB", EVENTS_PAGE],
    ["the events toolbar", TOOLBAR],
  ])("%s renders Add event from the create href only", (_label, path) => {
    const src = read(path);
    // Both render the button from a resolved destination, so the guard is that
    // there are two SEPARATE ones and the import href never wears the "Add
    // event" label. A single `addEventHref` prop is what let the CSV importer
    // win that label whenever the viewer held events.import.
    expect(src).toContain("createHref");
    expect(src).toContain("importHref");
    expect(src).not.toContain("addEventHref");
    const blocks = addEventLinkLines(src);
    expect(blocks.length).toBeGreaterThan(0);
    for (const block of blocks) {
      expect(block).toContain("createHref");
      expect(block).not.toContain("importHref");
    }
  });

  it("the events page resolves Add event to the create form unconditionally", () => {
    const src = read(EVENTS_PAGE);
    // It used to prefer /events/import whenever the viewer held events.import,
    // which is exactly how the create form became unreachable.
    expect(src).toContain('const createHref = canCreate ? "/events/new" : null');
    expect(src).toContain('const importHref = canImport ? "/events/import" : null');
  });

  it("keeps the CSV import reachable as a clearly separate secondary action", () => {
    // Deleting the import is not the fix — it just stops being the default.
    for (const path of [EVENTS_PAGE, TOOLBAR, DASHBOARD]) {
      expect(read(path)).toContain("Import events from CSV");
    }
    for (const path of [EVENTS_PAGE, DASHBOARD]) {
      expect(read(path)).toContain("/events/import");
    }
  });

  it("gates the two actions on their own capabilities, not on a role", () => {
    for (const path of [EVENTS_PAGE, DASHBOARD]) {
      const src = read(path);
      expect(src).toContain("canCreateEvents");
      expect(src).toContain("canImportEvents");
    }
    expect(read(NEW_PAGE)).toContain("canCreateEvents(ctx.capabilities)");
  });
});

describe("an event can be created with zero attendees (#611)", () => {
  it("the create page renders the wizard and asks for no file", () => {
    const src = read(NEW_PAGE);
    expect(src).toContain("EventWizard");
    expect(src).toContain("createEvent");
    // No CSV wizard, no file input: an attendee list is never a precondition.
    expect(src).not.toContain("ImportWizard");
    expect(src).not.toContain('type="file"');
  });

  it("the wizard itself never asks for a file", () => {
    expect(read(WIZARD)).not.toContain('type="file"');
  });

  it("the wizard offers adding attendees later as the default choice", () => {
    const src = read(WIZARD);
    expect(src).toContain("Add attendees later");
    expect(src).toContain("An attendee list is never required");
    expect(src).toContain("useState<AttendeePlan>(ATTENDEE_PLAN.LATER)");
  });

  it("the create action posts the event on its own", () => {
    const src = read(ACTIONS);
    // POST /events with the event payload and nothing else — no roster, no file.
    expect(src).toMatch(/apiPost<\{ event_id: number \}>\(\s*"\/events",/);
    expect(src).toContain("postCreateHref(created.event_id");
  });
});

describe("attendees can be brought later, from the event (#611)", () => {
  it("the freshly-created event says so in plain words", () => {
    const src = read(EDIT_PAGE);
    expect(src).toContain("Event created with no attendees");
    expect(src).toContain("AttendeeManager");
  });

  it("the event offers BOTH after-the-fact attendee routes", () => {
    const src = read(ATTENDEE_MANAGER);
    // One at a time…
    expect(src).toContain("Add attendee — search alumni");
    // …and by uploading a list onto THIS event (never creating another).
    expect(src).toContain("Upload attendee list");
    expect(src).toContain("/attendees/import");
  });
});

describe("no icons in the new event UI (house rule)", () => {
  it.each([
    ["the Add-event wizard", WIZARD],
    ["the shared event fields", "src/components/events/EventFields.tsx"],
    ["the event edit form", "src/components/events/EventForm.tsx"],
  ])("%s imports no icon set", (_label, path) => {
    expect(read(path)).not.toContain("lucide-react");
  });
});
