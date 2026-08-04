import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  NO_DECISIONS,
  approveRow,
  attendeeContext,
  buildApprovals,
  buildFriendRows,
  canApply,
  candidateContext,
  clearRow,
  decisionCounts,
  friendRowsParam,
  isCsvFile,
  rowAlreadyAttending,
  statusLabel,
  statusTone,
  tierLabel,
  toggleApproval,
  toggleFriend,
} from "@/lib/attendeeMatch";
import type {
  AttendeeMatchCandidate,
  AttendeeMatchRow,
} from "@/types/attendee-match";

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
    tier: "name",
    score: 60,
    confidence: "medium",
    evidence: ["Surname matches", "Given name matches"],
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
      company: "Goldman Sachs",
      title: null,
      graduation_year: null,
    },
    match_key: "email",
    candidates: [candidate()],
    warnings: [],
    friend_fields: ["first_name", "last_name"],
    ...overrides,
  };
}

describe("nothing is ever selected for the reviewer", () => {
  it("starts with no decisions at all", () => {
    const rows = [row({ row: 2 }), row({ row: 3, status: "ambiguous" })];
    expect(decisionCounts(rows, NO_DECISIONS)).toEqual({
      approvals: 0,
      friends: 0,
      total: 0,
    });
    expect(canApply(rows, NO_DECISIONS)).toBe(false);
  });

  it("does not pre-select even a high-confidence email match", () => {
    const rows = [
      row({
        candidates: [
          candidate({ tier: "email", confidence: "high", score: 100 }),
        ],
      }),
    ];
    expect(buildApprovals(rows, NO_DECISIONS)).toEqual([]);
  });

  it("exposes no bulk-select or confidence-threshold helper", () => {
    // The guard is the module's public surface: adding a "select all" or an
    // "approve above X" helper here is what #612 forbids.
    const source = readFileSync("src/lib/attendeeMatch.ts", "utf8");
    expect(source).not.toMatch(/selectAll|approveAll|autoApprove|threshold/i);
  });
});

describe("decisions", () => {
  it("records an approval for one specific candidate", () => {
    const rows = [row()];
    const decisions = approveRow(NO_DECISIONS, 2, 1);
    expect(buildApprovals(rows, decisions)).toEqual([{ alumni_id: 1, row: 2 }]);
  });

  it("toggling the same candidate again clears the row", () => {
    let decisions = toggleApproval(NO_DECISIONS, 2, 1);
    decisions = toggleApproval(decisions, 2, 1);
    expect(buildApprovals([row()], decisions)).toEqual([]);
  });

  it("choosing a different candidate replaces the previous choice", () => {
    const rows = [
      row({
        status: "ambiguous",
        candidates: [candidate({ alumni_id: 1 }), candidate({ alumni_id: 2 })],
      }),
    ];
    let decisions = toggleApproval(NO_DECISIONS, 2, 1);
    decisions = toggleApproval(decisions, 2, 2);
    expect(buildApprovals(rows, decisions)).toEqual([{ alumni_id: 2, row: 2 }]);
  });

  it("a row can never be both approved and created as a friend", () => {
    const rows = [row()];
    let decisions = approveRow(NO_DECISIONS, 2, 1);
    decisions = toggleFriend(decisions, 2);
    expect(buildApprovals(rows, decisions)).toEqual([]);
    expect(buildFriendRows(rows, decisions)).toEqual([2]);

    decisions = toggleApproval(decisions, 2, 1);
    expect(buildFriendRows(rows, decisions)).toEqual([]);
    expect(buildApprovals(rows, decisions)).toEqual([{ alumni_id: 1, row: 2 }]);
  });

  it("clearRow removes a decision", () => {
    const decisions = clearRow(approveRow(NO_DECISIONS, 2, 1), 2);
    expect(canApply([row()], decisions)).toBe(false);
  });
});

describe("stale selections cannot smuggle in an unproposed id", () => {
  it("drops an approval whose candidate the preview no longer offers", () => {
    const decisions = approveRow(NO_DECISIONS, 2, 999);
    expect(buildApprovals([row()], decisions)).toEqual([]);
  });

  it("drops a friend row that is no longer in the preview", () => {
    const decisions = toggleFriend(NO_DECISIONS, 42);
    expect(buildFriendRows([row({ row: 2 })], decisions)).toEqual([]);
  });
});

describe("friend row serialization", () => {
  it("serializes chosen rows as the comma-separated form value", () => {
    const rows = [row({ row: 2 }), row({ row: 5 }), row({ row: 9 })];
    let decisions = toggleFriend(NO_DECISIONS, 2);
    decisions = toggleFriend(decisions, 9);
    expect(friendRowsParam(buildFriendRows(rows, decisions))).toBe("2,9");
  });
});

describe("labels and context", () => {
  it("does not colour a proposed match as done", () => {
    // "matched" is still awaiting a human, so it must not read as success.
    expect(statusTone("matched")).toBe("neutral");
    expect(statusTone("ambiguous")).toBe("warning");
    expect(statusLabel("ambiguous")).toBe("Several possible matches");
    expect(statusLabel("no_match")).toBe("No match found");
  });

  it("names the matching leg in words", () => {
    expect(tierLabel("email")).toBe("Email match");
    expect(tierLabel("name_company")).toBe("Given name + employer only");
  });

  it("builds a disambiguating one-liner without nulls", () => {
    expect(candidateContext(candidate())).toBe(
      "Class of 2010 · Managing Director · Goldman Sachs · New York, New York · Net ID msmith",
    );
    expect(
      candidateContext(
        candidate({
          graduation_year: null,
          title: null,
          city: null,
          state: null,
          net_id: null,
          is_alumni: false,
        }),
      ),
    ).toBe("Goldman Sachs · Friend record");
  });

  it("echoes what the file said for side-by-side comparison", () => {
    expect(attendeeContext(row())).toBe("mike@goldman.com · Goldman Sachs");
  });

  it("flags a row whose every candidate is already on the roster", () => {
    expect(
      rowAlreadyAttending(
        row({ candidates: [candidate({ already_attending: true })] }),
      ),
    ).toBe(true);
    expect(rowAlreadyAttending(row({ candidates: [] }))).toBe(false);
  });
});

describe("file picking", () => {
  const file = (name: string, type = ""): File =>
    ({ name, type }) as unknown as File;

  it("accepts .csv and rejects everything else", () => {
    expect(isCsvFile(file("attendees.csv"))).toBe(true);
    expect(isCsvFile(file("ATTENDEES.CSV"))).toBe(true);
    expect(isCsvFile(file("attendees", "text/csv"))).toBe(true);
    expect(isCsvFile(file("attendees.xlsx"))).toBe(false);
  });
});

describe("no icons in the wizard", () => {
  it("uses text-only controls per UX-UI.md / CLAUDE.md", () => {
    const source = readFileSync(
      "src/components/events/import/AttendeeMatchWizard.tsx",
      "utf8",
    );
    expect(source).not.toContain("lucide-react");
  });
});

describe('not_reviewed rows', () => {
  it('never become friend records', () => {
    // The preview never looked this person up, so creating a friend would be
    // creating a duplicate of somebody nobody checked for.
    const rows = [row({ row: 4, status: 'not_reviewed', candidates: [] })];
    const decisions = toggleFriend(NO_DECISIONS, 4);
    expect(buildFriendRows(rows, decisions)).toEqual([]);
    expect(canApply(rows, decisions)).toBe(false);
  });

  it('reads as unfinished work, not as an absent person', () => {
    expect(statusLabel('not_reviewed')).toBe('Not reviewed');
    expect(statusTone('not_reviewed')).toBe('warning');
  });
});
