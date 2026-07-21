"use client";

import { useEffect, useState } from "react";
import { Mail, RotateCcw } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogFooter,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { SAMPLE_ALUM_NAME } from "@/lib/sampleAlumni";
import {
  DEFAULT_SURVEY_MESSAGE,
  loadMessage,
  saveMessage,
} from "@/lib/surveyStore";

/**
 * "Edit email message" — a dedicated button (beside the Sample survey button) to
 * compose the note shown at the top of the survey email AND the alum's public
 * confirm-your-info page. Persisted to `localStorage` (the same message the
 * Sample survey preview and the public `/survey/[token]` page read); frontend
 * only, no send. The alum's name is prepended automatically ("Hi {name}, …").
 */
export function SurveyMessageEditor() {
  const [open, setOpen] = useState(false);
  const [message, setMessage] = useState(DEFAULT_SURVEY_MESSAGE);
  // localStorage is only touched in effects (SSR-safe hydration).
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    setMessage(loadMessage());
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    saveMessage(message);
  }, [message, hydrated]);

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
          className="max-w-xl"
          title="Email message"
          description="The note shown at the top of the survey email and the alum's confirm-your-info page. Saved on this device."
        >
          <DialogBody className="space-y-4">
            <div>
              <Label htmlFor="email-message">Message</Label>
              <p className="mt-0.5 text-xs text-gray-500">
                Write whatever you want to say. The alum&apos;s name is added
                automatically at the start.
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

            {/* Live preview of the intro block exactly as the alum sees it. */}
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-gray-400">
                Preview
              </p>
              <div className="mt-1 rounded-md border border-brand-blue-300/50 bg-brand-blue-50 px-4 py-3">
                <p className="text-xs font-semibold uppercase tracking-wide text-navy-800">
                  BYU Finance Alumni
                </p>
                <p className="mt-1 whitespace-pre-wrap text-sm text-gray-700">
                  Hi {SAMPLE_ALUM_NAME}, {message.trim() || DEFAULT_SURVEY_MESSAGE}
                </p>
              </div>
            </div>
          </DialogBody>

          <DialogFooter className="justify-between">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => setMessage(DEFAULT_SURVEY_MESSAGE)}
            >
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
