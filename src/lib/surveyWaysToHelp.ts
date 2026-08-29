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
  /** The line under the submit button, for the alum who wants to add nothing. */
  footerNote: string;
};

/**
 * What the ways-to-help screen says, per branch.
 *
 * The `confirmed` strings are the ones #755 shipped, moved here verbatim so the
 * two modes are one screen with one set of questions rather than two screens
 * that can drift. If you change them, you are changing the confirm path.
 *
 * The `edited` strings carry three facts the confirmed ones do not, each of
 * which has a cost if it goes missing:
 *
 *  1. THE UPDATES ARE NOT IN YET. They are sent by the button at the bottom of
 *     this page — one POST carrying the edits and anything answered here, which
 *     is what keeps the alum to a single response row. An alum who thinks they
 *     already submitted may close the tab, and a written-but-never-sent
 *     response is indistinguishable from a link that was never opened.
 *  2. NOTHING HERE IS REQUIRED. The button works with the page untouched.
 *  3. ANSWERS ALREADY GIVEN ARE FILLED IN. The involvement section is also a
 *     choice in the edit menu, so an alum may have answered these questions
 *     minutes ago; a blank form would read as though their edits were thrown
 *     away.
 */
export function waysToHelpCopy(
  mode: WaysToHelpMode,
  firstName: string,
): WaysToHelpCopy {
  if (mode === "edited") {
    return {
      heading: `Almost done, ${firstName}`,
      intro:
        "Your updates aren't in yet — they're sent when you press the button at the bottom of this page. While you're here, there are two optional ways you can help our finance students. Anything you've already answered is filled in below.",
      backLabel: "Back to my updates",
      submitLabel: "Submit my updates",
      submittingLabel: "Submitting…",
      footerNote:
        "Nothing to add? Press the button above — your updates go in either way, and nothing on this page is required.",
    };
  }
  return {
    heading: `Thanks for confirming, ${firstName}`,
    intro:
      "Your information is up to date — that's everything we needed from you. While you're here, there are two optional ways you can help our finance students.",
    backLabel: "I need to make changes",
    submitLabel: "Send this to the Finance team",
    submittingLabel: "Sending…",
    footerNote:
      "Nothing to add? You're already done — your confirmation is recorded and you can close this page.",
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
