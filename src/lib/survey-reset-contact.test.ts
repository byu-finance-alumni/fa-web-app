/**
 * Who a non-engineer is told to ask for a survey reset (#658).
 *
 * The reset is engineer-only on the backend, so everyone else who can see that
 * an alumna is held out can do nothing about it. The one useful thing the UI can
 * give them is a name — pulled from the engineer-managed support contacts, so it
 * follows the engineer rather than a deploy. These pin the two ways that goes
 * wrong: picking the wrong row, and inventing an address when there is no row.
 */
import { describe, expect, it } from "vitest";

import {
  engineerSupportContact,
  FINANCE_DEPARTMENT,
  heldOutNamesRequireEngineer,
  resetContactPhrase,
  resetRequiresEngineerHint,
} from "./survey-reset-contact";
import type { SupportContact } from "@/types/support";

function contact(over: Partial<SupportContact> = {}): SupportContact {
  return {
    support_contact_id: 1,
    role_label: "Engineer",
    name: "Jake Gunn",
    email: "gunnjake@byu.edu",
    sort_order: 1,
    ...over,
  };
}

describe("engineerSupportContact", () => {
  it("picks the engineer's row out of the list", () => {
    const engineer = contact({ support_contact_id: 2, sort_order: 2 });
    const found = engineerSupportContact([
      contact({
        support_contact_id: 1,
        role_label: "Super Admin",
        name: "Tanya",
        email: "tanya@byu.edu",
        sort_order: 1,
      }),
      engineer,
    ]);
    expect(found).toEqual(engineer);
  });

  it("matches however the engineer spelled their own label", () => {
    // `role_label` is free text typed into the support-contacts editor. The
    // migration seeds "Engineer", but anyone can retype it — and a label that
    // still plainly says engineer must not fall through to the department.
    for (const label of ["engineer", "ENGINEER", "Engineer (BYU IT)"]) {
      expect(engineerSupportContact([contact({ role_label: label })])).not.toBeNull();
    }
  });

  it("returns null when the list has no engineer at all", () => {
    expect(
      engineerSupportContact([contact({ role_label: "Super Admin" })]),
    ).toBeNull();
    expect(engineerSupportContact([])).toBeNull();
    expect(engineerSupportContact(null)).toBeNull();
  });

  it("takes the engineer's own ordering when there are several", () => {
    // `sort_order` is the field the engineer controls; array order is whatever
    // the endpoint happened to return.
    const second = contact({ support_contact_id: 9, sort_order: 1, name: "First" });
    const found = engineerSupportContact([
      contact({ support_contact_id: 8, sort_order: 5, name: "Later" }),
      second,
    ]);
    expect(found?.name).toBe("First");
  });
});

describe("who to contact", () => {
  it("names the engineer and their address", () => {
    expect(resetContactPhrase(contact())).toBe("Jake Gunn at gunnjake@byu.edu");
  });

  it("falls back to the Finance Department, with no invented address", () => {
    // Jake's rule (2026-08-07). A fabricated mailbox is worse than none: mail
    // sent into it looks delivered.
    expect(resetContactPhrase(null)).toBe(FINANCE_DEPARTMENT);
    expect(resetContactPhrase(null)).not.toContain("@");
  });
});

describe("the hints shown in place of the reset", () => {
  it("says an engineer is required and who that is", () => {
    const hint = resetRequiresEngineerHint(contact());
    expect(hint).toMatch(/only an engineer can reset a survey/i);
    expect(hint).toContain("Jake Gunn at gunnjake@byu.edu");
    expect(hint).toMatch(/reset this alum/i);
  });

  it("explains the missing NAMES too, not just the missing button", () => {
    // The held-out list endpoint is engineer-gated as well, so a non-engineer
    // sees a count and no names. Saying only "ask the engineer to reset" would
    // leave them wondering why the list is empty.
    const hint = heldOutNamesRequireEngineer(contact());
    expect(hint).toMatch(/see who these alumni are/i);
    expect(hint).toContain("Jake Gunn at gunnjake@byu.edu");
  });

  it("names the Finance Department in both when nobody is configured", () => {
    for (const hint of [
      resetRequiresEngineerHint(null),
      heldOutNamesRequireEngineer(null),
    ]) {
      expect(hint).toContain(FINANCE_DEPARTMENT);
      expect(hint).not.toContain("@");
    }
  });
});
