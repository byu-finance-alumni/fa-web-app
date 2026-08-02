"use client";

import { useEffect, useState } from "react";
import { ClipboardList } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { SAMPLE_ALUM, SAMPLE_ALUM_NAME } from "@/lib/sampleAlumni";
import {
  DEFAULT_SURVEY_MESSAGE,
  loadMessage,
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
 * The email intro that carries the survey link sits on top and is editable
 * right here, saved through the same `surveyStore` the "Edit email message"
 * dialog uses — so the two are always showing the same copy, whichever one
 * staff happen to open.
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
  // writing the same key. Load in an effect, never during render: localStorage
  // doesn't exist on the server.
  const [message, setMessage] = useState(DEFAULT_SURVEY_MESSAGE);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    setMessage(loadMessage());
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    saveMessage(message);
  }, [message, hydrated]);

  const valueOf = (key: string) => edits[key] ?? fields[key] ?? "";
  const setEdit = (key: string, value: string) =>
    setEdits((prev) => ({ ...prev, [key]: value }));

  return (
    <div className="min-h-0 flex-1 overflow-auto px-5 py-4">
      <p className="mb-5 rounded-md border border-brand-blue-300/50 bg-brand-blue-50 px-4 py-2 text-xs text-navy-800">
        Preview — this is the live survey with a sample alum&apos;s details.
        Nothing you type in the form is saved or sent; the email message below
        is real and saves as you type.
      </p>

      <div className="mb-6 rounded-lg border border-gray-200">
        <div className="border-b border-gray-200 px-4 py-2.5">
          <Label
            htmlFor="preview-email-message"
            className="text-sm font-semibold text-gray-900"
          >
            Email message
          </Label>
          <p className="mt-0.5 text-xs text-gray-500">
            What they read in the email before opening the survey. Edit it here
            — it saves as you type. The closing and the on-file details block
            live in &quot;Edit email message&quot;.
          </p>
        </div>
        <div className="px-4 py-3">
          <p className="text-sm text-gray-900">Hello {firstName},</p>
          <Textarea
            id="preview-email-message"
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder={DEFAULT_SURVEY_MESSAGE}
            rows={6}
            className="mt-2"
          />
        </div>
      </div>

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
    </div>
  );
}
