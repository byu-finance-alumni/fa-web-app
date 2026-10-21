/**
 * `**bold**` in the survey email copy (#877) — the ONE place the app decides
 * which words of the intro, closing and follow-up line are bold.
 *
 * ⚠️ THIS MIRRORS THE SERVER. The real email is rendered by the API
 * (`app/services/survey_message.py`, `_bold_segments` / `copy_to_html`), and
 * every preview here — the editor's and the sample survey's — must bold exactly
 * what that email bolds, or staff sign off on something nobody is sent. Both
 * sides are tested against the SAME vector table (`surveyBold.test.ts` here,
 * `tests/test_survey_email_bold.py` there). Change the rule in both or neither.
 *
 * THE RULE:
 *   - A pair is the first `**` on a LINE and the next `**` after it on that
 *     same line. A pair never spans a line break, so never a paragraph break.
 *   - No nesting: what sits between the markers is plain text.
 *   - A pair with nothing (or only spaces/tabs) inside is not bold and is kept
 *     as typed — e.g. the `****` the Bold button leaves when nothing was typed.
 *   - An unmatched `**` stays as literal text.
 *   - The SUBJECT never goes through this; it is a header and stays plain.
 *
 * A `indexOf` scanner, not a regex: every search starts where the last one
 * ended, so it is linear in the input whatever is typed (and matches the
 * server's scanner step for step).
 *
 * SAFE BY CONSTRUCTION: `renderBold` returns React elements — strings and
 * `<strong>` — so React escapes every character staff typed. There is no
 * `dangerouslySetInnerHTML` anywhere on this path.
 */

import { createElement, Fragment, type ReactNode } from "react";

/** One piece of copy: bold or not, with the markers of a bold one removed. */
export type BoldSegment = { bold: boolean; text: string };

const MARK = "**";

function isBlank(s: string): boolean {
  for (const ch of s) {
    if (ch !== " " && ch !== "\t") return false;
  }
  return true;
}

/** Split copy into bold / plain segments. See the rule above. */
export function boldSegments(text: string): BoldSegment[] {
  const out: BoldSegment[] = [];
  const lines = text.split("\n");
  lines.forEach((line, n) => {
    let i = 0;
    for (;;) {
      const start = line.indexOf(MARK, i);
      if (start === -1) break;
      const end = line.indexOf(MARK, start + 2);
      if (end === -1) break;
      const inner = line.slice(start + 2, end);
      if (isBlank(inner)) {
        // Kept as typed; scanning resumes AFTER the closing marker so it cannot
        // pair with a later one and bold the gap.
        out.push({ bold: false, text: line.slice(i, end + 2) });
      } else {
        if (start > i) out.push({ bold: false, text: line.slice(i, start) });
        out.push({ bold: true, text: inner });
      }
      i = end + 2;
    }
    if (i < line.length) out.push({ bold: false, text: line.slice(i) });
    if (n < lines.length - 1) out.push({ bold: false, text: "\n" });
  });
  return out;
}

/**
 * Copy as React children: plain text with `<strong>` for each pair. Newlines
 * are kept as text, so a `whitespace-pre-wrap` container lays it out as typed.
 */
export function renderBold(text: string): ReactNode {
  return createElement(
    Fragment,
    null,
    ...boldSegments(text).map((seg, k) =>
      seg.bold
        ? createElement("strong", { key: k, className: "font-semibold" }, seg.text)
        : createElement(Fragment, { key: k }, seg.text),
    ),
  );
}

/** The result of the Bold button: the new value and where the selection goes. */
export type BoldEdit = {
  value: string;
  selectionStart: number;
  selectionEnd: number;
};

/**
 * What pressing "Bold" does to a textarea's value and selection.
 *
 *   - Nothing selected: inserts `****` with the cursor between the pairs, so
 *     typing goes straight in bold.
 *   - Text selected and already wrapped in `**…**` (markers just outside or
 *     just inside the selection): unwraps it — pressing Bold twice is undo.
 *   - Otherwise: wraps the selection, leaving surrounding spaces OUTSIDE the
 *     markers (a double-clicked word often carries its trailing space). A
 *     selection across lines wraps each line separately, because a pair can
 *     never span a line and one wrap around the lot would bold nothing.
 *
 * The selection afterwards covers the (un)wrapped words, without markers.
 */
export function toggleBold(
  value: string,
  selectionStart: number,
  selectionEnd: number,
): BoldEdit {
  const a = Math.max(0, Math.min(selectionStart, selectionEnd, value.length));
  const b = Math.min(Math.max(selectionStart, selectionEnd), value.length);

  if (a === b) {
    return {
      value: value.slice(0, a) + MARK + MARK + value.slice(a),
      selectionStart: a + 2,
      selectionEnd: a + 2,
    };
  }

  // Unwrap: markers just outside the selection...
  if (a >= 2 && value.slice(a - 2, a) === MARK && value.slice(b, b + 2) === MARK) {
    return {
      value: value.slice(0, a - 2) + value.slice(a, b) + value.slice(b + 2),
      selectionStart: a - 2,
      selectionEnd: b - 2,
    };
  }
  // ...or the selection includes them.
  const picked = value.slice(a, b);
  if (
    picked.length >= 4 &&
    picked.startsWith(MARK) &&
    picked.endsWith(MARK) &&
    !picked.includes("\n")
  ) {
    return {
      value: value.slice(0, a) + picked.slice(2, -2) + value.slice(b),
      selectionStart: a,
      selectionEnd: b - 4,
    };
  }

  // Wrap each line's non-blank part; leading/trailing whitespace stays outside.
  const wrapped = picked
    .split("\n")
    .map((line) => {
      // Trim arithmetic, not a regex: `(\s*)(.*?)(\s*)` is the ambiguous
      // shape CodeQL's ReDoS rule flags.
      const head = line.length - line.trimStart().length;
      const core = line.trim();
      if (!core) return line;
      return (
        line.slice(0, head) +
        MARK +
        core +
        MARK +
        line.slice(head + core.length)
      );
    })
    .join("\n");
  if (wrapped === picked) {
    // Only whitespace was selected: behave like an empty selection at its end.
    return toggleBold(value, b, b);
  }
  const lead = picked.length - picked.trimStart().length;
  const trail = picked.length - picked.trimEnd().length;
  return {
    value: value.slice(0, a) + wrapped + value.slice(b),
    selectionStart: a + lead + 2,
    selectionEnd: a + wrapped.length - trail - 2,
  };
}
