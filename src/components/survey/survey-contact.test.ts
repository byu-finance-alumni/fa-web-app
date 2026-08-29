import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { createElement } from "react";
import { afterEach, describe, expect, it } from "vitest";

import { SurveyContactLink } from "./SurveyContactLink";
import {
  SURVEY_CONTACT_SUBJECT,
  isPlausibleEmail,
  surveyContactFrom,
  surveyContactLinkText,
  surveyContactMailtoHref,
} from "@/lib/surveyContact";

/**
 * The "email us directly" control at the foot of the public survey (#774).
 *
 * Two things have to hold and neither is visible on a screenshot of the happy
 * path: that NOTHING renders when no contact is configured, and that the
 * subject really is pre-filled. A control that opens a blank message looks
 * exactly like one that works until someone actually presses it.
 *
 * The suite runs in Node with no DOM, so the component is called as the plain
 * function it is and the returned element tree is walked for its href — which
 * checks the wiring end to end (env → validation → href) rather than only the
 * helper that builds the string.
 */

/**
 * tsconfig sets `jsx: "preserve"` (Next compiles the JSX itself), so vite's
 * esbuild falls back to the CLASSIC runtime here and the transformed component
 * looks for a global `React.createElement` when it is called. Next's own build
 * uses the automatic runtime and never touches this global — it exists purely
 * so a component can be exercised as the function it is from a Node suite with
 * no DOM. Set at module scope: the component only dereferences it when called.
 */
(globalThis as unknown as { React: { createElement: unknown } }).React = {
  createElement,
};

const root = fileURLToPath(new URL("../../..", import.meta.url));
const read = (rel: string) => readFileSync(`${root}/${rel}`, "utf8");

/**
 * The contact now arrives as a PROP, not from the environment (#774): the real
 * screens read it off the public token-gated survey payload, and the staff
 * sample resolves the same row from the authenticated list. So "configure" here
 * means "what the server sent", which is what the component actually sees.
 */
let current: { name?: string | null; email?: string | null } | null = null;

function configure(email?: string, name?: string) {
  current = email === undefined && name === undefined ? null : { email, name };
}

/** Render with whatever `configure` last set. */
function render() {
  return SurveyContactLink({ contact: current });
}

afterEach(() => configure(undefined, undefined));

/** Every `href` in a returned React element tree, in document order. */
function hrefsIn(node: unknown): string[] {
  if (node === null || node === undefined || typeof node !== "object") return [];
  if (Array.isArray(node)) return node.flatMap(hrefsIn);
  const props = (node as { props?: Record<string, unknown> }).props;
  if (!props) return [];
  const here = typeof props.href === "string" ? [props.href] : [];
  return [...here, ...hrefsIn(props.children)];
}

describe("no contact configured", () => {
  it("renders NOTHING rather than a dead mailto", () => {
    // The whole point of the issue's "degrade honestly" rule. A respondent who
    // believes they have emailed a human stops looking for another way to
    // reach one, and we never find out the message went nowhere.
    configure(undefined, undefined);
    expect(render()).toBeNull();
  });

  it("renders nothing for a blank or whitespace-only address", () => {
    configure("");
    expect(render()).toBeNull();
    configure("   ");
    expect(render()).toBeNull();
  });

  it("renders nothing for an address it cannot trust", () => {
    // A name with no address is not a contact — it is a label on a link that
    // goes nowhere.
    configure("not-an-address", "Tanya Harmon");
    expect(render()).toBeNull();
    configure(undefined, "Tanya Harmon");
    expect(render()).toBeNull();
  });
});

describe("a contact is configured", () => {
  it("renders one mailto with the subject already filled in", () => {
    configure("tanya_harmon@byu.edu", "Tanya Harmon");
    const hrefs = hrefsIn(render());
    expect(hrefs).toEqual([
      "mailto:tanya_harmon@byu.edu?subject=Finance%20Alumni%20Survey%20response",
    ]);
    // Spelled out once, so a change to the subject constant has to be
    // deliberate: this is the wording Tanya asked for (2026-08-28).
    expect(SURVEY_CONTACT_SUBJECT).toBe("Finance Alumni Survey response");
    expect(hrefs[0]).toContain(
      `subject=${encodeURIComponent(SURVEY_CONTACT_SUBJECT)}`,
    );
  });

  it("does not percent-encode the address itself", () => {
    // `%40` in place of `@` is surfaced verbatim by some mail clients. The
    // validation below is what makes leaving it literal safe.
    configure("tanya@byu.edu");
    expect(hrefsIn(render())[0]).toContain("mailto:tanya@byu.edu?");
  });

  it("labels the link with the configured name", () => {
    const contact = surveyContactFrom({
      name: "Tanya Harmon",
      email: "tanya@byu.edu",
    });
    expect(contact).not.toBeNull();
    expect(surveyContactLinkText(contact!)).toBe("Email Tanya Harmon");
  });

  it("falls back to the address as the label when no name is set", () => {
    const contact = surveyContactFrom({ email: "tanya@byu.edu" });
    expect(surveyContactLinkText(contact!)).toBe("Email tanya@byu.edu");
  });

  it("trims stray whitespace around the configured values", () => {
    configure("  tanya@byu.edu  ", "  Tanya Harmon  ");
    const rendered = render();
    expect(rendered).not.toBeNull();
    expect(hrefsIn(rendered)[0]).toBe(
      "mailto:tanya@byu.edu?subject=Finance%20Alumni%20Survey%20response",
    );
  });
});

