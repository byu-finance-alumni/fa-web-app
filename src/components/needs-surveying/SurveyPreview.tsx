"use client";

import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { SAMPLE_ALUM, SAMPLE_ALUM_NAME } from "@/lib/sampleAlumni";
import { emptyLinkEntry, type LinkEntry } from "@/lib/opportunityLinks";
import { type WaysToHelpMode } from "@/lib/surveyWaysToHelp";
import { SurveyContactLink } from "@/components/survey/SurveyContactLink";
import { surveyMessageByline } from "@/lib/surveyMessage";
import {
  useSurveyMessage,
  type SurveyMessageState,
} from "@/lib/useSurveyMessage";
import {
  EditFlow,
  INFO_SECTIONS,
  ReviewSections,
  SuccessPanel,
  TrustNote,
  WaysToHelp,
  initialsOf,
  type Fields,
} from "@/components/survey/survey-screens";

/**
 * "Sample survey" — the staff-facing preview of the live alumni survey (#574).
 *
 * It renders the SAME screens the alum gets, from
 * `components/survey/survey-screens`, over `SAMPLE_ALUM` instead of a real
 * record: review, the section menu, every section's real controls (the
 * Employment Status and Industry dropdowns, the state/country selects, the
 * Yes/No engagement questions), and the thank-you screen. The whole walkthrough
 * is clickable, so staff can check wording and field order the way an alum
 * meets them.
 *
 * It previously rendered a separate, localStorage-authored question list that
 * the live survey never read — so staff previewed a form nobody was ever sent,
 * and every survey change had to be mirrored by hand or the preview quietly
 * lied. Sharing the components is what makes "the preview matches" true by
 * construction. Do not re-add a parallel question model here.
 *
 * Laid out in the order the alum meets it — email subject and intro, the
 * survey, then the closing and sign-off — so reading the dialog top to bottom is
 * reading the whole thing in sequence.
 *
 * The email copy is READ from the server (`GET /survey/message`, #524) and shown
 * as text, not as textareas. It used to be editable here and saved to
 * `localStorage`, which made this dialog a second author of the message rather
 * than a preview of it — and since the send never read that storage, what it
 * showed was not what alumni got. Editing lives in one place now ("Edit email
 * message"), and this screen's only job is to show what is actually stored.
 *
 * Nothing is sent: no API call, no token, and Submit only advances to the
 * thank-you screen so the last step is visible too.
 */
export function SurveyPreview({
  surveyContact,
}: {
  /** The row the survey's public endpoint would serve (#774). Resolved by the
   *  page from the AUTHENTICATED support-contacts list, because this dialog has
   *  no survey token to read the public payload with. Same row either way --
   *  `surveySupportContact` mirrors the backend's label rule. */
  surveyContact?: { name?: string | null; email?: string | null } | null;
}) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <Button
        type="button"
        size="lg"
        onClick={() => setOpen(true)}
        aria-haspopup="dialog"
      >
        Sample survey
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent
          className="max-w-3xl"
          title="Sample survey"
          description="The email message, then exactly what an alum sees, using a sample record. Click through it: no email is sent and no record is touched."
        >
          {/*
            Open the real survey page in a new tab, on the sample record, landing
            on the section menu — the screen an alum reaches by pressing "I need
            to make changes" in the email.

            Worth having even though the dialog below shows the same screens: this
            is the survey at FULL WIDTH in a real browser tab, not boxed inside a
            modal that is narrower than any alum's window. Layout questions ("is
            the submit button obvious?", "how long is Personal really?") can only
            honestly be answered at the size the alum sees.

            `/survey/demo` is the sample alum, so nothing here touches a record.
            Opening in a new tab keeps the console page — and the campaign the
            staffer was part-way through setting up — exactly where it was.
          */}
          {/* Indented to px-5 so its left edge lines up with the blue preview
              note directly below it, which sits inside PreviewBody's px-5
              scroll container. Without the wrapper the link is flush to the
              dialog edge and the two read as belonging to different columns. */}
          <div className="mb-4 px-5">
            <a
              href="/survey/demo?step=edit"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-block text-sm font-medium text-brand-blue-600 underline underline-offset-2 hover:text-brand-blue-500"
            >
              Open the full survey in a new tab, as an alum sees it after &ldquo;I
              need to make changes&rdquo;
            </a>
          </div>

          {/* Remounting on each open resets the walkthrough, so the dialog
              always opens on the review screen rather than wherever the last
              viewer stopped. */}
          {open ? <PreviewBody surveyContact={surveyContact} /> : null}

          <DialogFooter>
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={() => setOpen(false)}
            >
              Done
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

/**
 * `helping` is where BOTH branches of the fork end.
 *
 * "Yes, everything is correct" leads there (#755) — the real survey POSTs the
 * confirmation and navigates to `/survey/{token}/help` — and so does Continue at
 * the end of the edit flow (#773), where the real survey stays on the page and
 * posts the edits and the involvement answers together. The preview walks the
 * same screen from either direction, in the matching `WaysToHelpMode`, so staff
 * see the ask an alum actually gets rather than the one branch that had it
 * first. Nothing is posted from here.
 */
