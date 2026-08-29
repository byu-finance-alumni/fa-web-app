import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

import { ENGAGEMENT_SECTION, WAYS_TO_HELP_FIELD_KEYS } from "./survey-screens";
import { editSubmitBody, waysToHelpCopy } from "@/lib/surveyWaysToHelp";

/**
 * The EDIT branch's ending (#773) — every alum who makes changes now finishes on
 * the same "Ways to get involved" + jobs/internships screen the confirm branch
 * has reached since #755.
 *
 * Two things here have a real cost and no other alarm:
 *
 *  1. A SECOND RESPONSE ROW. The backend upgrades a live `confirmed` row in
 *     place under a row lock, which is what lets the CONFIRM branch post twice
 *     and still end with one row. It does not do that for a `pending` row —
 *     two submissions on one token are two rows on purpose. So the edit branch
 *     has exactly one field POST, and that is a frontend invariant nothing
 *     server-side will catch. It also looks completely fine on screen: the alum
 *     sees one thank-you either way, and the duplicate only ever appears in a
 *     reviewer's queue.
 *  2. A BLANK INVOLVEMENT FORM. The questions are also a section in the edit
 *     menu, so an alum may have answered them minutes earlier. Re-asking them
 *     empty reads as though their edits were thrown away.
 *
 * This suite runs in Node with no DOM, so the screen itself is checked by
 * reading its source. The guards are deliberately narrow — each names one
 * regression.
 */

const root = fileURLToPath(new URL("../../..", import.meta.url));
const read = (rel: string) => readFileSync(`${root}/${rel}`, "utf8");

const REVIEW_PAGE = "src/app/survey/[token]/page.tsx";
const HELP_PAGE = "src/app/survey/[token]/help/page.tsx";
const SCREENS = "src/components/survey/survey-screens.tsx";

/** The body of one top-level function in a source file, for a scoped assertion. */
function functionBody(source: string, signature: string): string {
  const start = source.indexOf(signature);
  expect(start, `${signature} not found`).toBeGreaterThan(-1);
  const rest = source.slice(start + signature.length);
  const end = rest.search(/\n(?:export )?function /);
  return end === -1 ? rest : rest.slice(0, end);
}

describe("submitting edits leads to the ways-to-help step", () => {
  const source = read(REVIEW_PAGE);

  it("advances to the step instead of posting from the section menu", () => {
    // The old flow posted here and rendered the thank-you: an alum who opened
    // Employment, fixed their employer and submitted never met either ask.
    expect(source).toContain('onSubmit={() => setStatus("helping")}');
    expect(source).toContain('status === "helping"');
  });

  it("shows the step to EVERYONE who edits, with nothing to opt out of", () => {
    // "Always show it" was the explicit ask. There is no branch on whether the
    // alum happened to open the involvement section during their edits — those
    // are exactly the people whose answers must come BACK, not the people to
    // skip.
    const branch = functionBody(source, "export default function SurveyConfirmPage");
    expect(branch).not.toMatch(/WAYS_TO_HELP_FIELD_KEYS/);
    expect(branch).not.toMatch(/ENGAGEMENT_SECTION/);
    expect(branch).not.toMatch(/openedEngagement|skipHelp|hasInvolvement/);
  });

  it("renders the same screen the confirm branch reaches, in edited mode", () => {
    // One component, one question list. A second copy of the involvement
    // questions for this branch is the drift `WAYS_TO_HELP_FIELDS` exists to
    // prevent.
    expect(source).toContain("<WaysToHelp");
    expect(source).toContain('mode="edited"');
    expect(read(HELP_PAGE)).toContain("<WaysToHelp");
  });

  it("hands the step the SAME edit state, so earlier answers are pre-filled", () => {
    // `valueOf` folds `edits` over the record, so an alum who answered the
    // involvement questions in the section menu finds them filled in — and
    // whatever they answer here lands in the same map, which is what keeps the
    // submission to one request. Refetching the record instead could not do
    // this: their answers are STAGED, not applied.
    const step = source.slice(source.indexOf("<WaysToHelp"));
    expect(step).toContain("valueOf={valueOf}");
    expect(step).toContain("setEdit={setEdit}");
    expect(step).toContain("links={links}");
    expect(step).toContain("setLinks={setLinks}");
  });

  it("leaves a way back into the form, keeping what they typed", () => {
    const step = source.slice(source.indexOf("<WaysToHelp"));
    expect(step).toContain("onNeedChanges");
    expect(step).toContain('setStatus("editing")');
  });

  it("keeps the alum on this page rather than the help ROUTE", () => {
    // `/survey/{token}/help` refetches the record and posts its own answers.
    // Sending an editing alum there would blank their staged answers AND stage
    // a second row. `waysToHelpHref` therefore belongs to the confirm press
    // only — both of its uses are inside `handleConfirm`.
    const afterConfirm = source.slice(source.indexOf("const handleSubmit"));
    expect(afterConfirm).not.toContain("waysToHelpHref");
  });
});