describe("the address cannot smuggle extra mailto parameters", () => {
  // The value is interpolated into an href the browser hands to a mail client,
  // so the characters that matter are the ones that change what the href MEANS.
  it("rejects anything that would add a parameter, a recipient or a newline", () => {
    for (const bad of [
      "tanya@byu.edu?subject=Something%20else",
      "tanya@byu.edu&cc=someone@example.com",
      "tanya@byu.edu,someone@example.com",
      "tanya@byu.edu;someone@example.com",
      "tanya@byu.edu\nbcc: someone@example.com",
      "tanya @byu.edu",
      "<script>@byu.edu",
      "tanya@byu",
      "@byu.edu",
      "tanya@",
      `${"a".repeat(250)}@byu.edu`,
    ]) {
      expect(isPlausibleEmail(bad), bad).toBe(false);
      expect(surveyContactFrom({ email: bad }), bad).toBeNull();
    }
  });

  it("still accepts the ordinary addresses people actually have", () => {
    for (const good of [
      "tanya@byu.edu",
      "tanya.harmon@byu.edu",
      "tanya_harmon+alumni@marriott.byu.edu",
      "t.h-1%test@sub.domain.co.uk",
    ]) {
      expect(isPlausibleEmail(good), good).toBe(true);
      expect(surveyContactMailtoHref(surveyContactFrom({ email: good })!)).toBe(
        `mailto:${good}?subject=Finance%20Alumni%20Survey%20response`,
      );
    }
  });
});

describe("where the control appears", () => {
  const REVIEW_PAGE = "src/app/survey/[token]/page.tsx";
  const HELP_PAGE = "src/app/survey/[token]/help/page.tsx";

  for (const page of [REVIEW_PAGE, HELP_PAGE]) {
    it(`${page} renders it OUTSIDE the state switch`, () => {
      const source = read(page);
      expect(source).toContain("<SurveyContactLink contact={supportContact} />");
      // Last child of the shell, not a branch of the loading/invalid/success
      // ternary: it must survive the thank-you panel, which is the last screen
      // the survey ever shows anyone.
      const control = source.indexOf("<SurveyContactLink contact={supportContact} />");
      expect(control).toBeGreaterThan(-1);
      expect(source.indexOf("</SurveyPageShell>")).toBeGreaterThan(control);
    });
  }

  it("adds no second main, wrapper column or footer to the shell", () => {
    // A full-width element between the photo masthead and the content has come
    // back five times. This control is a single paragraph inside the shell's
    // existing 800px column and must stay one.
    const source = read("src/components/survey/SurveyContactLink.tsx");
    expect(source).not.toMatch(/<(main|footer|header)\b/);
    expect(source).not.toMatch(/\b(w-full|w-screen|border-t|bg-)/);
  });

  it("is text-only — no icon", () => {
    // No icons in UI: the control is a word, not a glyph.
    const source = read("src/components/survey/SurveyContactLink.tsx");
    expect(source).not.toContain("lucide-react");
    expect(source).not.toMatch(/<svg\b/);
  });
});

describe("nothing here reaches for auth", () => {
  // `/survey/*` skips authentication entirely (`isNoAuthPath`) — the visitor is
  // a stranger holding a signed token. `ways-to-help.test.ts` walks both pages'
  // imports transitively and now walks into these two files; this narrower
  // guard names the specific reason the address is NOT read from
  // `GET /support-contacts`, which needs a signed-in caller.
  it("the address helper imports nothing at all", () => {
    const source = read("src/lib/surveyContact.ts");
    expect(source).not.toMatch(/^import\s/m);
  });

  it("the component imports only its own helper", () => {
    const source = read("src/components/survey/SurveyContactLink.tsx");
    const specs = [...source.matchAll(/from\s+["']([^"']+)["']/g)].map(
      (m) => m[1],
    );
    expect(specs).toEqual(["@/lib/surveyContact"]);
  });
});

/**
 * The STAFF SAMPLE SURVEY has to show what the alum actually gets (#774).
 *
 * `SurveyPreview` is the console's "what will they see" dialog. It is a
 * hand-assembled replica of the real screens rather than the screens
 * themselves, which is what makes it useful — and what makes it silently
 * driftable. The whole failure mode is invisible: the preview keeps looking
 * fine while the real survey has moved on, and staff sign off on a survey
 * nobody is sent.
 *
 * This shipped that way once already: #774 added the contact link to both real
 * survey screens and not to the preview.
 */
describe("the sample survey stays in step with the real one", () => {
  const previewSource = readFileSync(
    fileURLToPath(
      new URL("../needs-surveying/SurveyPreview.tsx", import.meta.url),
    ),
    "utf8",
  );

  it("renders the same contact link the real survey does", () => {
    expect(previewSource).toContain(
      'import { SurveyContactLink } from "@/components/survey/SurveyContactLink"',
    );
    expect(previewSource).toContain("<SurveyContactLink contact={");
  });

  it("walks the ways-to-help ending from BOTH directions, not just confirm", () => {
    // An alum reaches that screen two ways: pressing "everything is correct"
    // (#755) and pressing Continue after edits (#773). The preview must be able
    // to show either, or staff never see the edited-path copy.
    expect(previewSource).toContain("<WaysToHelp");
    expect(previewSource).toMatch(/setHelpMode\(\s*"edited"\s*\)/);
    expect(previewSource).toContain('useState<WaysToHelpMode>("confirmed")');
  });
});
