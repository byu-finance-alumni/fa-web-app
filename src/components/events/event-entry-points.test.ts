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
 * a file. Two properties are protected here:
 *
 *   1. **Every "Add event" entry point reaches the create form.** If any of
 *      them drifts back to `/events/import`, the form goes unreachable again
 *      and the wall returns. The CSV import must stay reachable — as its own
 *      clearly-labelled secondary action, not as the default.
 *   2. **An event can be created with zero attendees, then filled in later.**
 *      The create page carries no file input, the create action posts the event
 *      alone, and the event's own page offers BOTH after-the-fact attendee
 *      paths: manual one-at-a-time and a CSV upload that ADDS to that event.
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
const EDIT_PAGE = "src/app/(app)/events/[id]/edit/page.tsx";
const ACTIONS = "src/app/(app)/events/actions.ts";
const CSV_IMPORT = "src/components/events/AttendeeCsvImport.tsx";

/** The href on the line labelled "Add event" in `src`, or null if absent. */
function addEventHref(src: string): string | null {
  const line = src
    .split("\n")
    .find((l) => l.includes(">Add event<") && l.includes("href="));
  if (!line) return null;
  return /href="([^"]+)"/.exec(line)?.[1] ?? null;
}

describe('"Add event" reaches the create form, not the CSV import (#611)', () => {
  it.each([
    ["the dashboard quick-add FAB", DASHBOARD],
    ["the events page FAB", EVENTS_PAGE],
    ["the events toolbar", TOOLBAR],
  ])("%s points at /events/new", (_label, path) => {
    expect(addEventHref(read(path))).toBe("/events/new");
  });

  it.each([
    ["the dashboard quick-add FAB", DASHBOARD],
    ["the events page FAB", EVENTS_PAGE],
    ["the events toolbar", TOOLBAR],
  ])("%s no longer labels the CSV import \"Add event\"", (_label, path) => {
    const src = read(path);
    for (const line of src.split("\n")) {
      if (line.includes(">Add event<")) {
        expect(line).not.toContain("/events/import");
      }
    }
  });

  it("keeps the CSV import reachable as a clearly separate secondary action", () => {
    // Deleting the import is not the fix — it just stops being the default.
    for (const path of [EVENTS_PAGE, TOOLBAR]) {
      const src = read(path);
      expect(src).toContain("/events/import");
      expect(src).toContain("Import events from CSV");
    }
  });
});

describe("an event can be created with zero attendees (#611)", () => {
  it("the create page renders the plain form and asks for no file", () => {
    const src = read(NEW_PAGE);
    expect(src).toContain("EventForm");
    expect(src).toContain("createEvent");
    // No CSV wizard, no file input: an attendee list is never a precondition.
    expect(src).not.toContain("ImportWizard");
    expect(src).not.toContain('type="file"');
  });

  it("the shared event form has no file input either", () => {
    const src = read("src/components/events/EventForm.tsx");
    expect(src).not.toContain('type="file"');
  });

  it("createEvent posts the event on its own and never sends a file", () => {
    const src = read(ACTIONS);
    const action = /export async function createEvent[\s\S]*?\n}/.exec(src)?.[0];
    expect(action).toBeTruthy();
    // A plain JSON POST to /events — not a multipart upload.
    expect(action).toMatch(/apiPost<\{ event_id: number \}>\(\s*"\/events"/);
    expect(action).not.toContain("apiPostForm");
    expect(action).not.toContain("multipart");
  });

  it("only the event name and date are required to create one", () => {
    // Guards the required-field set: adding a file/attendee requirement here
    // would re-block the very workflow this issue is about.
    const src = read(ACTIONS);
    const validate = /function validateRequired[\s\S]*?\n}/.exec(src)?.[0] ?? "";
    expect(validate).toContain("fieldErrors.event_name");
    expect(validate).toContain("fieldErrors.event_date");
    expect(validate).not.toContain("attendee");
    expect(validate).not.toContain("file");
  });

  it("creating lands on the event's own page so attendees can follow", () => {
    const src = read(ACTIONS);
    expect(src).toContain("redirect(`/events/${created.event_id}/edit?created=1`)");
  });
});

describe("attendees can be added to an event afterwards (#611)", () => {
  it("the event page offers BOTH the manual picker and the CSV upload", () => {
    const src = read(EDIT_PAGE);
    expect(src).toContain("AttendeeManager"); // one at a time
    expect(src).toContain("AttendeeCsvImport"); // bulk roster
  });

  it("the manual add posts a single attendee to the existing event", () => {
    const src = read(ACTIONS);
    const action = /export async function addAttendee[\s\S]*?\n}/.exec(src)?.[0];
    expect(action).toContain("`/events/${eventId}/attendees`");
  });

  it("the attendee CSV targets the existing event, never creating one", () => {
    const src = read(ACTIONS);
    // Scoped under /events/{id}/attendees — the create-an-event importer's
    // /events/import is a different endpoint and must not be reused here.
    expect(src).toContain(
      "`/events/${eventId}/attendees/import/preview`",
    );
    expect(src).toContain("`/events/${eventId}/attendees/import`");
    const commit = /export async function commitEventAttendeeImport[\s\S]*?\n}/.exec(
      src,
    )?.[0];
    expect(commit).toBeTruthy();
    expect(commit).not.toContain("event_name");
    expect(commit).not.toContain('"/events/import"');
  });

  it("the CSV panel forwards only the file — no event identity fields", () => {
    // Sending an event name/date would risk the backend treating it as a new
    // event; the event is addressed by id in the URL and nothing else.
    const src = read(ACTIONS);
    const helper = /function attendeeImportFormData[\s\S]*?\n}/.exec(src)?.[0] ?? "";
    expect(helper).toContain('fd.append("file"');
    expect(helper).not.toContain("event_name");
    expect(helper).not.toContain("event_date");
  });

  it("the CSV panel rejects oversize files before the platform body cap", () => {
    // A >4.5MB body is dropped by Vercel and surfaces in the browser as a
    // bogus "CORS error"; catching it here keeps the message truthful.
    const src = read(CSV_IMPORT);
    expect(src).toContain("MAX_UPLOAD_BYTES = 4 * 1024 * 1024");
    expect(src).toContain("upload limit");
  });

  it("the CSV panel is check-then-confirm — nothing writes on file pick", () => {
    const src = read(CSV_IMPORT);
    expect(src).toContain("previewEventAttendeeImport");
    expect(src).toContain("commitEventAttendeeImport");
    // The commit button stays disabled until a dry run says there is something
    // new to add.
    expect(src).toContain("!preview?.importable");
  });
});
