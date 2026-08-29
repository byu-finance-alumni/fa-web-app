"use client";

import { useEffect, useState } from "react";
import { Mail, RotateCcw } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogFooter,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { InitialsAvatar } from "@/components/shared/InitialsAvatar";
import { SAMPLE_ALUM, SAMPLE_ALUM_NAME } from "@/lib/sampleAlumni";
import {
  DEFAULT_EMAIL_FIELDS,
  DEFAULT_SURVEY_CLOSING,
  DEFAULT_SURVEY_MESSAGE,
  HEADSHOT_FIELD_KEY,
  loadClosing,
  loadEmailFields,
  loadMessage,
  saveClosing,
  saveEmailFields,
  saveMessage,
} from "@/lib/surveyStore";
import {
  SURVEY_FIELD_BY_KEY,
  SURVEY_FIELDS,
  type SurveyField,
  type SurveyFieldGroup,
} from "@/types/survey";

/** First name for the greeting ("Hello Jordan,"). */
const SAMPLE_FIRST_NAME =
  SAMPLE_ALUM_NAME.split(/\s+/)[0] || SAMPLE_ALUM_NAME;

// The record fields staff can preview in the email. Only text columns (with a
// value to show) — grouped, short labels for the picker.
const GROUP_LABEL: Partial<Record<SurveyFieldGroup, string>> = {
  employment: "Employment",
  contact: "Contact",
  profile: "Profile",
};
const EMAIL_FIELD_GROUPS = (
  ["employment", "contact", "profile"] as SurveyFieldGroup[]
).map((group) => ({
  group,
  label: GROUP_LABEL[group] ?? group,
  fields: [
    // The profile photo isn't a survey column, but staff can include it too.
    ...(group === "profile"
      ? [{ key: HEADSHOT_FIELD_KEY, label: "Photo (headshot)" }]
      : []),
    ...SURVEY_FIELDS.filter((f) => f.kind === "text" && f.group === group).map(
      (f) => ({ key: f.key, label: f.label }),
    ),
  ],
}));

/**
 * "Edit email message" — compose the survey email: the intro note AND an
 * optional read-only preview of the alum's current info ("here's what we have on
 * file") so they can eyeball it before clicking through. Staff pick which fields
 * appear. Persisted to `localStorage`; frontend-only, no send.
 *
 * PRIVACY: including record fields puts PII in the email body (email isn't a
 * secure channel) — keep the set minimal and run it past FERPA/appsec before a
 * real send. The safest data still lives behind the tokenized link.
 */
