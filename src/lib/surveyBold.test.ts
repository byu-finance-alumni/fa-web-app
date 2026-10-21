import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { boldSegments, renderBold, toggleBold } from "./surveyBold";

/**
 * `**bold**` in the survey email copy (#877).
 *
 * ⚠️ `VECTORS` is the SAME table as `VECTORS` in the API's
 * `tests/test_survey_email_bold.py`. The previews here must bold exactly what
 * the real email bolds; if one table changes, change the other with it.
 */
const VECTORS: Array<[string, Array<[boolean, string]>]> = [
  ["plain text", [[false, "plain text"]]],
  ["a **b** c", [[false, "a "], [true, "b"], [false, " c"]]],
  ["**all**", [[true, "all"]]],
  ["**a** and **b**", [[true, "a"], [false, " and "], [true, "b"]]],
  // Unmatched: stays literal.
  ["a ** b", [[false, "a ** b"]]],
  ["**a** b **c", [[true, "a"], [false, " b **c"]]],
  // Empty / blank pairs are not bold and are kept as typed.
  ["****", [[false, "****"]]],
  ["** **", [[false, "** **"]]],
  ["x **** y **z**", [[false, "x ****"], [false, " y "], [true, "z"]]],
  // Never across a line (so never across a paragraph either).
  ["**a\nb**", [[false, "**a"], [false, "\n"], [false, "b**"]]],
  ["**a**\n\n**b**", [[true, "a"], [false, "\n"], [false, "\n"], [true, "b"]]],
  // No nesting; single asterisks are just text.
  ["**a *b* c**", [[true, "a *b* c"]]],
  ["***x***", [[true, "*x"], [false, "*"]]],
  ["", []],
];

const html = (text: string) =>
  renderToStaticMarkup(createElement("p", null, renderBold(text)));

describe("boldSegments (mirrors the server)", () => {
  it.each(VECTORS)("%j", (typed, expected) => {
    expect(boldSegments(typed).map((s) => [s.bold, s.text])).toEqual(expected);
  });

  it.each(VECTORS)("loses nothing but the markers: %j", (typed) => {
    const rebuilt = boldSegments(typed)
      .map((s) => (s.bold ? `**${s.text}**` : s.text))
      .join("");
    expect(rebuilt).toBe(typed);
  });

  it("is linear on adversarial input", () => {
    const shapes = [
      "*".repeat(200_000),
      "**" + "a".repeat(200_000),
      "** ".repeat(70_000),
      "**a".repeat(70_000),
      "**\n".repeat(70_000),
    ];
    const t0 = performance.now();
    for (const s of shapes) boldSegments(s);
    expect(performance.now() - t0).toBeLessThan(1000);
  });
});

describe("renderBold", () => {
  it("renders pairs as <strong>, newlines as text", () => {
    expect(html("Please **reply soon**.\nThanks")).toBe(
      '<p>Please <strong class="font-semibold">reply soon</strong>.\nThanks</p>',
    );
  });

  it.each([
    [
      "**<script>alert(1)</script>**",
      '<strong class="font-semibold">&lt;script&gt;alert(1)&lt;/script&gt;</strong>',
    ],
    ["**<a href=x>**", '<strong class="font-semibold">&lt;a href=x&gt;</strong>'],
    [
      '**" onmouseover="alert(1)**',
      '<strong class="font-semibold">&quot; onmouseover=&quot;alert(1)</strong>',
    ],
    ["<strong>raw</strong>", "&lt;strong&gt;raw&lt;/strong&gt;"],
  ])("keeps %j escaped", (typed, inner) => {
    const out = html(typed);
    expect(out).toBe(`<p>${inner}</p>`);
    const stripped = out
      .replace(/<\/?p>/g, "")
      .replace(/<strong class="font-semibold">|<\/strong>/g, "");
    expect(stripped).not.toMatch(/[<>"]/);
  });
});

describe("toggleBold (the Bold button)", () => {
  it("inserts **** with the cursor in the middle when nothing is selected", () => {
    expect(toggleBold("ab", 1, 1)).toEqual({
      value: "a****b",
      selectionStart: 3,
      selectionEnd: 3,
    });
  });

  it("wraps the selection and keeps the words selected", () => {
    const r = toggleBold("say hello now", 4, 9);
    expect(r.value).toBe("say **hello** now");
    expect(r.value.slice(r.selectionStart, r.selectionEnd)).toBe("hello");
  });

  it("leaves surrounding spaces outside the markers", () => {
    const r = toggleBold("say hello now", 3, 10);
    expect(r.value).toBe("say **hello** now");
    expect(r.value.slice(r.selectionStart, r.selectionEnd)).toBe("hello");
  });

  it("wraps each line of a multi-line selection separately", () => {
    const r = toggleBold("one\n\ntwo", 0, 8);
    expect(r.value).toBe("**one**\n\n**two**");
    // ...and every wrapped line really renders bold.
    expect(boldSegments(r.value).filter((s) => s.bold)).toHaveLength(2);
  });

  it("unwraps when the markers sit just outside the selection", () => {
    const r = toggleBold("say **hello** now", 6, 11);
    expect(r.value).toBe("say hello now");
    expect(r.value.slice(r.selectionStart, r.selectionEnd)).toBe("hello");
  });

  it("unwraps when the selection includes the markers", () => {
    const r = toggleBold("say **hello** now", 4, 13);
    expect(r.value).toBe("say hello now");
    expect(r.value.slice(r.selectionStart, r.selectionEnd)).toBe("hello");
  });

  it("treats a whitespace-only selection like a cursor at its end", () => {
    expect(toggleBold("a  b", 1, 3).value).toBe("a  ****b");
  });
});