type PreviewStatus = "review" | "helping" | "editing" | "submitted";

function PreviewBody({
  surveyContact,
}: {
  surveyContact?: { name?: string | null; email?: string | null } | null;
}) {
  const fields: Fields = SAMPLE_ALUM;
  const name = SAMPLE_ALUM_NAME;
  const firstName = name.split(/\s+/)[0] || name;

  const [status, setStatus] = useState<PreviewStatus>("review");
  // Which branch reached the ways-to-help screen, so the preview shows the copy
  // that branch really carries (#773) — "you're already done" after a
  // confirmation, "your updates aren't in yet" after edits.
  const [helpMode, setHelpMode] = useState<WaysToHelpMode>("confirmed");
  const [openSection, setOpenSection] = useState<string | null>(null);
  const [edits, setEdits] = useState<Fields>({});
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  // The "Jobs & internships" screen is part of what an alum meets (#441), so
  // the preview walks through it too — same component, same rules. Plain local
  // state that nothing reads: this dialog posts nothing anywhere.
  const [links, setLinks] = useState<LinkEntry[]>(() => [emptyLinkEntry()]);

  // The email copy is the ONE thing in this dialog that is real, so it is read
  // from the server rather than held here (#524). Intro and closing render
  // ABOVE and BELOW the survey respectively, in the order the alum meets them:
  // subject -> greeting -> intro -> the survey itself -> closing and sign-off.
  //
  // Nothing is editable here on purpose. A preview that can also author the
  // thing it previews is not a preview, and the last time this screen held its
  // own copy of the message (#574, then localStorage) the copy staff signed off
  // on was not the copy that was sent.
  const { state: emailCopy, reload: reloadEmailCopy } = useSurveyMessage();
  const stored = emailCopy.status === "ready" ? emailCopy.message : null;

  const valueOf = (key: string) => edits[key] ?? fields[key] ?? "";
  // The sample record untouched by the walkthrough's edits, so the controlled
  // vocabularies behave here exactly as they do for a real alum (#426).
  const onFileValueOf = (key: string) => fields[key] ?? "";
  const setEdit = (key: string, value: string) =>
    setEdits((prev) => ({ ...prev, [key]: value }));

  return (
    <div className="min-h-0 flex-1 overflow-auto px-5 py-4">
      <p className="mb-5 rounded-md border border-brand-blue-300/50 bg-brand-blue-50 px-4 py-2 text-xs text-navy-800">
        Preview, top to bottom, in the order an alum meets it: the email intro,
        the survey itself, then the closing. Nothing you type in the survey is
        saved or sent. The email copy is the wording stored on the server — the
        wording that is really sent — and is changed under &ldquo;Edit email
        message&rdquo;.
      </p>

      <EmailCopyBlock
        step="1 · Email"
        title="Subject and message (intro)"
        hint={`Read first, above their details. The greeting ("Hello ${firstName},") is added automatically.`}
        subject={stored?.subject}
        greeting={`Hello ${firstName},`}
        value={stored?.intro}
        state={emailCopy}
        onRetry={reloadEmailCopy}
        byline={surveyMessageByline(stored)}
      />

      <p className="mb-3 mt-6 text-xs font-semibold uppercase tracking-wide text-gray-500">
        2 · The survey they open
      </p>

      {status === "submitted" ? (
        <SuccessPanel
          title="Thank you. Your updates are in"
          body="Our team will review your response before any changes are applied to your record. You can safely close this page."
        />
      ) : status === "helping" ? (
        // The same component the real ways-to-help page renders (#755), over
        // the sample record. "I need to make changes" is a state flip here
        // rather than a route push, for the same reason section open/close is:
        // navigating inside the dialog would take the console page with it.
        <WaysToHelp
          firstName={firstName}
          mode={helpMode}
          valueOf={valueOf}
          setEdit={setEdit}
          links={links}
          setLinks={setLinks}
          onNeedChanges={() => {
            setOpenSection(null);
            setStatus("editing");
          }}
          onSubmit={() => setStatus("submitted")}
          submitting={false}
          submitError={null}
        />
      ) : status === "editing" ? (
        // Section open/close is plain state here, not history entries: inside a
        // modal a pushState would make the browser Back button close the whole
        // dialog instead of the open section.
        <EditFlow
          firstName={firstName}
          name={name}
          valueOf={valueOf}
          onFileValueOf={onFileValueOf}
          setEdit={setEdit}
          openSection={openSection}
          openSectionNav={setOpenSection}
          closeSectionNav={() => setOpenSection(null)}
          photoPreview={photoPreview}
          setPhotoPreview={setPhotoPreview}
          setPhotoFile={() => {}}
          links={links}
          setLinks={setLinks}
          onBack={() => setStatus("review")}
          // Continue leads to the ways-to-help screen, exactly as it does for an
          // alum (#773) — the preview walks the ending, it doesn't skip to the
          // thank-you.
          onSubmit={() => {
            setHelpMode("edited");
            setStatus("helping");
          }}
          submitting={false}
          submitError={null}
        />
      ) : (
        <>
          <div className="flex items-center gap-4">
            <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-navy-800 text-base font-semibold text-white">
              {initialsOf(name)}
            </span>
            <div className="min-w-0">
              <h2 className="text-2xl font-semibold leading-tight tracking-tight text-navy-800">
                Hi, {firstName}
              </h2>
              <p className="mt-1 truncate text-sm text-gray-500">
                {name} · BYU Finance · Marriott School of Business
              </p>
            </div>
          </div>
          <p className="mt-4 max-w-prose text-base leading-relaxed text-gray-600">
            Please review the information we currently have on file. This should
            take less than a minute.
          </p>

          <section
            className="mt-6 rounded-lg border border-gray-200"
            aria-labelledby="preview-info-heading"
          >
            <div className="border-b border-gray-200 px-5 py-3">
              <h3
                id="preview-info-heading"
                className="text-sm font-semibold text-gray-900"
              >
                Your information
              </h3>
            </div>
            <ReviewSections sections={INFO_SECTIONS} fields={fields} />
          </section>

          <div className="mt-6">
            <p className="text-base font-medium text-gray-900">
              Is this information correct?
            </p>
            <div className="mt-4 flex flex-col gap-3 sm:flex-row">
              <Button
                type="button"
                variant="navy"
                size="lg"
                className="w-full sm:w-auto"
                onClick={() => {
                  setHelpMode("confirmed");
                  setStatus("helping");
                }}
              >
                Yes, everything is correct
              </Button>
              <Button
                type="button"
                variant="secondary"
                size="lg"
                className="w-full sm:w-auto"
                onClick={() => {
                  setOpenSection(null);
                  setStatus("editing");
                }}
              >
                I need to make changes
              </Button>
            </div>
          </div>

          <TrustNote />
        </>
      )}

      {/* The real survey renders this as the last child of `SurveyPageShell` on
          EVERY screen (#774), so the sample has to carry it too or staff are
          previewing a survey the alum does not get. It reads the same config and
          renders nothing when no contact is set — so an unconfigured preview
          showing no link is correct, not a bug. */}
      <SurveyContactLink contact={surveyContact} />

      <EmailCopyBlock
        step="3 · Email"
        title="Closing & sign-off"
        hint="Read last, below their details and the button: confirm instructions and the sign-off."
        value={stored?.closing}
        state={emailCopy}
        onRetry={reloadEmailCopy}
        className="mt-6"
      />
    </div>
  );
}