export function SurveyMessageEditor() {
  const [open, setOpen] = useState(false);
  const [message, setMessage] = useState(DEFAULT_SURVEY_MESSAGE);
  const [closing, setClosing] = useState(DEFAULT_SURVEY_CLOSING);
  const [emailFields, setEmailFields] = useState<string[]>([
    ...DEFAULT_EMAIL_FIELDS,
  ]);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    setMessage(loadMessage());
    setClosing(loadClosing());
    setEmailFields(loadEmailFields());
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

  useEffect(() => {
    if (!hydrated) return;
    saveEmailFields(emailFields);
  }, [emailFields, hydrated]);

  const toggleField = (key: string) =>
    setEmailFields((prev) =>
      prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key],
    );

  const resetAll = () => {
    setMessage(DEFAULT_SURVEY_MESSAGE);
    setClosing(DEFAULT_SURVEY_CLOSING);
    setEmailFields([...DEFAULT_EMAIL_FIELDS]);
  };

  // Preview rows: selected fields in the order staff picked them (so employment
  // leads, matching the email), keeping only those with a value on file.
  const previewRows = emailFields
    .map((key) => SURVEY_FIELD_BY_KEY[key])
    .filter((f): f is SurveyField => Boolean(f) && Boolean(SAMPLE_ALUM[f.key]))
    .map((f) => ({ label: f.label, value: SAMPLE_ALUM[f.key] }));
  const showHeadshot = emailFields.includes(HEADSHOT_FIELD_KEY);

  return (
    <>
      <Button
        type="button"
        variant="secondary"
        size="lg"
        onClick={() => setOpen(true)}
        aria-haspopup="dialog"
      >
        <Mail aria-hidden="true" />
        Edit email message
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent
          className="max-w-3xl"
          title="Email message"
          description="Write the note and choose which of their current details to show in the email. Saved on this device."
        >
          <DialogBody className="space-y-5">
            {/* Intro message (above the record preview) */}
            <div>
              <Label htmlFor="email-message">Message (intro)</Label>
              <p className="mt-0.5 text-xs text-gray-500">
                Shown above their info. The greeting (&quot;Hello{" "}
                {SAMPLE_FIRST_NAME},&quot;) is added automatically at the start.
              </p>
              <Textarea
                id="email-message"
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder={DEFAULT_SURVEY_MESSAGE}
                rows={5}
                className="mt-2"
              />
            </div>

            {/* Closing (below the record preview / call to action) */}
            <div>
              <Label htmlFor="email-closing">Closing &amp; sign-off</Label>
              <p className="mt-0.5 text-xs text-gray-500">
                Shown below their info and the button: confirm instructions and
                the sign-off.
              </p>
              <Textarea
                id="email-closing"
                value={closing}
                onChange={(e) => setClosing(e.target.value)}
                placeholder={DEFAULT_SURVEY_CLOSING}
                rows={6}
                className="mt-2"
              />
            </div>

            {/* Field picker */}
            <div>
              <p className="text-sm font-medium text-gray-900">
                Show their info in the email
              </p>
              <p className="mt-0.5 text-xs text-gray-500">
                Pick which details to preview so they can spot anything wrong at
                a glance. Adds PII to the email, so keep it minimal.
              </p>
              <div className="mt-2 grid gap-3 sm:grid-cols-3">
                {EMAIL_FIELD_GROUPS.map((g) => (
                  <div key={g.group}>
                    <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-gray-400">
                      {g.label}
                    </p>
                    <div className="space-y-1.5">
                      {g.fields.map((f) => (
                        <label
                          key={f.key}
                          className="flex cursor-pointer items-center gap-2 text-sm text-gray-700"
                        >
                          <input
                            type="checkbox"
                            checked={emailFields.includes(f.key)}
                            onChange={() => toggleField(f.key)}
                            className="h-4 w-4 rounded border-gray-300 text-brand-blue-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-blue-500 focus-visible:ring-offset-1"
                          />
                          {f.label}
                        </label>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Email preview */}
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-gray-400">
                Email preview
              </p>
              <div className="mt-1 overflow-hidden rounded-lg border border-gray-200">
                <div className="bg-navy-800 px-4 py-3">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.15em] text-brand-blue-300">
                    BYU Finance Alumni
                  </p>
                </div>
                <div className="space-y-3 bg-white px-4 py-4">
                  <p className="whitespace-pre-wrap text-sm text-gray-700">
                    Hello {SAMPLE_FIRST_NAME},{"\n\n"}
                    {message.trim() || DEFAULT_SURVEY_MESSAGE}
                  </p>

                  {previewRows.length || showHeadshot ? (
                    <div className="rounded-md border border-gray-200 bg-gray-50 p-3">
                      <p className="text-xs font-semibold text-gray-700">
                        Here&apos;s what we have on file
                      </p>
                      {showHeadshot ? (
                        <div className="mt-2 flex items-center gap-3">
                          <InitialsAvatar name={SAMPLE_ALUM_NAME} size="lg" />
                          <span className="text-xs text-gray-500">
                            Profile photo
                          </span>
                        </div>
                      ) : null}
                      {previewRows.length ? (
                        <dl className="mt-2 space-y-1">
                          {previewRows.map((r) => (
                            <div
                              key={r.label}
                              className="flex justify-between gap-4 text-sm"
                            >
                              <dt className="text-gray-500">{r.label}</dt>
                              <dd className="text-right font-medium text-gray-900">
                                {r.value}
                              </dd>
                            </div>
                          ))}
                        </dl>
                      ) : null}
                    </div>
                  ) : (
                    <p className="text-xs italic text-gray-400">
                      No fields selected, so the email shows no record preview.
                    </p>
                  )}

                  <div>
                    <span className="inline-flex h-9 items-center rounded-md bg-brand-blue-600 px-4 text-sm font-semibold text-white">
                      Confirm or update my info →
                    </span>
                    <p className="mt-1.5 text-xs text-gray-400">
                      Links to their private page, where they confirm or edit.
                    </p>
                  </div>

                  <p className="whitespace-pre-wrap text-sm text-gray-700">
                    {closing.trim() || DEFAULT_SURVEY_CLOSING}
                  </p>
                </div>
              </div>
              <p className="mt-1.5 flex items-center gap-1.5 text-xs text-gray-400">
                <Badge variant="warning">FERPA</Badge>
                Emailing record fields is a privacy tradeoff. Review before a
                real send.
              </p>
            </div>
          </DialogBody>

          <DialogFooter className="justify-between">
            <Button type="button" variant="ghost" size="sm" onClick={resetAll}>
              <RotateCcw aria-hidden="true" />
              Reset to default
            </Button>
            <Button type="button" size="sm" onClick={() => setOpen(false)}>
              Done
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
