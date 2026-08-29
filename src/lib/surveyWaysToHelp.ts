/**
 * The ways-to-help step reached from the EDIT path (#773), as pure logic.
 *
 * #755 gave "Yes, everything is correct" somewhere to land: the involvement
 * questions and the jobs/internships form, on `/survey/{token}/help`. The other
 * branch of the same fork still missed them. The edit flow is a SECTION MENU —
 * the alum picks which sections to open — so someone who opened Employment,
 * fixed their employer and submitted could finish the whole survey without ever
 * meeting either ask. Tanya asked for the same ending on both branches.
 *
 * The two paths now share one screen (`WaysToHelp`) and one question list
 * (`WAYS_TO_HELP_FIELDS`, itself an alias of `ENGAGEMENT_SECTION.fields`). What
 * differs is only what is TRUE when the alum arrives, and that difference is
 * entirely copy — so it lives here, as data, rather than as a second component
 * that would drift.
 *
 * ⚠️ NOTHING auth-dependent may be imported here, directly or transitively.
 * `/survey/*` skips authentication entirely; a public page that reaches for
 * session state is a runtime error for the one visitor who has none. This file
 * imports nothing at all, and it must stay that way.
 */

/**
 * Which branch of the fork the alum arrived on.
 *
 *  * `confirmed` — they pressed "Yes, everything is correct" (#755). The
 *    confirmation is ALREADY a row in the database: the review page POSTed it
 *    before navigating. Everything on the page is optional extra, and closing
 *    the tab costs nothing.
 *  * `edited` — they filled in the edit flow and pressed Continue (#773). Their
 *    updates are still IN THE BROWSER, unsent, and this screen's button is what
 *    sends them. The copy has to say so; telling this alum "you're already
 *    done" would be a lie that costs us the edits they just made.
 */
export type WaysToHelpMode = "confirmed" | "edited";

export type WaysToHelpCopy = {
  heading: string;
  intro: string;
  /** The escape hatch above the asks — back to the edit flow either way. */
  backLabel: string;
  submitLabel: string;
  submittingLabel: string;
  /**
   * The line directly ABOVE the submit button, or `null` when there is nothing
   * unsent to warn about. Above rather than below on purpose: on the edit
   * branch it is the only thing telling the alum their changes are still in the
   * browser, and the press underneath it is what sends them.
   */
  submitNote: string | null;
  /** The line under the submit button, for the alum who wants to add nothing. */
  footerNote: string;
};

/**
 * What the ways-to-help screen says, per branch.
 *
 * The `confirmed` strings came from #755, moved here so the two modes are one
 * screen with one set of questions rather than two screens that can drift. They
 * were trimmed alongside the edited ones on 2026-08-28 (Jake) to keep the two
 * branches the same weight: neither intro is a paragraph any more. If you
 * change them, you are changing the confirm path.
 *
 * The `edited` strings carry two facts the confirmed ones do not, each of which
 * has a cost if it goes missing:
 *
 *  1. THE UPDATES ARE NOT IN YET. They are sent by the button at the foot of
 *     this page: one POST carrying the edits and anything answered here, which
 *     is what keeps the alum to a single response row. An alum who thinks they
 *     already submitted may close the tab, and a written-but-never-sent
 *     response is indistinguishable from a link that was never opened. This is
 *     `submitNote`, and it is deliberately NOT in `intro`: Jake cut the intro
 *     paragraph on 2026-08-28, and a warning at the top of a page is not where
 *     someone looks before pressing a button at the bottom of it.
 *  2. NOTHING HERE IS REQUIRED. The button works with the page untouched.
 *
 * A third fact went with the paragraph — that answers already given are filled
 * in below — because the form shows it: `valueOf` pre-fills the involvement
 * questions from the same staged `edits` map, so an alum who answered them in
 * the section menu meets them already answered rather than blank.
 */
export function waysToHelpCopy(
  mode: WaysToHelpMode,
  firstName: string,
): WaysToHelpCopy {
  if (mode === "edited") {
    return {
      heading: `Almost done, ${firstName}`,
      intro:
        "While you're here, two optional ways you can help our finance students.",
      backLabel: "Back to my updates",
      submitLabel: "Submit my updates",
      submittingLabel: "Submitting…",
      submitNote: "Your updates aren't sent yet.",
      footerNote:
        "Nothing to add? Press the button above. Your updates go in either way, and nothing on this page is required.",
    };
  }
  return {
    heading: `Thanks for confirming, ${firstName}`,
    intro:
      "Your information is up to date, so that's everything we needed. While you're here, two optional ways you can help our finance students.",
    backLabel: "I need to make changes",
    submitLabel: "Send this to the Finance team",
    submittingLabel: "Sending…",
    submitNote: null,
    footerNote:
      "Nothing to add? You're already done. Your confirmation is recorded and you can close this page.",
  };
}

/**
 * The body of the edit flow's ONE field submission — `POST
 * /survey/respond/{token}` — carrying the alum's profile edits AND whatever they
 * answered on the ways-to-help step, together.
 *
 * ⚠️ THIS IS THE NO-DUPLICATE-ROWS GUARANTEE, and it is a frontend guarantee
 * because the backend cannot make it. `submit_response` upgrades a live
 * `confirmed` row in place under a row lock — which is what lets the CONFIRM
 * path post twice (the confirmation, then the involvement answers) and still
 * end with one row. It does NOT do that for a `pending` row: a second POST after
 * a real submission stages a SECOND row on purpose, because two submissions are
 * two things a reviewer must see ("a submission, then another after spotting a
 * typo").
 *
 * So the edit path cannot copy the confirm path's two-POST shape. Instead the
 * ways-to-help step is shown BEFORE the submission rather than after it, and
 * both halves ride in this single body: the involvement questions write into the
 * same `edits` map the section menu writes into, so by the time this is built
 * there is nothing left to send separately.
 *
 * If you find yourself adding a second `POST /survey/respond/{token}` to the
 * edit path — to "just send the involvement answers" — stop: that is the
 * duplicate row, and it looks completely fine on screen.
 *
 * No `confirmed_only` flag: the backend ignores it on a body carrying content
 * anyway, and this alum did not confirm — they made changes.
 *
 * `edits` is passed through as-is rather than filtered to an allowlist. Unlike
 * the ways-to-help PAGE (see `answeredFields`), this body is allowed to carry
 * profile fields — they are the whole point of it — and the backend drops any
 * key that is not a recognized survey field.
 */
export function editSubmitBody(
  edits: Record<string, string>,
  hasPhoto: boolean,
): { fields: Record<string, string>; has_photo: boolean } {
  return { fields: edits, has_photo: hasPhoto };
}
