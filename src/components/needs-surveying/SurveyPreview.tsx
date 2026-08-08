"use client";

import { useEffect, useState } from "react";
import { ClipboardList } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { SAMPLE_ALUM, SAMPLE_ALUM_NAME } from "@/lib/sampleAlumni";
import {
  DEFAULT_SURVEY_CLOSING,
  DEFAULT_SURVEY_MESSAGE,
  loadClosing,
  loadMessage,
  saveClosing,
  saveMessage,
} from "@/lib/surveyStore";
import {
  EditFlow,
  INFO_SECTIONS,
  ReviewGroup,
  SuccessPanel,
  TrustNote,
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
 * Laid out in the order the alum meets it — email intro, the survey, then the
 * closing and sign-off — so reading the dialog top to bottom is reading the
 * whole thing in sequence. Both blocks of email copy are editable in place and
 * saved through the same `surveyStore` the "Edit email message" dialog uses, so
 * the two always show the same copy whichever one staff happen to open.
 *
 * Nothing is sent: no API call, no token, and Submit only advances to the
 * thank-you screen so the last step is visible too.
 */
export function SurveyPreview() {
  const [open, setOpen] = useState(false);

  return (
    <>
      <Button
        type="button"
        size="lg"
        onClick={() => setOpen(true)}
        aria-haspopup="dialog"
      >
        <ClipboardList aria-hidden="true" />
        Sample survey
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent
          className="max-w-3xl"
          title="Sample survey"
          description="The email message, then exactly what an alum sees, using a sample record. Click through it — no email is sent and no record is touched."
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
          <a
            href="/survey/demo?step=edit"
            target="_blank"
            rel="noopener noreferrer"
            className="mb-4 inline-block text-sm font-medium text-brand-blue-600 underline underline-offset-2 hover:text-brand-blue-500"
          >
            Open the full survey in a new tab — as an alum sees it after &ldquo;I
            need to make changes&rdquo;
          </a>

          {/* Remounting on each open resets the walkthrough, so the dialog
              always opens on the review screen rather than wherever the last
              viewer stopped. */}
          {open ? <PreviewBody /> : null}

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

type PreviewStatus = "review" | "confirmed" | "editing" | "submitted";

function PreviewBody() {
  const fields: Fields = SAMPLE_ALUM;
  const name = SAMPLE_ALUM_NAME;
  const firstName = name.split(/\s+/)[0] || name;

  const [status, setStatus] = useState<PreviewStatus>("review");
  const [openSection, setOpenSection] = useState<string | null>(null);
  const [edits, setEdits] = useState<Fields>({});
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);

  // The email copy IS saved (unlike everything else in this dialog) — it's the
  // real message, edited here or in "Edit email message", both reading and
  // writing the same keys. Load in an effect, never during render: localStorage
  // doesn't exist on the server.
  //
  // Intro and closing render ABOVE and BELOW the survey respectively, in the
  // order the alum meets them: greeting -> intro -> the survey itself -> closing
  // and sign-off. Two separate blocks with the survey between them, not one
  // stacked pile of text boxes.
  const [message, setMessage] = useState(DEFAULT_SURVEY_MESSAGE);
  const [closing, setClosing] = useState(DEFAULT_SURVEY_CLOSING);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    setMessage(loadMessage());
    setClosing(loadClosing());
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    saveMessage(message);
  }, [message, hydrated]);

  useEffect(() => {
    if (!hydrated) return;
    saveClosing(closing);
  }, [closing, hydrated]);

  const valueOf = (key: string) => edits[key] ?? fields[key] ?? "";
  // The sample record untouched by the walkthrough's edits, so the controlled
  // vocabularies behave here exactly as they do for a real alum (#426).
  const onFileValueOf = (key: string) => fields[key] ?? "";
  const setEdit = (key: string, value: string) =>
    setEdits((prev) => ({ ...prev, [key]: value }));

  return (
    <div className="min-h-0 flex-1 overflow-auto px-5 py-4">
      <p className="mb-5 rounded-md border border-brand-blue-300/50 bg-brand-blue-50 px-4 py-2 text-xs text-navy-800">
        Preview — top to bottom, in the order an alum meets it: the email intro,
        the survey itself, then the closing. Nothing you type in the survey is
        saved or sent; the email copy is real and saves as you type.
      </p>

      <EmailCopyBlock
        id="preview-email-message"
        step="1 · Email"
        title="Message (intro)"
        hint={`Read first, above their details. The greeting ("Hello ${firstName},") is added automatically.`}
        greeting={`Hello ${firstName},`}
        value={message}
        onChange={setMessage}
        placeholder={DEFAULT_SURVEY_MESSAGE}
        rows={6}
      />

      <p className="mb-3 mt-6 text-xs font-semibold uppercase tracking-wide text-gray-500">
        2 · The survey they open
      </p>

      {status === "submitted" ? (
        <SuccessPanel
          title="Thank you — your updates are in"
          body="Our team will review your response before any changes are applied to your record. You can safely close this page."
        />
      ) : status === "confirmed" ? (
        <SuccessPanel
          title={`Thanks for confirming, ${firstName}`}
          body="Your information is up to date. We appreciate you helping us keep in touch about events, mentoring, and opportunities."
          action={
            <Button variant="secondary" onClick={() => setStatus("editing")}>
              I need to make changes
            </Button>
          }
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
          onBack={() => setStatus("review")}
          onSubmit={() => setStatus("submitted")}
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
            <div className="grid gap-x-8 gap-y-5 px-5 py-5 sm:grid-cols-2">
              {INFO_SECTIONS.map((s) => (
                <ReviewGroup key={s.id} section={s} fields={fields} />
              ))}
            </div>
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
                onClick={() => setStatus("confirmed")}
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

      <EmailCopyBlock
        id="preview-email-closing"
        step="3 · Email"
        title="Closing & sign-off"
        hint="Read last, below their details and the button — confirm instructions and the sign-off."
        value={closing}
        onChange={setClosing}
        placeholder={DEFAULT_SURVEY_CLOSING}
        rows={7}
        className="mt-6"
      />
    </div>
  );
}

/**
 * One editable block of email copy. Intro and closing are the same control with
 * different copy, so they stay visually identical wherever they sit — the only
 * thing that tells them apart is their position around the survey.
 */
function EmailCopyBlock({
  id,
  step,
  title,
  hint,
  greeting,
  value,
  onChange,
  placeholder,
  rows,
  className,
}: {
  id: string;
  step: string;
  title: string;
  hint: string;
  /** Intro only: the automatic "Hello {first name}," line above the textarea. */
  greeting?: string;
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
  rows: number;
  className?: string;
}) {
  return (
    <div className={cn("rounded-lg border border-gray-200", className)}>
      <div className="border-b border-gray-200 px-4 py-2.5">
        <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">
          {step}
        </p>
        <Label htmlFor={id} className="mt-0.5 block text-sm font-semibold text-gray-900">
          {title}
        </Label>
        <p className="mt-0.5 text-xs text-gray-500">{hint}</p>
      </div>
      <div className="px-4 py-3">
        {greeting ? (
          <p className="mb-2 text-sm text-gray-900">{greeting}</p>
        ) : null}
        <Textarea
          id={id}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          rows={rows}
        />
      </div>
    </div>
  );
}