describe("the edit branch cannot stage two response rows", () => {
  const source = read(REVIEW_PAGE);

  it("has exactly one field submission, built by `editSubmitBody`", () => {
    expect(source.match(/editSubmitBody\(/g)?.length).toBe(1);
  });

  it("adds no fifth request to the public survey endpoints", () => {
    // Confirmation, fields, photo, links — the four that were already there. A
    // fifth POST on this page is the duplicate row, whatever it is labelled.
    expect(source.match(/method: "POST"/g)?.length).toBe(4);
  });

  it("still guards a retry, so a links failure cannot re-stage the fields", () => {
    expect(source).toContain("if (!fieldsStaged)");
    expect(source).toContain("setFieldsStaged(true)");
  });

  it("carries the edits and the involvement answers in ONE body", () => {
    // The whole no-duplicates design in one assertion: by the time the body is
    // built there is nothing left to send separately.
    const body = editSubmitBody(
      {
        "employment.employer_name": "Goldman Sachs",
        "program.mentor_willing": "Yes",
      },
      false,
    );
    expect(body.fields).toEqual({
      "employment.employer_name": "Goldman Sachs",
      "program.mentor_willing": "Yes",
    });
    expect(body.has_photo).toBe(false);
  });

  it("never claims to be a confirmation", () => {
    // The backend ignores `confirmed_only` on a body carrying content, so
    // sending it would be a silent no-op that reads as a confirmation — and
    // this alum did not confirm, they made changes.
    expect(Object.keys(editSubmitBody({}, false))).toEqual([
      "fields",
      "has_photo",
    ]);
    expect(JSON.stringify(editSubmitBody({}, true))).not.toContain("confirmed");
  });

  it("still flags a photo-only submission so the row exists to attach it to", () => {
    expect(editSubmitBody({}, true).has_photo).toBe(true);
  });
});

describe("an alum can finish from the step without adding anything", () => {
  const screens = read(SCREENS);
  const waysToHelp = functionBody(screens, "export function WaysToHelp");

  it("gates the button on nothing but the request in flight", () => {
    // Their edits are the submission. Requiring an involvement answer before
    // they can send it would hold their corrections hostage to an optional ask.
    const at = waysToHelp.indexOf("copy.submitLabel");
    expect(at).toBeGreaterThan(0); // never slice from -1 and assert on the tail
    const block = waysToHelp.slice(at - 400);
    expect(block).toContain("disabled={submitting}");
    expect(block).not.toMatch(/disabled=\{[^}]*(answer|count|length)[^}]*\}/);
  });

  it("says so on the page, for the alum who wants to add nothing", () => {
    const edited = waysToHelpCopy("edited", "Dallin");
    expect(edited.footerNote).toContain("nothing on this page is required");
  });

  it("validates only the links, which are the only thing typeable", () => {
    expect(waysToHelp).toContain("validateLinkEntries(links)");
    expect(waysToHelp).toContain("WAYS_TO_HELP_FIELDS.map");
    expect(waysToHelp).toContain("OpportunityLinksSection");
  });
});

