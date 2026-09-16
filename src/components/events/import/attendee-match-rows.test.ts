import { readFileSync } from "node:fs";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import {
  ApplyOutcomes,
  FriendOutcomes,
  ReviewRow,
} from "@/components/events/import/AttendeeMatchRows";
import { NO_DECISIONS } from "@/lib/attendeeMatch";
import type {
  AttendeeFriendItem,
  AttendeeMatchCandidate,
  AttendeeMatchRow,
} from "@/types/attendee-match";

/**
 * Rendered-output tests for the match wizard's rows (#537, #538). They render
 * the real components to static HTML in Node — no DOM, no browser — and read
 * the markup, so a checkbox that should not exist is proven absent rather than
 * assumed from a helper's return value.
 */

function candidate(
  overrides: Partial<AttendeeMatchCandidate> = {},
): AttendeeMatchCandidate {
  return {
    alumni_id: 1,
    name: "Michael Smith",
    first_name: "Michael",
    middle_name: null,
    last_name: "Smith",
    preferred_first_name: null,
    birth_name: null,
    net_id: "msmith",
    graduation_year: 2010,
    is_alumni: true,
    employer: "Goldman Sachs",
    title: "Managing Director",
    city: "New York",
    state: "New York",
    personal_email: null,
    work_email: null,
    tier: "email",
    score: 90,
    confidence: "high",
    corroborated: false,
    evidence: ["Email matches"],
    already_attending: false,
    ...overrides,
  };
}

function row(overrides: Partial<AttendeeMatchRow> = {}): AttendeeMatchRow {
  return {
    row: 2,
    status: "matched",
    attendee: {
      name: "Mike Smith",
      first_name: "Mike",
      last_name: "Smith",
      maiden_name: null,
      email: "mike@goldman.com",
      net_id: null,
      company: "Goldman Sachs",
      title: null,
      graduation_year: null,
    },
    match_key: "email",
    auto_confirmed: false,
    reason: null,
    candidates: [candidate()],
    warnings: [],
    friend_eligible: false,
    friend_fields: ["first_name", "last_name"],
    ...overrides,
  };
}

const noop = () => {};

function renderRow(r: AttendeeMatchRow): string {
  return renderToStaticMarkup(
    createElement(ReviewRow, {
      row: r,
      decisions: NO_DECISIONS,
      onToggleCandidate: noop,
      onToggleFriend: noop,
    }),
  );
}

const checkboxes = (html: string) =>
  (html.match(/type="checkbox"/g) ?? []).length;

describe("ReviewRow: a Net ID match is confirmed, not proposed (#537)", () => {
  const confirmed = row({
    row: 7,
    match_key: "netid",
    auto_confirmed: true,
    reason: "Net ID msmith matched; the email agrees.",
    attendee: { ...row().attendee, net_id: "msmith" },
    candidates: [
      candidate({
        tier: "netid",
        confidence: "certain",
        corroborated: true,
        evidence: ["Net ID matches"],
      }),
    ],
  });

  it("renders without any checkbox", () => {
    const html = renderRow(confirmed);
    expect(checkboxes(html)).toBe(0);
    expect(html).toContain("Matched by Net ID");
    expect(html).toContain("nothing to approve");
    // The record is still shown, so the reviewer can see WHO was confirmed.
    expect(html).toContain('href="/alumni/1"');
    expect(html).toContain("Net ID match");
    expect(html).toContain("Certain");
  });

  it("shows the backend's reason verbatim", () => {
    expect(renderRow(confirmed)).toContain(
      "Net ID msmith matched; the email agrees.",
    );
  });

  it("notes an uncorroborated hit when the backend gives no reason", () => {
    const html = renderRow({
      ...confirmed,
      reason: null,
      candidates: [
        candidate({ tier: "netid", confidence: "certain", corroborated: false }),
      ],
    });
    expect(html).toContain("Only the Net ID matched");
  });

  it("never offers the friend checkbox on a confirmed row", () => {
    expect(renderRow(confirmed)).not.toContain("friend-of-the-program");
  });
});

describe("ReviewRow: an ambiguous Net ID / email split shows both (#537)", () => {
  it("renders both candidates with their tiers, the reason, and a checkbox each", () => {
    const html = renderRow(
      row({
        status: "ambiguous",
        match_key: "netid",
        reason:
          "The Net ID points at Michael Smith but the email belongs to Mike Smithson.",
        attendee: { ...row().attendee, net_id: "msmith" },
        candidates: [
          candidate({ alumni_id: 1, tier: "netid", confidence: "certain" }),
          candidate({
            alumni_id: 2,
            name: "Mike Smithson",
            tier: "email",
            confidence: "high",
          }),
        ],
      }),
    );
    expect(checkboxes(html)).toBe(2);
    expect(html).toContain('href="/alumni/1"');
    expect(html).toContain('href="/alumni/2"');
    expect(html).toContain("Net ID match");
    expect(html).toContain("Email match");
    expect(html).toContain("The Net ID points at Michael Smith");
    expect(html).toContain("Several people could be this attendee");
    expect(html).not.toContain("nothing to approve");
  });
});

