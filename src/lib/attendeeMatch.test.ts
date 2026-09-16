import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  NO_DECISIONS,
  applyOutcomeLabel,
  approveRow,
  attendeeContext,
  autoConfirmedNote,
  autoConfirmedRows,
  buildApprovals,
  buildFriendRows,
  canApply,
  canCreateFriend,
  candidateContext,
  clearRow,
  confidenceLabel,
  decisionCounts,
  friendOutcomeLabel,
  friendRowsParam,
  isCsvFile,
  normalizeNetId,
  rowAlreadyAttending,
  rowStatusLabel,
  statusLabel,
  statusTone,
  tierLabel,
  toggleApproval,
  toggleFriend,
} from "@/lib/attendeeMatch";
import type {
  AttendeeFriendItem,
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
    corroborated: false,
    evidence: ["Surname matches", "Given name matches"],
    already_attending: false,
    ...overrides,
  };
}

/** An exact Net ID hit (#537): the tier is `netid`, confidence `certain`. */
function netIdCandidate(
  overrides: Partial<AttendeeMatchCandidate> = {},
): AttendeeMatchCandidate {
  return candidate({
    tier: "netid",
    score: 100,
    confidence: "certain",
    corroborated: true,
    evidence: ["Net ID matches"],
    ...overrides,
  });
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
    // The factory default is "may become a friend" so the older suites below
    // keep exercising the friend path; the #537 gate has its own tests.
    friend_eligible: true,
    friend_fields: ["first_name", "last_name"],
    ...overrides,
  };
}

/** A row the backend confirmed on Net ID (#537). */
function autoRow(overrides: Partial<AttendeeMatchRow> = {}): AttendeeMatchRow {
  const base = row();
  return row({
    row: 7,
    status: "matched",
    match_key: "netid",
    auto_confirmed: true,
    reason: "Net ID msmith matched and the email agrees.",
    attendee: { ...base.attendee, name: "Mike Smith", net_id: "MSmith" },
    candidates: [netIdCandidate()],
    friend_eligible: false,
    ...overrides,
  });
}

