import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

import {
  ENGAGEMENT_SECTION,
  INFO_SECTIONS,
  WAYS_TO_HELP_FIELDS,
  WAYS_TO_HELP_FIELD_KEYS,
} from "./survey-screens";
import { RESPONSE_STATUS } from "@/components/engineer/SurveyCampaignReset";

/**
 * The ways-to-help page (#755) — its question list, and the invariants about
 * the two pages that reach it which no unit test can observe by rendering,
 * because this suite runs in Node with no DOM.
 *
 * The source-text guards below are deliberately narrow: each one names a
 * specific regression that has a real cost and no other alarm. "Confirming
 * silently records nothing" is exactly the bug this issue is about, and it
 * looks completely fine on screen — the alum still sees a thank-you.
 */

const root = fileURLToPath(new URL("../../..", import.meta.url));
const read = (rel: string) => readFileSync(`${root}/${rel}`, "utf8");

const REVIEW_PAGE = "src/app/survey/[token]/page.tsx";
const HELP_PAGE = "src/app/survey/[token]/help/page.tsx";

describe("the involvement questions the page asks", () => {
  it("asks the edit flow's engagement questions, in the same order", () => {
    const expected = ENGAGEMENT_SECTION.fields.map((f) => f.key);
    expect(WAYS_TO_HELP_FIELD_KEYS).toEqual(expected);
    expect(WAYS_TO_HELP_FIELDS.length).toBeGreaterThan(0);
  });

  it("asks the Pay It Forward giving question, WITH its donate link", () => {
    // Jake's call, 2026-08-25, asked explicitly: giving stays on this page.
    // These alumni confirmed in one click, so they are the most willing
    // audience the survey ever has.
    //
    // The donate URL riding along is the point, not an accident. The question
    // is only worth asking with a way to act on it — "would you like to
    // donate?" with no donate button would recreate the exact dead end this
    // page exists to remove.
    const giving = WAYS_TO_HELP_FIELDS.find(
      (f) => f.key === "program.piff_donor",
    );
    expect(giving).toBeDefined();
    expect(giving?.donateUrl).toBeTruthy();
    expect(WAYS_TO_HELP_FIELD_KEYS).toContain("program.piff_donor");
  });

  it("asks the same giving question the edit flow does, not a copy", () => {
    // Identity, not equality: the page aliases ENGAGEMENT_SECTION rather than
    // rebuilding it, so the two can never drift into asking differently-worded
    // versions of the same question.
    const fromEdit = ENGAGEMENT_SECTION.fields.find(
      (f) => f.key === "program.piff_donor",
    );
    const fromPage = WAYS_TO_HELP_FIELDS.find(
      (f) => f.key === "program.piff_donor",
    );
    expect(fromPage).toBe(fromEdit);
  });

  it("never asks a profile field", () => {
    // The alum has just told us their details are right. Re-showing a name or
    // an employer here re-asks the question they answered, and would let this
    // page stage a change to a record it never displayed.
    const profileKeys = new Set(INFO_SECTIONS.flatMap((s) => s.fields).map((f) => f.key));
    for (const key of WAYS_TO_HELP_FIELD_KEYS) {
      expect(profileKeys.has(key)).toBe(false);
    }
  });

  it("asks only Yes/No questions, so there is nothing to validate", () => {
    for (const field of WAYS_TO_HELP_FIELDS) {
      expect(field.kind).toBe("boolean");
    }
  });
});

describe("confirming records the confirmation", () => {
  const source = read(REVIEW_PAGE);

  it("POSTs `confirmed_only` instead of flipping client state", () => {
    // The whole bug: `onClick={() => setStatus("confirmed")}` sent no request,
    // so a confirming alum left no trace at all.
    expect(source).toContain("confirmOnlyBody()");
    expect(source).toContain('method: "POST"');
    expect(source).not.toContain('setStatus("confirmed")');
  });

  it("has no local `confirmed` screen left to fall back into", () => {
    expect(source).not.toMatch(/status === "confirmed"/);
    expect(source).toMatch(/type Status = "review" \| "editing" \| "submitted"/);
  });

  it("sends the alum on to the ways-to-help page", () => {
    expect(source).toContain("waysToHelpHref(token)");
  });

  it("does not swallow a failed confirmation", () => {
    // No `catch {}`, and no navigation before the status is known: a failure
    // keeps the alum on the review screen with a message, never on a
    // thank-you screen for a confirmation that was never recorded.
    expect(source).toContain("confirmErrorMessage(status)");
    expect(source).toContain("setConfirmError");
    expect(source).toContain("isDeadTokenStatus(status)");
  });

  it("keeps 'I need to make changes' working on the review screen", () => {
    expect(source).toContain('setStatus("editing")');
    expect(source).toContain("I need to make changes");
  });
});

