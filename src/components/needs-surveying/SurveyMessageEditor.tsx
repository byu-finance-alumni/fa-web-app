"use client";

import { useEffect, useRef, useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/components/ui/Toast";
import { InitialsAvatar } from "@/components/shared/InitialsAvatar";
import { SAMPLE_ALUM, SAMPLE_ALUM_NAME } from "@/lib/sampleAlumni";
import {
  surveyMessageByline,
  surveyMessageDirty,
  surveyMessageProblem,
  surveyMessageStatus,
  toSurveyMessageUpdate,
  type SurveyMessageRead,
  type SurveyMessageStatusTone,
  type SurveyMessageUpdate,
} from "@/lib/surveyMessage";
import { useSurveyMessage } from "@/lib/useSurveyMessage";
import {
  HEADSHOT_FIELD_KEY,
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

/** What the last save attempt did, so the dialog can say so out loud. */
type SaveState =
  | { kind: "idle" }
  | { kind: "saved"; what: "save" | "reset" }
  | { kind: "error"; message: string };

/** Status-line colors, per UX-UI.md's semantic palette. */
const STATUS_CLASS: Record<SurveyMessageStatusTone, string> = {
  error: "text-sm font-medium text-danger-600",
  warning: "text-sm font-medium text-warning-600",
  success: "text-sm font-medium text-success-600",
  muted: "text-sm text-gray-500",
};

/**
 * "Edit email message" — the survey email's subject, intro, closing and the
 * choice of which on-file details it previews.
 *
 * ⚠️ THIS IS THE REAL COPY, STORED ON THE SERVER (#524). It used to be written
 * to `localStorage`, which meant every staffer edited a private copy that no
 * other staffer and no alum ever saw — "updating the survey message is not
 * saving" was the complaint, and it was literally true of everything except the
 * one browser doing the typing. Everything here now reads and writes
 * `/survey/message`, there is no local fallback, and the byline names whose
 * wording is currently live so two people editing the same paragraph can tell.
 *
 * Nothing is saved until Save is pressed — the dialog says which state it is in
 * at all times, and refuses to close on an unsaved edit without asking. A
 * silently dropped edit is the bug this screen exists to fix; it must not be
 * able to reintroduce it.
 *
 * PRIVACY: the on-file block puts PII in an email (email isn't a secure
 * channel) — keep the set minimal and run it past FERPA/appsec before a real
 * send. The safest data still lives behind the tokenized link.
 *
 * Text-only controls, per the project's icon-free convention.
 */
export function SurveyMessageEditor({
  /**
   * Whether this account may CHANGE the copy. Read-only otherwise — a career
   * director's wording is worth reading whoever you are, and a disabled form
   * explains itself where a 403 on Save does not. The backend re-enforces this;
   * a 403 from a write flips the dialog read-only too, so an over-generous
   * guess here still cannot save anything.
   */
  canEdit,
}: {
  canEdit: boolean;
}) {
  const { toast } = useToast();
  const { state, reload, save, reset, writing } = useSurveyMessage();

  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<SurveyMessageUpdate | null>(null);
  const [saveState, setSaveState] = useState<SaveState>({ kind: "idle" });
  const [confirmReset, setConfirmReset] = useState(false);
  const [confirmClose, setConfirmClose] = useState(false);
  // Set when the backend refuses a write with a 403, whatever we guessed.
  const [refused, setRefused] = useState(false);
  // Which of the three emails the preview below is showing (#560). The cadence
  // is one initial and two follow-ups, and only the follow-ups carry the
  // follow-up line — so there was previously NO way to read what a follow-up
  // actually says before it went out. Preview only; it changes nothing saved.
  const [previewFollowUp, setPreviewFollowUp] = useState(false);

  const saved = state.status === "ready" ? state.message : null;
  // What the draft was last baselined against, so a re-read can tell an
  // untouched draft (safe to replace) from someone's typing (never replace).
  const baseline = useRef<SurveyMessageRead | null>(null);

  useEffect(() => {
    if (!saved) return;
    setDraft((prev) => {
      if (!prev) return toSurveyMessageUpdate(saved);
      // Someone else may have saved since this dialog last read the message.
      // Adopting their wording is right when nothing is being typed here, and
      // wrong the moment it would overwrite an edit in progress.
      return surveyMessageDirty(prev, baseline.current)
        ? prev
        : toSurveyMessageUpdate(saved);
    });
    baseline.current = saved;
  }, [saved]);

  const editable = canEdit && !refused;
  const dirty = surveyMessageDirty(draft, saved);
  const problem = draft ? surveyMessageProblem(draft) : null;
  const status = surveyMessageStatus({
    error: saveState.kind === "error" ? saveState.message : null,
    // Only worth saying while the draft is still on the way to being sendable;
    // a stored message that somehow reads empty is not the editor's news.
    problem: dirty ? problem : null,
    dirty,
    justSaved: saveState.kind === "saved" ? saveState.what : null,
    editable,
  });

  // Last line of defence for an unsaved edit: it only fires on a real
  // navigation away, which is exactly when the draft would be lost for good.
  useEffect(() => {
    if (!dirty) return;
    const warn = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);

  const patch = (change: Partial<SurveyMessageUpdate>) => {
    setSaveState({ kind: "idle" });
    setDraft((prev) => (prev ? { ...prev, ...change } : prev));
  };

  const toggleField = (key: string) => {
    if (!draft) return;
    const on = draft.on_file_fields.includes(key);
    patch({
      on_file_fields: on
        ? draft.on_file_fields.filter((k) => k !== key)
        : [...draft.on_file_fields, key],
    });
  };

  async function onSave({ thenClose = false } = {}) {
    if (!draft) return;
    const stop = surveyMessageProblem(draft);
    if (stop) {
      setSaveState({ kind: "error", message: stop });
      return;
    }
    const res = await save(draft);
    if (!res.ok) {
      // The draft stays in the box: a refusal is something to fix, not
      // something to lose work over. That includes the close-and-save path —
      // a failed save must never take the dialog (and the draft) with it.
      if (res.forbidden) setRefused(true);
      setSaveState({ kind: "error", message: res.error });
      setConfirmClose(false);
      toast.error(res.error);
      return;
    }
    setDraft(toSurveyMessageUpdate(res.message));
    setSaveState({ kind: "saved", what: "save" });
    toast.success("Saved. This is the message alumni will be sent.");
    if (thenClose) {
      setConfirmClose(false);
      setOpen(false);
    }
  }

  async function onReset() {
    const res = await reset();
    setConfirmReset(false);
    if (!res.ok) {
      if (res.forbidden) setRefused(true);
      setSaveState({ kind: "error", message: res.error });
      toast.error(res.error);
      return;
    }
    setDraft(toSurveyMessageUpdate(res.message));
    setSaveState({ kind: "saved", what: "reset" });
    toast.success("Back to the standard wording.");
  }

  /**
   * Re-read on open, so the dialog shows what is stored NOW rather than what it
   * read when the page loaded — two career directors share this message, and
   * one of them may have rewritten it in the meantime. An edit already in the
   * box survives it (see the baseline effect above).
   */
  function openEditor() {
    setOpen(true);
    reload();
  }

  /** Closing with an unsaved edit asks first — it never just drops it. */
  function requestClose(next: boolean) {
    if (next) {
      openEditor();
      return;
    }
    if (dirty) {
      setConfirmClose(true);
      return;
    }
    setConfirmClose(false);
    setConfirmReset(false);
    setOpen(false);
  }

  // Preview rows: selected fields in the order staff picked them (so employment
  // leads, matching the email), keeping only those with a value on file.
  const fields = draft?.on_file_fields ?? [];
  const previewRows = fields
    .map((key) => SURVEY_FIELD_BY_KEY[key])
    .filter((f): f is SurveyField => Boolean(f) && Boolean(SAMPLE_ALUM[f.key]))
    .map((f) => ({ label: f.label, value: SAMPLE_ALUM[f.key] }));
  const showHeadshot = fields.includes(HEADSHOT_FIELD_KEY);

  return (
    <>
      <Button
        type="button"
        variant="secondary"
        size="lg"
        onClick={openEditor}
        aria-haspopup="dialog"
      >
        Edit email message
      </Button>

      <Dialog open={open} onOpenChange={requestClose}>
        <DialogContent
          className="max-w-3xl"
          title="Email message"
          description="The real subject and copy of the survey email, shared by everyone. Changes apply to sends made after you save."
        >
          <DialogBody className="space-y-5">
            {state.status === "loading" && !draft ? (
              <p className="text-sm text-gray-500">
                Loading the saved message…
              </p>
            ) : state.status === "error" && !draft ? (
              <div>
                <p className="text-sm text-danger-600">{state.error}</p>
                <p className="mt-1 text-xs text-gray-500">
                  Nothing is shown rather than a guess: the wording that gets
                  sent lives on the server, and this dialog keeps no copy of it.
                </p>
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  className="mt-3"
                  onClick={reload}
                >
                  Try again
                </Button>
              </div>
            ) : draft ? (
              <>
                {/* Who owns the wording that is live right now (#524). */}
                <div className="rounded-md border border-gray-200 bg-gray-50 px-4 py-3">
                  <p className="text-sm text-gray-600">
                    {surveyMessageByline(saved)}
                  </p>
                  <p className="mt-1 text-xs text-gray-500">
                    Everyone who opens this dialog sees the same message. It is
                    the copy the send actually uses.
                  </p>
                  {!editable ? (
                    <p className="mt-2 text-sm font-medium text-gray-700">
                      Read-only for your account. Ask a career director or an
                      engineer to change the wording.
                    </p>
                  ) : null}
                </div>

                {/* Subject — editable as of #524; it was hardcoded before. */}
                <div>
                  <Label htmlFor="email-subject">Subject line</Label>
                  <p className="mt-0.5 text-xs text-gray-500">
                    What they see in their inbox before they open anything.
                  </p>
                  <Input
                    id="email-subject"
                    value={draft.subject}
                    onChange={(e) => patch({ subject: e.target.value })}
                    disabled={!editable}
                    className="mt-2"
                  />
                </div>

                {/* The follow-up line — reminders only (#560). Sits here, above
                    the intro, because that is where the email shows it. */}
                <div>
                  <Label htmlFor="email-reminder-note">
                    Follow-up line (2nd and 3rd emails only)
                  </Label>
                  <p className="mt-0.5 text-xs text-gray-500">
                    Added above the message on the two reminder emails, so they
                    do not read like a first contact. The first email never
                    shows it. Leave this empty and all three emails read the
                    same.
                  </p>
                  <Textarea
                    id="email-reminder-note"
                    value={draft.reminder_note}
                    onChange={(e) => patch({ reminder_note: e.target.value })}
                    disabled={!editable}
                    rows={2}
                    className="mt-2"
                  />
                </div>

                {/* Intro message (above the record preview) */}
                <div>
                  <Label htmlFor="email-message">Message (intro)</Label>
                  <p className="mt-0.5 text-xs text-gray-500">
                    Shown above their info. The greeting (&quot;Hello{" "}
                    {SAMPLE_FIRST_NAME},&quot;) is added automatically at the
                    start.
                  </p>
                  <Textarea
                    id="email-message"
                    value={draft.intro}
                    onChange={(e) => patch({ intro: e.target.value })}
                    disabled={!editable}
                    rows={5}
                    className="mt-2"
                  />
                </div>

                {/* Closing (below the record preview / call to action) */}
                <div>
                  <Label htmlFor="email-closing">Closing &amp; sign-off</Label>
                  <p className="mt-0.5 text-xs text-gray-500">
                    Shown below their info and the button: confirm instructions
                    and the sign-off.
                  </p>
                  <Textarea
                    id="email-closing"
                    value={draft.closing}
                    onChange={(e) => patch({ closing: e.target.value })}
                    disabled={!editable}
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
                    Pick which details to preview so they can spot anything
                    wrong at a glance. Adds PII to the email, so keep it minimal.
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
                              className={
                                editable
                                  ? "flex cursor-pointer items-center gap-2 text-sm text-gray-700"
                                  : "flex items-center gap-2 text-sm text-gray-500"
                              }
                            >
                              <input
                                type="checkbox"
                                checked={draft.on_file_fields.includes(f.key)}
                                onChange={() => toggleField(f.key)}
                                disabled={!editable}
                                className="h-4 w-4 rounded border-gray-300 text-brand-blue-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-blue-500 focus-visible:ring-offset-1 disabled:cursor-not-allowed disabled:opacity-50"
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
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="text-xs font-semibold uppercase tracking-wide text-gray-400">
                      Email preview
                    </p>
                    {/* Reading a follow-up used to be impossible from the app
                        (#560, #562) — all three emails were identical, so there
                        was nothing to switch between. Now there is. */}
                    <div className="flex gap-1.5">
                      <Button
                        type="button"
                        variant={previewFollowUp ? "secondary" : "primary"}
                        size="sm"
                        onClick={() => setPreviewFollowUp(false)}
                      >
                        First email
                      </Button>
                      <Button
                        type="button"
                        variant={previewFollowUp ? "primary" : "secondary"}
                        size="sm"
                        onClick={() => setPreviewFollowUp(true)}
                      >
                        Follow-up
                      </Button>
                    </div>
                  </div>
                  <div className="mt-1 overflow-hidden rounded-lg border border-gray-200">
                    <div className="bg-navy-800 px-4 py-3">
                      <p className="text-[11px] font-semibold uppercase tracking-[0.15em] text-brand-blue-300">
                        BYU Finance Alumni
                      </p>
                      <p className="mt-1 text-sm font-medium text-white">
                        {draft.subject.trim() || "(no subject)"}
                      </p>
                    </div>
                    <div className="space-y-3 bg-white px-4 py-4">
                      <p className="whitespace-pre-wrap text-sm text-gray-700">
                        Hello {SAMPLE_FIRST_NAME},{"\n\n"}
                        {previewFollowUp && draft.reminder_note.trim()
                          ? `${draft.reminder_note.trim()}\n\n`
                          : ""}
                        {draft.intro}
                      </p>
                      {previewFollowUp && !draft.reminder_note.trim() ? (
                        <p className="text-xs italic text-gray-400">
                          No follow-up line, so the 2nd and 3rd emails read
                          exactly like the first.
                        </p>
                      ) : null}

                      {previewRows.length || showHeadshot ? (
                        <div className="rounded-md border border-gray-200 bg-gray-50 p-3">
                          <p className="text-xs font-semibold text-gray-700">
                            Here&apos;s what we have on file
                          </p>
                          {showHeadshot ? (
                            <div className="mt-2 flex items-center gap-3">
                              <InitialsAvatar
                                name={SAMPLE_ALUM_NAME}
                                size="lg"
                              />
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
                          No fields selected, so the email shows no record
                          preview.
                        </p>
                      )}

                      <div>
                        <span className="inline-flex h-9 items-center rounded-md bg-brand-blue-600 px-4 text-sm font-semibold text-white">
                          Confirm or update my info →
                        </span>
                        <p className="mt-1.5 text-xs text-gray-400">
                          Links to their private page, where they confirm or
                          edit.
                        </p>
                      </div>

                      <p className="whitespace-pre-wrap text-sm text-gray-700">
                        {draft.closing}
                      </p>
                    </div>
                  </div>
                  <p className="mt-1.5 flex items-center gap-1.5 text-xs text-gray-400">
                    <Badge variant="warning">FERPA</Badge>
                    Emailing record fields is a privacy tradeoff. Review before a
                    real send.
                  </p>
                </div>

                {confirmReset ? (
                  <div className="rounded-md border border-gray-300 bg-gray-50 p-3">
                    <p className="text-sm text-gray-600">
                      Put the subject, the copy and the field selection back to
                      the wording the app ships with? The wording that is live
                      now
                      {dirty ? " and your unsaved edit" : ""} will be gone.
                    </p>
                    <div className="mt-3 flex gap-2">
                      <Button
                        type="button"
                        variant="secondary"
                        size="sm"
                        onClick={() => setConfirmReset(false)}
                        disabled={writing}
                      >
                        Cancel
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        onClick={() => void onReset()}
                        disabled={writing}
                      >
                        {writing ? "Restoring…" : "Restore the standard wording"}
                      </Button>
                    </div>
                  </div>
                ) : null}

                {confirmClose ? (
                  <div className="rounded-md border border-warning-600/40 bg-warning-50 p-3">
                    <p className="text-sm text-navy-800">
                      You have changes that are not saved. Close and lose them?
                    </p>
                    <div className="mt-3 flex flex-wrap gap-2">
                      <Button
                        type="button"
                        variant="secondary"
                        size="sm"
                        onClick={() => setConfirmClose(false)}
                      >
                        Keep editing
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        onClick={() => void onSave({ thenClose: true })}
                        disabled={writing || !!problem}
                      >
                        {writing ? "Saving…" : "Save and close"}
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          setDraft(saved ? toSurveyMessageUpdate(saved) : null);
                          setSaveState({ kind: "idle" });
                          setConfirmClose(false);
                          setOpen(false);
                        }}
                      >
                        Discard my changes
                      </Button>
                    </div>
                  </div>
                ) : null}
              </>
            ) : null}
          </DialogBody>

          <DialogFooter className="flex-col items-stretch gap-3 sm:flex-row sm:items-center sm:justify-between">
            {/* Saved / unsaved / failed — always on screen, never implied. */}
            <p role="status" aria-live="polite" className={STATUS_CLASS[status.tone]}>
              {status.text}
            </p>

            <div className="flex flex-wrap gap-2">
              {editable && draft ? (
                <>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => setConfirmReset(true)}
                    disabled={writing || confirmReset}
                  >
                    Reset to default
                  </Button>
                  <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    onClick={() => {
                      setDraft(saved ? toSurveyMessageUpdate(saved) : null);
                      setSaveState({ kind: "idle" });
                    }}
                    disabled={!dirty || writing}
                  >
                    Discard changes
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    onClick={() => void onSave()}
                    disabled={!dirty || writing || !!problem}
                  >
                    {writing ? "Saving…" : "Save message"}
                  </Button>
                </>
              ) : null}
              <Button
                type="button"
                variant={editable && draft ? "ghost" : "secondary"}
                size="sm"
                onClick={() => requestClose(false)}
                disabled={writing}
              >
                Close
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