describe("ReviewRow: the friend checkbox follows friend_eligible (#537)", () => {
  it("is hidden on a row that matched on email but has no Net ID", () => {
    const html = renderRow(row({ friend_eligible: false }));
    // The one checkbox is the candidate's; nothing offers a friend record.
    expect(checkboxes(html)).toBe(1);
    expect(html).not.toContain("friend-of-the-program");
  });

  it("is offered on a row that failed every tier", () => {
    const html = renderRow(
      row({ status: "no_match", candidates: [], friend_eligible: true }),
    );
    expect(checkboxes(html)).toBe(1);
    expect(html).toContain("Create a friend-of-the-program record instead");
    expect(html).toContain("Will store: first_name, last_name");
  });

  it("is hidden on a not_reviewed row even if the backend flags it", () => {
    const html = renderRow(
      row({ status: "not_reviewed", candidates: [], friend_eligible: true }),
    );
    expect(html).not.toContain("friend-of-the-program");
  });
});

describe("Done step outcomes (#537, #538)", () => {
  const friend = (
    overrides: Partial<AttendeeFriendItem> = {},
  ): AttendeeFriendItem => ({
    row: 3,
    name: "Pat Jones",
    status: "created",
    alumni_id: 43,
    friend_id: "FRIEND-00043",
    is_existing_alumnus: false,
    message: null,
    ...overrides,
  });

  it("renders a reused friend by its id and an existing alumnus as advice", () => {
    const html = renderToStaticMarkup(
      createElement(FriendOutcomes, {
        items: [
          friend({ status: "reused", alumni_id: 42, friend_id: "FRIEND-00042" }),
          friend({
            row: 4,
            name: "Sam Lee",
            status: "existing_alumnus",
            alumni_id: 9,
            friend_id: null,
            is_existing_alumnus: true,
          }),
          friend(),
        ],
      }),
    );
    expect(html).toContain("Row 3: Pat Jones: Linked existing friend FRIEND-00042");
    expect(html).toContain(
      "Row 4: Sam Lee: This email belongs to an alumnus. Match them instead of creating a friend.",
    );
    expect(html).toContain("Created friend FRIEND-00043");
    // Raw status codes never reach the screen.
    expect(html).not.toContain("existing_alumnus");
  });

  it("renders a Net ID mismatch in words", () => {
    const html = renderToStaticMarkup(
      createElement(ApplyOutcomes, {
        items: [
          {
            alumni_id: 1,
            row: 7,
            status: "net_id_mismatch",
            name: "Michael Smith",
            message: null,
          },
          { alumni_id: 2, row: 8, status: "added", name: "Jane Doe", message: null },
        ],
      }),
    );
    expect(html).toContain(
      "Row 7: Michael Smith: Refused: the Net ID on file no longer matched",
    );
    expect(html).toContain("Row 8: Jane Doe: Added");
    expect(html).not.toContain("net_id_mismatch");
  });
});

describe("wizard copy and structure (#537)", () => {
  const wizard = readFileSync(
    "src/components/events/import/AttendeeMatchWizard.tsx",
    "utf8",
  );

  it("explains the Net ID tier first and keeps email / name as proposals", () => {
    expect(wizard).not.toContain("Net IDs are not needed");
    expect(wizard).toMatch(/matched on\s+their <strong>Net ID<\/strong> first/);
    expect(wizard).toContain("needs no review");
    expect(wizard).toContain("has a Net ID column");
    expect(wizard).toMatch(/Every email or name match is a <strong>proposal<\/strong>/);
  });

  it("surfaces the auto-confirmed count and the mismatch outcome", () => {
    expect(wizard).toContain("preview.summary.auto_confirmed");
    expect(wizard).toContain("matched by Net ID, will be added without review");
    expect(wizard).toContain("applyResult.net_id_mismatch");
    expect(wizard).toContain("friendResult?.reused");
    expect(wizard).toContain("friendResult?.existing_alumni");
  });

  it("does not hardcode a column list the template would have to agree with", () => {
    // The example CSV comes from the backend template; the wizard only names
    // columns in prose. A `const COLUMNS = [...]` here would drift from it.
    expect(wizard).not.toMatch(/COLUMNS?\s*=\s*\[/);
  });

  it("uses text-only controls in the row module too", () => {
    const rows = readFileSync(
      "src/components/events/import/AttendeeMatchRows.tsx",
      "utf8",
    );
    expect(rows).not.toContain("lucide-react");
  });
});
