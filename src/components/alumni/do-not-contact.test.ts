import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

import { STATUS_OPTIONS } from "@/constants/dropdowns";

import {
  DO_NOT_CONTACT,
  DO_NOT_CONTACT_BANNER_TITLE,
  doNotContactBannerBody,
  doNotContactCopy,
  isDoNotContact,
} from "./do-not-contact";

/**
 * #772 — Tanya asked for a "Do not contact" button on the alumni record and for
 * the survey to skip anyone carrying it. The survey ALREADY skips them
 * (`_suppressed_from_send()` in fa-web-api, pinned by
 * `tests/test_survey_send_correctness.py`), so the whole risk in this change is
 * on this side: that the button quietly becomes a SECOND source of truth, or
 * that the direction which re-opens contact to someone who asked not to be
 * contacted turns out to be one unguarded click.
 *
 * These tests pin the derivation and the copy, then read the two files that
 * render the control so neither guarantee can be edited away.
 */

function read(relPath: string): string {
  return readFileSync(resolve(process.cwd(), relPath), "utf8");
}

const PROFILE_PAGE = "src/app/(app)/alumni/[id]/page.tsx";
const PROFILE_DIALOGS = "src/components/alumni/ProfileDialogs.tsx";
const ALUMNI_ACTIONS = "src/app/(app)/alumni/actions.ts";

describe("the label itself", () => {
  it("is one of the canonical status labels — not a new field", () => {
    // If this ever fails, someone has invented a parallel flag. The whole point
    // of #772 is that there is exactly one "never contact this person".
    expect(STATUS_OPTIONS).toContain(DO_NOT_CONTACT);
    expect(DO_NOT_CONTACT).toBe("Do Not Contact");
  });
});

describe("isDoNotContact", () => {
  it("is false for a record with no labels at all", () => {
    expect(isDoNotContact([])).toBe(false);
    expect(isDoNotContact(null)).toBe(false);
    expect(isDoNotContact(undefined)).toBe(false);
  });

  it("is true when the label is present alongside others", () => {
    expect(isDoNotContact(["Retired", DO_NOT_CONTACT, "Lost Contact"])).toBe(
      true,
    );
  });

  it("is not fooled by casing or stray whitespace", () => {
    // The backend compares with ILIKE, so a label that suppresses the send
    // server-side must never fail to light up the record here.
    expect(isDoNotContact(["  do not contact "])).toBe(true);
    expect(isDoNotContact(["DO NOT CONTACT"])).toBe(true);
  });

  it("is false for every OTHER status label", () => {
    for (const label of STATUS_OPTIONS) {
      if (label === DO_NOT_CONTACT) continue;
      expect(isDoNotContact([label]), `${label} must not suppress`).toBe(false);
    }
    // "Deceased" also suppresses the send, but it is a different label with a
    // different meaning; this control must not claim to own it.
    expect(isDoNotContact(["Deceased"])).toBe(false);
  });
});

describe("turning it ON", () => {
  const copy = doNotContactCopy(false);

  it("offers to SET the label", () => {
    expect(copy.direction).toBe("set");
    expect(copy.buttonLabel).toBe("Mark do not contact");
  });

  it("confirms before it stops all survey contact", () => {
    expect(copy.confirmTitle).toBeTruthy();
    expect(copy.confirmCta).toBeTruthy();
    const body = copy.confirmBody("Dana Reyes");
    expect(body).toContain("Dana Reyes");
    expect(body.toLowerCase()).toContain("survey");
    expect(body.toLowerCase()).toContain("audit trail");
  });

  it("names the person in the success toast", () => {
    expect(copy.successToast("Dana Reyes")).toContain("Dana Reyes");
  });

  it("is not the red button — protecting someone is not destructive", () => {
    expect(copy.confirmVariant).toBe("primary");
  });
});

describe("turning it OFF — the riskier direction", () => {
  const copy = doNotContactCopy(true);

  it("offers to CLEAR the label", () => {
    expect(copy.direction).toBe("clear");
    expect(copy.buttonLabel).toBe("Allow contact again");
  });

  it("confirms, and says what removing it actually does", () => {
    const body = copy.confirmBody("Dana Reyes");
    expect(body).toContain("Dana Reyes");
    // It must state the consequence — back into sends and worklists — not just
    // ask "are you sure?".
    expect(body.toLowerCase()).toContain("survey sends");
    expect(body.toLowerCase()).toContain("worklist");
    // And that the removal is attributable.
    expect(body.toLowerCase()).toContain("audit trail");
  });

  it("gets the red button, because this is the direction that can harm", () => {
    expect(copy.confirmVariant).toBe("destructive");
    expect(doNotContactCopy(false).confirmVariant).not.toBe(
      copy.confirmVariant,
    );
  });

  it("reads differently from the ON direction in every slot", () => {
    const on = doNotContactCopy(false);
    expect(copy.buttonLabel).not.toBe(on.buttonLabel);
    expect(copy.confirmTitle).not.toBe(on.confirmTitle);
    expect(copy.confirmCta).not.toBe(on.confirmCta);
    expect(copy.confirmBody("Dana Reyes")).not.toBe(on.confirmBody("Dana Reyes"));
    expect(copy.pendingLabel).not.toBe(on.pendingLabel);
  });
});