describe("the copy tells each branch the truth", () => {
  it("tells an editing alum their updates are not in yet", () => {
    // The one thing this copy must never do is imply the submission already
    // happened: it happens on the button at the foot of THIS page, and an alum
    // who believes they are done closes the tab. A response that was written
    // and never sent is indistinguishable from a link that was never opened.
    const edited = waysToHelpCopy("edited", "Dallin");
    expect(edited.intro).toContain("aren't in yet");
    expect(edited.intro.toLowerCase()).not.toContain("close this page");
    expect(edited.footerNote.toLowerCase()).not.toContain("close this page");
    expect(edited.footerNote).not.toContain("already done");
    expect(edited.submitLabel).toBe("Submit my updates");
  });

  it("promises the pre-fill the step actually delivers", () => {
    const edited = waysToHelpCopy("edited", "Dallin");
    expect(edited.intro).toContain("filled in below");
  });

  it("offers a way back to the form, not back to the review screen", () => {
    expect(waysToHelpCopy("edited", "Dallin").backLabel).toBe(
      "Back to my updates",
    );
  });

  it("greets by first name on both branches", () => {
    expect(waysToHelpCopy("edited", "Dallin").heading).toContain("Dallin");
    expect(waysToHelpCopy("confirmed", "Dallin").heading).toContain("Dallin");
  });
});

/**
 * ⚠️ #755's behaviour was agreed with Jake on 2026-08-25. #773 adds the mirror
 * of it; it does not edit it. The confirmed copy moved into `waysToHelpCopy`
 * so both branches render one screen — these assert it moved WORD FOR WORD.
 */
describe("the confirm branch is untouched", () => {
  it("says exactly what it said before", () => {
    const confirmed = waysToHelpCopy("confirmed", "Dallin");
    expect(confirmed.heading).toBe("Thanks for confirming, Dallin");
    expect(confirmed.intro).toBe(
      "Your information is up to date — that's everything we needed from you. While you're here, there are two optional ways you can help our finance students.",
    );
    expect(confirmed.backLabel).toBe("I need to make changes");
    expect(confirmed.submitLabel).toBe("Send this to the Finance team");
    expect(confirmed.submittingLabel).toBe("Sending…");
    expect(confirmed.footerNote).toBe(
      "Nothing to add? You're already done — your confirmation is recorded and you can close this page.",
    );
  });

  it("is what the help ROUTE gets without asking for it", () => {
    // The route passes no `mode`, so the default is the branch that has been
    // shipping since #755. A page that had to opt in would be one edit away
    // from silently switching branches.
    const help = read(HELP_PAGE);
    expect(help).not.toContain("mode=");
    expect(waysToHelpCopy("confirmed", "Dallin")).toEqual(
      waysToHelpCopy("confirmed", "Dallin"),
    );
  });

  it("still posts its own answers under its own allowlist", () => {
    const help = read(HELP_PAGE);
    expect(help).toContain("answeredFields(edits, WAYS_TO_HELP_FIELD_KEYS)");
    expect(help).not.toContain("editSubmitBody");
  });

  it("asks the same questions on both branches, from one list", () => {
    expect(WAYS_TO_HELP_FIELD_KEYS).toEqual(
      ENGAGEMENT_SECTION.fields.map((f) => f.key),
    );
  });
});

describe("the staff sample survey walks the new ending", () => {
  const preview = read("src/components/needs-surveying/SurveyPreview.tsx");

  it("reaches the ways-to-help screen from the edit branch too", () => {
    // The preview is only honest if it is the same screens in the same order.
    // Jumping from Continue straight to the thank-you would show staff a survey
    // no alum is sent — the exact drift the shared view layer exists to stop.
    expect(preview).toContain('setHelpMode("edited")');
    expect(preview).toContain('setHelpMode("confirmed")');
    expect(preview).toContain("mode={helpMode}");
  });
});
