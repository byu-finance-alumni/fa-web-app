import { describe, expect, it } from "vitest";
import {
  ATTENDEE_PLAN,
  EVENT_LAST_DATA_STEP,
  EVENT_REVIEW_STEP,
  EVENT_STEPS,
  buildEventSummary,
  buildEventWarnings,
  postCreateHref,
  readEventValues,
  validateEventDetails,
  validateEventField,
  type EventValues,
} from "@/lib/eventWizard";

function fd(values: Record<string, string>): FormData {
  const f = new FormData();
  for (const [k, v] of Object.entries(values)) f.set(k, v);
  return f;
}

const BASE: EventValues = {
  event_name: "Spring Finance Mixer",
  event_type: "Networking",
  event_date: "2026-09-01",
  event_location: "Tanner Building",
  event_notes: null,
};

describe("wizard shape", () => {
  it("ends on Review, with one data step before it", () => {
    expect(EVENT_STEPS[EVENT_REVIEW_STEP]).toBe("Review");
    expect(EVENT_LAST_DATA_STEP).toBe(EVENT_REVIEW_STEP - 1);
    expect(EVENT_STEPS[EVENT_LAST_DATA_STEP]).toBe("Attendees");
  });
});

describe("validateEventField", () => {
  it("requires a name and a date, and nothing else", () => {
    expect(validateEventField("event_name", "  ")).toBe("Required.");
    expect(validateEventField("event_date", "")).toBe("Required.");
    expect(validateEventField("event_type", "")).toBeNull();
    expect(validateEventField("event_location", "")).toBeNull();
    expect(validateEventField("event_notes", "")).toBeNull();
  });

  it("rejects a malformed date", () => {
    expect(validateEventField("event_date", "09/01/2026")).toBe(
      "Enter a valid date.",
    );
    expect(validateEventField("event_date", "2026-13-45")).toBe(
      "Enter a valid date.",
    );
    expect(validateEventField("event_date", "2026-09-01")).toBeNull();
  });

  it("caps each field at its schema column width", () => {
    expect(validateEventField("event_name", "x".repeat(256))).toMatch(/255/);
    expect(validateEventField("event_name", "x".repeat(255))).toBeNull();
    expect(validateEventField("event_type", "x".repeat(101))).toMatch(/100/);
    expect(validateEventField("event_location", "x".repeat(256))).toMatch(/255/);
  });

  it("ignores fields it does not own", () => {
    expect(validateEventField("attendee_plan", "later")).toBeNull();
  });
});

describe("validateEventDetails", () => {
  it("passes a name + date and nothing else", () => {
    expect(
      validateEventDetails(fd({ event_name: "Mixer", event_date: "2026-09-01" })),
    ).toEqual({});
  });

  it("flags both required fields when the form is empty", () => {
    expect(validateEventDetails(fd({}))).toEqual({
      event_name: "Required.",
      event_date: "Required.",
    });
  });
});

describe("readEventValues", () => {
  it("trims, and turns blank optionals into null", () => {
    expect(
      readEventValues(
        fd({
          event_name: "  Spring Mixer  ",
          event_type: "",
          event_date: "2026-09-01",
          event_location: "   ",
          event_notes: " Bring name tags ",
        }),
      ),
    ).toEqual({
      event_name: "Spring Mixer",
      event_type: null,
      event_date: "2026-09-01",
      event_location: null,
      event_notes: "Bring name tags",
    });
  });
});

describe("buildEventWarnings", () => {
  const today = "2026-08-04";

  it("says nothing about a complete, future, unique event", () => {
    expect(buildEventWarnings(BASE, [], today)).toEqual([]);
  });

  it("flags an event already on file with the same name and date", () => {
    const w = buildEventWarnings(
      BASE,
      [
        { event_id: 7, event_name: "  spring   FINANCE mixer ", event_date: "2026-09-01" },
      ],
      today,
    );
    expect(w).toHaveLength(1);
    expect(w[0].code).toBe("duplicate");
    expect(w[0].event_id).toBe(7);
  });

  it("does not flag the same name on a different date", () => {
    const w = buildEventWarnings(
      BASE,
      [{ event_id: 7, event_name: "Spring Finance Mixer", event_date: "2025-09-01" }],
      today,
    );
    expect(w.map((x) => x.code)).not.toContain("duplicate");
  });

  it("flags a past date, but only when it is actually past", () => {
    expect(
      buildEventWarnings({ ...BASE, event_date: "2026-08-03" }, [], today).map(
        (w) => w.code,
      ),
    ).toContain("past_date");
    expect(
      buildEventWarnings({ ...BASE, event_date: today }, [], today).map(
        (w) => w.code,
      ),
    ).not.toContain("past_date");
  });

  it("flags a missing type and a missing location", () => {
    const codes = buildEventWarnings(
      { ...BASE, event_type: null, event_location: null },
      [],
      today,
    ).map((w) => w.code);
    expect(codes).toContain("no_type");
    expect(codes).toContain("no_location");
  });

  it("never blocks — every finding is advisory", () => {
    // The type is deliberately warning-only; there is no blocker channel, so a
    // review can always be saved through.
    for (const w of buildEventWarnings(
      { ...BASE, event_type: null, event_location: null, event_date: "2020-01-01" },
      [{ event_id: 1, event_name: BASE.event_name, event_date: "2020-01-01" }],
      today,
    )) {
      expect(w).not.toHaveProperty("blocking");
    }
  });
});

describe("buildEventSummary", () => {
  it("shows every field, marking the blank ones", () => {
    const rows = buildEventSummary({ ...BASE, event_notes: null });
    expect(rows.map((r) => r.label)).toEqual([
      "Event name",
      "Type",
      "Date",
      "Location",
      "Notes",
    ]);
    expect(rows.find((r) => r.label === "Notes")).toEqual({
      label: "Notes",
      value: "Not set",
      empty: true,
    });
  });
});

describe("postCreateHref", () => {
  it("lands on the event by default, so attendees can be added later", () => {
    expect(postCreateHref(12, ATTENDEE_PLAN.LATER)).toBe(
      "/events/12/edit?created=1",
    );
  });

  it("goes straight to the upload when the user already has the list", () => {
    expect(postCreateHref(12, ATTENDEE_PLAN.UPLOAD)).toBe(
      "/events/12/attendees/import",
    );
  });

  it("falls back to the event for a missing or unknown plan", () => {
    expect(postCreateHref(12, null)).toBe("/events/12/edit?created=1");
    expect(postCreateHref(12, "nonsense")).toBe("/events/12/edit?created=1");
  });
});
