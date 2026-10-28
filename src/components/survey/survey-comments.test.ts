import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { SurveyCommentsBox, WaysToHelp } from "./survey-screens";
import { waysToHelpThanksBody } from "@/lib/surveyConfirm";
import {
  SURVEY_COMMENTS_MAX,
  commentsToSubmit,
  editSubmitBody,
} from "@/lib/surveyWaysToHelp";

/**
 * The optional "Anything else you'd like to share?" box (#890).
 *
 * Pinned: it is the LAST thing above the submit button on the ways-to-help
 * screen both branches end on; it is capped at the backend's 2000 characters
 * with a visible counter; it never gates the button; and it rides beside
 * `fields` (never inside it), only when the alum actually wrote something.
 * Node-only suite — the screen is rendered with react-dom/server.
 */

const root = fileURLToPath(new URL("../../..", import.meta.url));
const read = (rel: string) => readFileSync(`${root}/${rel}`, "utf8");

function renderWaysToHelp(comments: string) {
  return renderToStaticMarkup(
    createElement(WaysToHelp, {
      firstName: "Jordan",
      mode: "edited",
      valueOf: () => "",
      setEdit: () => {},
      links: [],
      setLinks: () => {},
      comments,
      setComments: () => {},
      onNeedChanges: () => {},
      onSubmit: () => {},
      submitting: false,
      submitError: null,
    }),
  );
}

describe("the comments box", () => {
  it("is capped at the backend's limit, with a counter", () => {
    expect(SURVEY_COMMENTS_MAX).toBe(2000);
    const html = renderToStaticMarkup(
      createElement(SurveyCommentsBox, {
        value: "Hello there",
        onChange: () => {},
      }),
    );
    expect(html).toContain("Anything else you&#x27;d like to share?");
    expect(html).toContain('maxLength="2000"');
    expect(html).toContain("11 / 2,000");
    expect(html).toContain("Optional.");
  });

  it("renders what the alum typed as text, not markup", () => {
    const html = renderToStaticMarkup(
      createElement(SurveyCommentsBox, {
        value: "<script>alert(1)</script>",
        onChange: () => {},
      }),
    );
    expect(html).not.toContain("<script>");
    expect(html).toContain("&lt;script&gt;");
  });

  it("sits last on the ways-to-help screen, right above the submit button", () => {
    const html = renderWaysToHelp("");
    const links = html.indexOf('id="ways-to-help-links"');
    const box = html.indexOf("Anything else you&#x27;d like to share?");
    const submit = html.indexOf("Submit my updates");
    expect(links).toBeGreaterThan(-1);
    expect(box).toBeGreaterThan(links);
    expect(submit).toBeGreaterThan(box);
  });

  it("never disables the submit button, filled or not", () => {
    for (const comments of ["", "x".repeat(SURVEY_COMMENTS_MAX)]) {
      const html = renderWaysToHelp(comments);
      const button = html.slice(
        html.lastIndexOf("<button", html.indexOf("Submit my updates")),
      );
      // The attribute, not the `disabled:` Tailwind variants in the class list.
      expect(button.slice(0, button.indexOf(">"))).not.toContain('disabled=""');
    }
  });
});

describe("what goes on the wire", () => {
  it("sends nothing for a blank box", () => {
    expect(commentsToSubmit("")).toBeNull();
    expect(commentsToSubmit("   \n ")).toBeNull();
    expect(commentsToSubmit(undefined)).toBeNull();
    expect(commentsToSubmit("  Go Cougs  ")).toBe("Go Cougs");
  });

  it("rides beside fields in the edit branch's one body, only when written", () => {
    const body = editSubmitBody({ "contact.city": "Provo" }, false, null, " Hi! ");
    expect(body.comments).toBe("Hi!");
    expect(body.fields).toEqual({ "contact.city": "Provo" });
    expect(Object.keys(body.fields)).not.toContain("comments");
    // A blank box leaves the body exactly as it was before the box existed.
    expect(Object.keys(editSubmitBody({}, false, null, "  "))).toEqual([
      "fields",
      "has_photo",
    ]);
  });

  it("is posted by the confirm branch's help page too, even on its own", () => {
    const help = read("src/app/survey/[token]/help/page.tsx");
    expect(help).toContain("commentsToSubmit(comments)");
    expect(help).toContain("(answers > 0 || comment !== null) && !fieldsStaged");
    expect(help).toContain("comments: comment");
  });

  it("is passed to the screen by both real pages", () => {
    for (const page of [
      "src/app/survey/[token]/page.tsx",
      "src/app/survey/[token]/help/page.tsx",
    ]) {
      const step = read(page).slice(read(page).indexOf("<WaysToHelp"));
      expect(step).toContain("comments={comments}");
      expect(step).toContain("setComments={setComments}");
    }
  });

  it("thanks the alum for a comment on the confirm branch", () => {
    const body = waysToHelpThanksBody({
      answerCount: 0,
      linkCount: 0,
      commentSent: true,
    });
    expect(body).toContain("Thank you for your comment.");
    // A comment is not a confirmation-only reply any more.
    expect(body).not.toContain("nothing else you need to do");
    expect(
      waysToHelpThanksBody({ answerCount: 0, linkCount: 0 }),
    ).not.toContain("comment");
  });
});
