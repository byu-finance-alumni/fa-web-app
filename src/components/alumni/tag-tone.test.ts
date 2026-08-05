import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

import {
  ENGAGEMENT_FLAG_TAGS,
  STATUS_OPTIONS,
  TAG_OPTIONS,
} from "@/constants/dropdowns";

import { DECEASED, DO_NOT_CONTACT, chipTone } from "./tag-tone";

/**
 * Jake, 2026-08-05: "do not make any color of the words other than 'Do Not
 * Contact' as red. The rest — like case competition host and event helper, all
 * those tags at the ways to get involved — need to be blue not green."
 *
 * The chips had drifted into three colours (blue tags, grey status labels, green
 * involvement/designation chips) across two files, so the profile header and the
 * editor panel could disagree about the same label. `chipTone` is the one place
 * the rule lives; these tests pin it, plus the source of the two files that
 * render the chips so a stray `tone="success"` can't creep back in.
 */

function read(relPath: string): string {
  return readFileSync(resolve(process.cwd(), relPath), "utf8");
}

const PROFILE_PAGE = "src/app/(app)/alumni/[id]/page.tsx";
const PROFILE_DIALOGS = "src/components/alumni/ProfileDialogs.tsx";

describe("chipTone", () => {
  it("makes Do Not Contact red", () => {
    expect(chipTone(DO_NOT_CONTACT)).toBe("danger");
  });

  it("makes Do Not Contact the ONLY red label in the whole family", () => {
    const everyLabel = [
      ...TAG_OPTIONS,
      ...STATUS_OPTIONS,
      ...Object.values(ENGAGEMENT_FLAG_TAGS),
    ];
    const red = everyLabel.filter((label) => chipTone(label) === "danger");
    expect([...new Set(red)]).toEqual([DO_NOT_CONTACT]);
  });

  it("makes every tag blue, including the nine ways to get involved", () => {
    for (const tag of TAG_OPTIONS) {
      expect(chipTone(tag), `${tag} should be blue`).toBe("tag");
    }
    // The ones Jake named by hand.
    expect(chipTone("Case Competition Host")).toBe("tag");
    expect(chipTone("Event Helper")).toBe("tag");
    for (const tag of Object.values(ENGAGEMENT_FLAG_TAGS)) {
      expect(chipTone(tag), `${tag} should be blue`).toBe("tag");
    }
  });

  it("makes the remaining status labels blue too", () => {
    for (const label of STATUS_OPTIONS) {
      if (label === DO_NOT_CONTACT || label === DECEASED) continue;
      expect(chipTone(label), `${label} should be blue`).toBe("tag");
    }
  });

  it("keeps Deceased muted grey — not red, not blue", () => {
    // Red is reserved for Do Not Contact; blue would file "Deceased" next to
    // "Mentor". Muted matches the record-status badge shown beside the name.
    expect(chipTone(DECEASED)).toBe("muted");
  });

  it("defaults an unknown label to blue rather than a loud colour", () => {
    expect(chipTone("Something New")).toBe("tag");
  });

  it("is not fooled by casing or stray whitespace", () => {
    expect(chipTone("  do not contact ")).toBe("danger");
    expect(chipTone("DECEASED")).toBe("muted");
  });
});

describe("the chips actually use it", () => {
  it("has no green or amber chips left on the profile", () => {
    const src = read(PROFILE_PAGE);
    expect(src).not.toContain('<EngagementChip key={t} tone="tag">');
    for (const banned of ['tone="success"', 'tone="warning"']) {
      expect(
        src.includes(banned),
        `${PROFILE_PAGE} still renders a chip with ${banned}`,
      ).toBe(false);
    }
  });

  it("derives the tone for tags and status labels instead of hardcoding it", () => {
    const src = read(PROFILE_PAGE);
    expect(src).toContain("chipTone(t)");
    expect(src).toContain("chipTone(s)");
    // Both header rows (mobile + desktop) must go through the helper, or the
    // two halves of the same page drift apart again.
    expect(src.match(/tone=\{chipTone\(t\)\}/g)).toHaveLength(2);
    expect(src.match(/tone=\{chipTone\(s\)\}/g)).toHaveLength(2);
  });

  it("uses the same rule in the editor's tag manager", () => {
    const src = read(PROFILE_DIALOGS);
    expect(src).toContain("variant={chipTone(v)}");
    // The old per-list tone prop is gone: it was what let the manager render a
    // status label grey while the header rendered it something else.
    expect(src).not.toContain("toneVariant");
  });
});