/**
 * One block of email copy, exactly as the server holds it. Intro and closing are
 * the same panel with different copy, so they stay visually identical wherever
 * they sit — the only thing that tells them apart is their position around the
 * survey.
 *
 * READ-ONLY, and it shows its own load state rather than borrowing the survey's.
 * If the copy could not be read it says so: an empty panel here would read as
 * "the email has no intro", which is a sentence about the product rather than
 * about a failed request.
 */
function EmailCopyBlock({
  step,
  title,
  hint,
  subject,
  greeting,
  value,
  state,
  onRetry,
  byline,
  className,
}: {
  step: string;
  title: string;
  hint: string;
  /** Intro block only: the stored subject line, shown above the greeting. */
  subject?: string;
  /** Intro block only: the automatic "Hello {first name}," line. */
  greeting?: string;
  value: string | undefined;
  state: SurveyMessageState;
  onRetry: () => void;
  /** Intro block only: who last saved this wording. */
  byline?: string;
  className?: string;
}) {
  return (
    <div className={cn("rounded-lg border border-gray-200", className)}>
      <div className="border-b border-gray-200 px-4 py-2.5">
        <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">
          {step}
        </p>
        <p className="mt-0.5 text-sm font-semibold text-gray-900">{title}</p>
        <p className="mt-0.5 text-xs text-gray-500">{hint}</p>
        {byline ? (
          <p className="mt-1 text-xs text-gray-500">{byline}</p>
        ) : null}
      </div>
      <div className="px-4 py-3">
        {state.status === "loading" ? (
          <p className="text-sm text-gray-500">Loading the saved wording…</p>
        ) : state.status === "error" ? (
          <div>
            <p className="text-sm text-danger-600">{state.error}</p>
            <Button
              type="button"
              variant="secondary"
              size="sm"
              className="mt-2"
              onClick={onRetry}
            >
              Try again
            </Button>
          </div>
        ) : (
          <>
            {subject !== undefined ? (
              <p className="mb-2 text-sm text-gray-500">
                Subject:{" "}
                <span className="font-medium text-gray-900">
                  {subject.trim() || "(no subject)"}
                </span>
              </p>
            ) : null}
            {greeting ? (
              <p className="mb-2 text-sm text-gray-900">{greeting}</p>
            ) : null}
            <p className="whitespace-pre-wrap text-sm text-gray-700">{value}</p>
          </>
        )}
      </div>
    </div>
  );
}