describe("copy with no usable name", () => {
  it("never renders an empty subject or a stray 'undefined'", () => {
    for (const active of [true, false]) {
      const copy = doNotContactCopy(active);
      for (const text of [
        copy.confirmBody(""),
        copy.confirmBody("   "),
        copy.successToast(""),
      ]) {
        expect(text).not.toContain("undefined");
        expect(text.trimStart().startsWith("is")).toBe(false);
        expect(text).toContain("This alumnus");
      }
    }
    expect(doNotContactBannerBody("")).toContain("This alumnus");
  });
});

describe("the banner", () => {
  it("states the exclusion in words, not just a coloured chip", () => {
    expect(DO_NOT_CONTACT_BANNER_TITLE.toLowerCase()).toContain(
      "do not contact",
    );
    const body = doNotContactBannerBody("Dana Reyes");
    expect(body).toContain("Dana Reyes");
    expect(body.toLowerCase()).toContain("survey send");
    expect(body.toLowerCase()).toContain("worklist");
  });
});

describe("the record actually wires it up", () => {
  it("sets and clears the EXISTING status label — no second mechanism", () => {
    const src = read(PROFILE_DIALOGS);
    // The control calls the same two server actions the chip manager has always
    // used, with the canonical label constant. A new endpoint, a boolean column
    // or a `do_not_contact` field would show up as a miss here.
    expect(src).toContain("removeStatusLabel(alumniId, DO_NOT_CONTACT)");
    expect(src).toContain("addStatusLabel(alumniId, DO_NOT_CONTACT)");
    for (const banned of [
      "do_not_contact",
      "doNotContactFlag",
      "suppressContact",
    ]) {
      expect(
        src.includes(banned),
        `${PROFILE_DIALOGS} looks like it grew a second suppression path (${banned})`,
      ).toBe(false);
    }
    // …and no new server action / endpoint was added to carry it. The two
    // status-label actions are the whole write path.
    const actions = read(ALUMNI_ACTIONS);
    expect(actions).toContain("/status-labels");
    for (const banned of ["doNotContact", "do_not_contact", "do-not-contact"]) {
      expect(
        actions.includes(banned),
        `${ALUMNI_ACTIONS} grew a dedicated do-not-contact write path (${banned})`,
      ).toBe(false);
    }
  });

  it("puts BOTH directions behind the confirm dialog", () => {
    const src = read(PROFILE_DIALOGS);
    // One dialog component, and the control only ever opens it — the actions
    // are reachable from `onConfirm`, never from the trigger's own onClick.
    expect(src).toContain("function DoNotContactConfirm");
    expect(src).toContain("<DoNotContactConfirm");
    const control = src.slice(src.indexOf("export function DoNotContactControl"));
    const trigger = control.slice(0, control.indexOf("<DoNotContactConfirm"));
    expect(trigger).toContain("setConfirming(true)");
    expect(trigger).not.toContain("addStatusLabel(");
    expect(trigger).not.toContain("removeStatusLabel(");
  });

  it("routes the chip manager's Do Not Contact chip through the same confirm", () => {
    // The drawer's +/x chips are a second door onto the same label. If they
    // stayed unguarded, the risky direction would still be one click away.
    const src = read(PROFILE_DIALOGS);
    expect(src).toContain("request(v, true)");
    expect(src).toContain("request(v, false)");
    expect(src).toContain("if (isDoNotContact([value]))");
  });

  it("derives the on/off state instead of matching the string by hand", () => {
    const dialogs = read(PROFILE_DIALOGS);
    expect(dialogs).toContain("isDoNotContact(statusLabels)");
    // A raw comparison against the literal is how the header and the drawer
    // drifted apart the last time (see tag-tone).
    expect(dialogs).not.toContain('=== "Do Not Contact"');
    expect(read(PROFILE_PAGE)).not.toContain('=== "Do Not Contact"');
  });

  it("shows the banner to every role but offers the button only to editors", () => {
    const src = read(PROFILE_PAGE);
    // The banner is rendered unconditionally (it self-hides when the label is
    // absent) so a view-only professor about to email someone still sees it.
    expect(src).toContain(
      "<DoNotContactBanner name={name} statusLabels={profile.status_labels} />",
    );
    // Both control instances (desktop header + mobile FAB) sit inside a
    // `canEdit` branch, mirroring the backend's RequireAlumniEdit on
    // POST/DELETE /alumni/{id}/status-labels.
    const controls = src.match(/<DoNotContactControl/g) ?? [];
    expect(controls).toHaveLength(2);
    for (const index of [...src.matchAll(/<DoNotContactControl/g)].map(
      (m) => m.index ?? 0,
    )) {
      const before = src.slice(0, index);
      expect(
        before.lastIndexOf("canEdit ?") > before.lastIndexOf("</ProfileFab>"),
        "a DoNotContactControl escaped its canEdit gate",
      ).toBe(true);
    }
  });

  it("is text-only — no icon on the control or the banner", () => {
    const src = read(PROFILE_DIALOGS);
    const start = src.indexOf("do not contact (#772)");
    const block = src.slice(start, src.indexOf("Square checkbox", start));
    expect(block).not.toMatch(/<(Check|Pencil|Trash2|X)\b/);
    expect(block).not.toContain("lucide-react");
  });
});
