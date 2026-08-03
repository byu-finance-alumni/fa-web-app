import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

import {
  OTHER_DESIGNATION_SLOTS,
  joinOtherDesignationSlots,
  splitOtherDesignationSlots,
} from "./designations";

/**
 * The survey's finance-designations rework (#529).
 *
 * CFA and CFP are tickboxes backed by their OWN columns
 * (`alumni_program_engagement.cfa_designation` / `.cfp_designation`, which the
 * designation filter and counts read); everything else is three free-text
 * blanks that merge into the single `alumni.other_designations` string. These
 * cover the split/join round trip that merge depends on, plus the structural
 * guarantees that keep a ticked CFA out of the free text and an untouched
 * section out of the submitted payload.
 */

describe("other-designation blanks: split", () => {
  it("always fills exactly the number of blanks the survey shows", () => {
    for (const text of ["", "A", "A, B", "A, B, C", "A, B, C, D, E"]) {
      expect(splitOtherDesignationSlots(text)).toHaveLength(OTHER_DESIGNATION_SLOTS);
    }
  });

  it("puts one stored value per blank, in the alum's order", () => {
    expect(splitOtherDesignationSlots("Series 7, Series 63")).toEqual([
      "Series 7",
      "Series 63",
      "",
    ]);
  });

  it("keeps overflow in the last blank instead of dropping it", () => {
    // Dev already has a 3-value row ("Series 7, Series 66, FRM"), so a 4th is
    // plausible — and losing what an alum told us last year the moment they open
    // the form would be worse than one crowded box they can edit.
    expect(splitOtherDesignationSlots("Series 7, Series 63, FRM, CAIA")).toEqual([
      "Series 7",
      "Series 63",
      "FRM, CAIA",
    ]);
  });

  it("does not treat a CFA-ish free-text entry as anything special", () => {
    // 9 alumni on dev hold "CFA Level II Candidate" — a CANDIDATE, not a holder.
    // It stays free text and must never tick the CFA box.
    expect(splitOtherDesignationSlots("CFA Level II Candidate")).toEqual([
      "CFA Level II Candidate",
      "",
      "",
    ]);
  });
});

describe("other-designation blanks: join", () => {
  it("skips empty blanks rather than emitting stray commas", () => {
    expect(joinOtherDesignationSlots(["Series 7", "", "FRM"])).toBe("Series 7, FRM");
    expect(joinOtherDesignationSlots(["", "", ""])).toBe("");
    expect(joinOtherDesignationSlots(["  ", "Series 65", ""])).toBe("Series 65");
  });

  it("preserves the alum's own order — no sorting, no deduping", () => {
    expect(joinOtherDesignationSlots(["Series 66", "Series 7", "Series 66"])).toBe(
      "Series 66, Series 7, Series 66",
    );
  });

  it("round-trips a stored value unchanged", () => {
    for (const stored of ["Series 7, Series 63", "Series 65", "CPA (inactive)"]) {
      expect(joinOtherDesignationSlots(splitOtherDesignationSlots(stored))).toBe(stored);
    }
  });

  it("round-trips overflow without losing a value", () => {
    const stored = "Series 7, Series 63, FRM, CAIA";
    expect(joinOtherDesignationSlots(splitOtherDesignationSlots(stored))).toBe(stored);
  });

  it("carries the untouched blanks along when one blank is edited", () => {
    // The subtle bit: all three blanks back ONE column, so editing blank 1 has to
    // re-emit blanks 2 and 3 or submitting would blank them out.
    const slots = splitOtherDesignationSlots("Series 7, Series 63, FRM");
    const edited = slots.map((s, i) => (i === 0 ? "Series 79" : s));
    expect(joinOtherDesignationSlots(edited)).toBe("Series 79, Series 63, FRM");
  });

  it("clearing one blank removes only that value", () => {
    const slots = splitOtherDesignationSlots("Series 7, Series 63, FRM");
    const edited = slots.map((s, i) => (i === 1 ? "" : s));
    expect(joinOtherDesignationSlots(edited)).toBe("Series 7, FRM");
  });
});

/* --------------------------------------------------- source invariants ----- */

function read(relPath: string): string {
  return readFileSync(resolve(process.cwd(), relPath), "utf8");
}

describe("survey designations section (#529)", () => {
  const src = read("src/components/survey/survey-screens.tsx");

  it("ticks CFA/CFP/CPA into their own columns, not the free text", () => {
    // If a tickbox ever wrote `profile.other_designations`, that alum would drop
    // out of the designation filter and the counts — a data bug, not a cosmetic
    // one. Pin the keys.
    expect(src).toContain('key: "program.cfa_designation", label: "CFA", kind: "designation"');
    expect(src).toContain('key: "program.cfp_designation", label: "CFP", kind: "designation"');
    expect(src).toContain('key: "program.cpa_designation", label: "CPA", kind: "designation"');
  });

  it("offers exactly three presets — no others", () => {
    // Jake's spec was CFA, CFP and three blanks (#529); CPA was added on
    // 2026-08-03 because it had a column and a filter but no way for an alum to
    // populate it. The preset list only grows on an explicit call like that —
    // otherwise it waits for the responses to show what's actually common.
    expect(src.match(/kind: "designation"/g)).toHaveLength(3);
  });

  it("keeps the three blanks as ONE field over the free-text column", () => {
    expect(src).toContain('key: "profile.other_designations"');
    expect(src).toContain('kind: "otherDesignations"');
  });

  it("only writes an edit from a control's own onChange", () => {
    // An untouched section must submit nothing: the page POSTs `edits`, and a key
    // lands there only via `setEdit`. So no control may call `onChange` on mount
    // or in an effect — the designation controls in particular, since one of them
    // seeds local state from the stored value.
    expect(src).not.toMatch(/useEffect\([^)]*onChange/);
    const control = src.slice(src.indexOf("function OtherDesignationsControl"));
    expect(control).not.toContain("useEffect");
    // Its single onChange call site is inside setSlot, which an input triggers.
    expect(control.slice(0, control.indexOf("function FieldControl")).match(/onChange\(/g))
      .toHaveLength(1);
  });
});