describe("nothing is ever selected for the reviewer", () => {
  it("starts with no decisions at all", () => {
    const rows = [row({ row: 2 }), row({ row: 3, status: "ambiguous" })];
    expect(decisionCounts(rows, NO_DECISIONS)).toEqual({
      approvals: 0,
      autoConfirmed: 0,
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

describe("Net ID tier (#537): confirmed rows go without review", () => {
  it("always includes an auto-confirmed row, carrying its normalised net_id", () => {
    const rows = [autoRow()];
    expect(buildApprovals(rows, NO_DECISIONS)).toEqual([
      { alumni_id: 1, row: 7, net_id: "msmith" },
    ]);
  });

  it("sends the Net ID candidate, not whichever candidate is listed first", () => {
    const rows = [
      autoRow({
        candidates: [
          candidate({ alumni_id: 5, tier: "email" }),
          netIdCandidate({ alumni_id: 9 }),
        ],
      }),
    ];
    expect(buildApprovals(rows, NO_DECISIONS)).toEqual([
      { alumni_id: 9, row: 7, net_id: "msmith" },
    ]);
  });

  it("includes auto-confirmed rows alongside ticked proposals, and drops unticked ones", () => {
    const rows = [
      autoRow({ row: 1 }),
      row({ row: 2, candidates: [candidate({ alumni_id: 2 })] }),
      row({ row: 3, candidates: [candidate({ alumni_id: 3 })] }),
    ];
    const decisions = approveRow(NO_DECISIONS, 2, 2);
    expect(buildApprovals(rows, decisions)).toEqual([
      { alumni_id: 1, row: 1, net_id: "msmith" },
      { alumni_id: 2, row: 2 },
    ]);
  });

  it("never attaches a net_id to a human approval", () => {
    // An ambiguous row with a Net ID candidate is still a human's pick — the
    // approval must not carry net_id, or the server would audit it as a Net
    // ID match instead of a human approval.
    const rows = [
      row({
        status: "ambiguous",
        candidates: [
          netIdCandidate({ alumni_id: 1 }),
          candidate({ alumni_id: 2, tier: "email" }),
        ],
      }),
    ];
    const decisions = approveRow(NO_DECISIONS, 2, 1);
    expect(buildApprovals(rows, decisions)).toEqual([{ alumni_id: 1, row: 2 }]);
  });

  it("ignores a stray human decision on an auto-confirmed row", () => {
    const rows = [autoRow({ candidates: [netIdCandidate({ alumni_id: 1 })] })];
    const decisions = toggleFriend(NO_DECISIONS, 7);
    expect(buildApprovals(rows, decisions)).toEqual([
      { alumni_id: 1, row: 7, net_id: "msmith" },
    ]);
    expect(buildFriendRows(rows, decisions)).toEqual([]);
  });

  it("falls back to the record's Net ID when the file value is blank", () => {
    const base = autoRow();
    const rows = [
      autoRow({ attendee: { ...base.attendee, net_id: "  " } }),
    ];
    expect(buildApprovals(rows, NO_DECISIONS)).toEqual([
      { alumni_id: 1, row: 7, net_id: "msmith" },
    ]);
  });

  it("does not downgrade a row with no Net ID to send into a human approval", () => {
    const base = autoRow();
    const rows = [
      autoRow({
        attendee: { ...base.attendee, net_id: null },
        candidates: [netIdCandidate({ net_id: null })],
      }),
    ];
    expect(buildApprovals(rows, NO_DECISIONS)).toEqual([]);
    expect(autoConfirmedRows(rows)).toEqual([]);
  });

  it("a file of nothing but Net ID hits can be applied with no clicks", () => {
    const rows = [autoRow({ row: 1 }), autoRow({ row: 2 })];
    expect(decisionCounts(rows, NO_DECISIONS)).toEqual({
      approvals: 0,
      autoConfirmed: 2,
      friends: 0,
      total: 2,
    });
    expect(canApply(rows, NO_DECISIONS)).toBe(true);
  });

  it("counts human approvals separately from Net ID confirmations", () => {
    const rows = [autoRow({ row: 1 }), row({ row: 2 })];
    const decisions = approveRow(NO_DECISIONS, 2, 1);
    expect(decisionCounts(rows, decisions)).toEqual({
      approvals: 1,
      autoConfirmed: 1,
      friends: 0,
      total: 2,
    });
  });

  it("normalises Net IDs the way the server compares them", () => {
    expect(normalizeNetId("  MSmith ")).toBe("msmith");
    expect(normalizeNetId("")).toBeNull();
    expect(normalizeNetId(null)).toBeNull();
  });

  it("labels the tier and confidence in plain words", () => {
    expect(tierLabel("netid")).toBe("Net ID match");
    expect(confidenceLabel("certain")).toBe("Certain");
  });

  it("labels a confirmed row as settled, not as a possible match", () => {
    expect(rowStatusLabel(autoRow())).toBe("Matched by Net ID");
    expect(rowStatusLabel(row())).toBe("One possible match");
  });

  it("shows the backend's reason verbatim, else notes an uncorroborated hit", () => {
    expect(autoConfirmedNote(autoRow())).toBe(
      "Net ID msmith matched and the email agrees.",
    );
    expect(
      autoConfirmedNote(
        autoRow({
          reason: null,
          candidates: [netIdCandidate({ corroborated: false })],
        }),
      ),
    ).toBe(
      "Only the Net ID matched; the email and name on this row did not agree with the record.",
    );
    expect(
      autoConfirmedNote(
        autoRow({
          reason: null,
          candidates: [netIdCandidate({ corroborated: true })],
        }),
      ),
    ).toBeNull();
  });

  it("puts the file's Net ID in the side-by-side context", () => {
    expect(attendeeContext(autoRow())).toBe(
      "Net ID MSmith · mike@goldman.com · Goldman Sachs",
    );
  });

  it("names the net_id_mismatch outcome", () => {
    expect(applyOutcomeLabel("net_id_mismatch")).toBe(
      "Refused: the Net ID on file no longer matched",
    );
    expect(applyOutcomeLabel("added")).toBe("Added");
  });
});

describe("friend eligibility (#537)", () => {
  it("only rows that failed every tier may become friends", () => {
    expect(canCreateFriend(row({ status: "no_match", candidates: [], friend_eligible: true }))).toBe(true);
    // Matched on email but with no Net ID: NOT eligible.
    expect(canCreateFriend(row({ friend_eligible: false }))).toBe(false);
    expect(canCreateFriend(autoRow())).toBe(false);
    expect(
      canCreateFriend(row({ status: "not_reviewed", candidates: [], friend_eligible: true })),
    ).toBe(false);
  });

  it("drops a ticked friend row the backend does not consider eligible", () => {
    const rows = [row({ row: 2, friend_eligible: false })];
    const decisions = toggleFriend(NO_DECISIONS, 2);
    expect(buildFriendRows(rows, decisions)).toEqual([]);
    expect(canApply(rows, decisions)).toBe(false);
  });
});

describe("friend outcomes (#538)", () => {
  const item = (overrides: Partial<AttendeeFriendItem> = {}): AttendeeFriendItem => ({
    row: 3,
    name: "Pat Jones",
    status: "created",
    alumni_id: 43,
    friend_id: "FRIEND-00043",
    is_existing_alumnus: false,
    message: null,
    ...overrides,
  });

  it("names a reused friend by its visible id", () => {
    expect(
      friendOutcomeLabel(item({ status: "reused", alumni_id: 42, friend_id: "FRIEND-00042" })),
    ).toBe("Linked existing friend FRIEND-00042");
  });

  it("tells staff to match an existing alumnus instead", () => {
    expect(
      friendOutcomeLabel(
        item({ status: "existing_alumnus", friend_id: null, is_existing_alumnus: true }),
      ),
    ).toBe("This email belongs to an alumnus. Match them instead of creating a friend.");
  });

  it("names a created friend and the idempotent skip", () => {
    expect(friendOutcomeLabel(item())).toBe("Created friend FRIEND-00043");
    expect(friendOutcomeLabel(item({ status: "skipped" }))).toBe("Already on this roster");
  });
});