describe("the ways-to-help page", () => {
  const source = read(HELP_PAGE);

  it("wears the shared survey shell and adds no second one", () => {
    expect(source).toContain("<SurveyPageShell>");
    // The shell already provides the masthead, the reading column and the
    // sign-off. A second `<main>`, a second 800px column or a second footer
    // here would double them — and any full-width element between the photo and
    // the content reads as a pale band, which has regressed four times.
    expect(source).not.toContain("<main");
    expect(source).not.toContain("<footer");
    expect(source).not.toContain("max-w-[800px]");
  });

  it("edits no fields — it renders the ways-to-help screen and nothing else", () => {
    expect(source).toContain("<WaysToHelp");
    expect(source).not.toContain("EditFlow");
    expect(source).not.toContain("INFO_SECTIONS");
    expect(source).not.toContain("EDIT_SECTIONS");
    expect(source).not.toContain("ReviewSections");
  });

  it("can only submit the keys the page actually shows", () => {
    expect(source).toContain("answeredFields(edits, WAYS_TO_HELP_FIELD_KEYS)");
  });

  it("does not re-send `confirmed_only` with its content", () => {
    // The backend ignores the flag on a body carrying fields, so re-sending it
    // here would be a no-op that reads as a second confirmation.
    expect(source).not.toContain("confirmed_only");
  });

  it("keeps 'I need to make changes' reachable", () => {
    expect(source).toContain("onNeedChanges");
    expect(source).toContain("surveyReviewHref(token)");
  });

  it("has a loading, invalid and success state like every other survey screen", () => {
    expect(source).toContain("InvalidPanel");
    expect(source).toContain("animate-pulse");
    expect(source).toContain("SuccessPanel");
  });
});

/**
 * ⚠️ `/survey/*` skips authentication entirely (`isNoAuthPath`). A module that
 * reaches for a Supabase client, a session or a user is a runtime error for the
 * one visitor who has none — and it would only show up for a real alum, since
 * every staff member testing it is signed in.
 *
 * Walked TRANSITIVELY, because the dangerous version of this mistake is never a
 * direct import: it is a helper three levels down that happens to read the
 * session.
 */
describe("nothing on the public survey path touches auth", () => {
  const FORBIDDEN_MODULE = /(supabase|\/auth\/|authGates|useUser|SessionTimeout)/i;
  const EXTENSIONS = ["", ".ts", ".tsx", "/index.ts", "/index.tsx"];

  function resolve(spec: string, fromRel: string): string | null {
    let base: string;
    if (spec.startsWith("@/")) base = `src/${spec.slice(2)}`;
    else if (spec.startsWith(".")) {
      const dir = fromRel.split("/").slice(0, -1);
      for (const part of spec.split("/")) {
        if (part === ".") continue;
        else if (part === "..") dir.pop();
        else dir.push(part);
      }
      base = dir.join("/");
    } else return null; // a package (react, next, lucide-react) — not ours to walk
    for (const ext of EXTENSIONS) {
      try {
        readFileSync(`${root}/${base}${ext}`, "utf8");
        return `${base}${ext}`;
      } catch {
        // try the next extension
      }
    }
    return null;
  }

  function importsOf(source: string): string[] {
    return [...source.matchAll(/from\s+["']([^"']+)["']/g)].map((m) => m[1]);
  }

  function walk(entry: string): { seen: Set<string>; packages: Set<string> } {
    const seen = new Set<string>();
    const packages = new Set<string>();
    const queue = [entry];
    while (queue.length > 0) {
      const rel = queue.pop() as string;
      if (seen.has(rel)) continue;
      seen.add(rel);
      for (const spec of importsOf(read(rel))) {
        const resolved = resolve(spec, rel);
        if (resolved === null) packages.add(spec);
        else if (!seen.has(resolved)) queue.push(resolved);
      }
    }
    return { seen, packages };
  }

  // Each entry names a module that MUST turn up in its own walk. Without that
  // anchor a resolver returning null for everything would pass this suite while
  // checking nothing — the failure mode of a source-invariant test is passing
  // vacuously, not failing.
  const ENTRIES: [entry: string, mustReach: string][] = [
    [HELP_PAGE, "src/components/survey/survey-screens.tsx"],
    [REVIEW_PAGE, "src/components/survey/survey-screens.tsx"],
    [
      "src/components/survey/SurveyPageShell.tsx",
      "src/components/shell/BrandPhotoBackdrop.tsx",
    ],
  ];

  for (const [entry, mustReach] of ENTRIES) {
    it(`${entry} pulls in no auth module`, () => {
      const { seen, packages } = walk(entry);
      expect([...seen]).toContain(mustReach);
      expect([...seen].filter((f) => FORBIDDEN_MODULE.test(f))).toEqual([]);
      expect([...packages].filter((p) => p.startsWith("@supabase/"))).toEqual([]);
    });
  }
});

describe("the engineer console understands the new status", () => {
  it("labels a `confirmed` row rather than showing the raw DB word", () => {
    // The backend added a fourth `survey_responses.status` value (#755). The
    // lookup falls back to the raw status, so a missing entry shows staff a
    // bare lowercase "confirmed" beside three neighbours that all carry an
    // explanation.
    const confirmed = RESPONSE_STATUS["confirmed"];
    expect(confirmed).toBeDefined();
    expect(confirmed.label).not.toBe("confirmed");
    expect(confirmed.note.length).toBeGreaterThan(0);
    expect(confirmed.tone).toBeTruthy();
  });

  it("still labels the three statuses that were already there", () => {
    for (const status of ["pending", "applied", "rejected"]) {
      expect(RESPONSE_STATUS[status]?.label).toBeTruthy();
      expect(RESPONSE_STATUS[status]?.tone).toBeTruthy();
    }
  });
});
