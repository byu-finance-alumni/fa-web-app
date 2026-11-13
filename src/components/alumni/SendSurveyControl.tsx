"use client";

import { useId, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogFooter,
  DialogTitle,
} from "@/components/ui/dialog";
import { useToast } from "@/components/ui/Toast";
import { sendSurveyOneOff } from "@/app/(app)/alumni/actions";
import {
  SEND_SURVEY_LABEL,
  disabledReason,
  emailSourceNote,
  lastRepliedNote,
  lastSentWarning,
  sentToast,
  type SurveyOneOffPreview,
} from "@/lib/surveyOneOff";

/**
 * "Send survey" on the profile (fa-web-api #669). Sends the normal survey email
 * to this one alum after a confirm that names who and where it goes. Disabled,
 * with the reason beside it, for people who must not be emailed.
 *
 * Gate the caller on the same `canEdit` as the profile's Edit button — the
 * backend re-enforces `alumni.edit` regardless. The dialog builds its own header
 * (DialogTitle) so there is no icon close button, per the no-icons rule.
 */
export function SendSurveyControl({ preview }: { preview: SurveyOneOffPreview }) {
  const { toast } = useToast();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  // Unique per instance: the profile renders this twice (header row + phone FAB).
  const reasonId = useId();

  const blocked = disabledReason(preview);
  const lastSent = lastSentWarning(preview);
  const replied = lastRepliedNote(preview);
  const sourceNote = emailSourceNote(preview.email_source);

  if (blocked) {
    return (
      <span className="inline-flex items-center gap-2">
        <Button type="button" variant="secondary" disabled aria-describedby={reasonId}>
          {SEND_SURVEY_LABEL}
        </Button>
        <span id={reasonId} className="text-xs text-gray-500">
          {blocked}
        </span>
      </span>
    );
  }

  const onConfirm = () => {
    setError(null);
    startTransition(async () => {
      const res = await sendSurveyOneOff(preview.alumni_id);
      if ("error" in res) {
        setError(res.error);
        toast.error(res.error);
        return;
      }
      setOpen(false);
      toast.success(sentToast(preview.name, res.email));
      router.refresh();
    });
  };

  return (
    <>
      <Button
        type="button"
        variant="secondary"
        onClick={() => {
          setError(null);
          setOpen(true);
        }}
      >
        {SEND_SURVEY_LABEL}
      </Button>
      <Dialog open={open} onOpenChange={(next) => !pending && setOpen(next)}>
        <DialogContent>
          <div className="border-b border-gray-200 px-5 py-4">
            <DialogTitle className="text-sm font-semibold text-gray-900">
              Send the survey to {preview.name}?
            </DialogTitle>
          </div>
          <DialogBody>
            <dl className="space-y-1 text-sm">
              <div className="flex gap-2">
                <dt className="w-16 shrink-0 text-gray-500">To</dt>
                <dd className="font-semibold text-gray-900">{preview.name}</dd>
              </div>
              <div className="flex gap-2">
                <dt className="w-16 shrink-0 text-gray-500">Email</dt>
                <dd className="break-all font-semibold text-gray-900">{preview.email}</dd>
              </div>
            </dl>
            {sourceNote ? <p className="mt-2 text-xs text-gray-500">{sourceNote}</p> : null}
            {lastSent ? (
              <p className="mt-3 rounded-md border border-warning-600/30 bg-warning-50 px-3 py-2 text-sm text-gray-800">
                {lastSent} Send it again?
              </p>
            ) : null}
            {replied ? <p className="mt-2 text-sm text-gray-600">{replied}</p> : null}
            <p className="mt-3 text-sm leading-relaxed text-gray-600">
              Same email and 7-day link as the class send. If they don&apos;t reply,
              reminders go out on day 7 and day 14. Their class&apos;s own survey
              send still goes to them later.
            </p>
            {error ? (
              <p className="mt-3 rounded-md border border-danger-600/30 bg-danger-50 px-3 py-2 text-sm text-danger-600">
                {error}
              </p>
            ) : null}
          </DialogBody>
          <DialogFooter>
            <Button
              type="button"
              variant="secondary"
              onClick={() => setOpen(false)}
              disabled={pending}
            >
              Cancel
            </Button>
            <Button type="button" onClick={onConfirm} disabled={pending}>
              {pending ? "Sending…" : lastSent ? "Send again" : "Send survey"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
