"use client";

import { useState, useTransition } from "react";
import {
  setLinkDigestRecipients,
  type LinkDigestState,
} from "@/app/(app)/engineer/maintenance/actions";
import { useToast } from "@/components/ui/Toast";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  DIGEST_SCHEDULE_NOTE,
  MAX_DIGEST_RECIPIENTS,
  addRecipient,
  digestConfirmation,
  listChanged,
  removeRecipient,
} from "./link-digest-recipients";

/**
 * Who gets the daily job-link digest (#567).
 *
 * When alumni submit job or internship links through the survey, the addresses
 * here get ONE e-mail at about 6pm Mountain, only on days a link came in. The
 * list lives server-side, so changing it needs no redeploy.
 *
 * ⚠️ AN EMPTY LIST IS NOT "OFF". With nobody on it, each new link raises an
 * alert on the engineer channels instead, exactly as before the digest existed,
 * and the card says so. The same is true when the API cannot send mail at all,
 * which is the one warning this card carries.
 *
 * Edit, then Save: the whole list is sent at once, so the server never holds a
 * half-edited list. Text-only buttons, per the project's icon-free convention.
 */
export function LinkDigestControl({ state }: { state: LinkDigestState }) {
  const { toast } = useToast();
  const [pending, startTransition] = useTransition();
  const [saved, setSaved] = useState<string[]>(state.recipients);
  const [edited, setEdited] = useState<string[]>(state.recipients);
  const [typed, setTyped] = useState("");
  const [inputError, setInputError] = useState<string | null>(null);
  const [changed, setChanged] = useState<{ at: string | null; by: string | null }>({
    at: state.updated_at,
    by: state.updated_by_email,
  });
  const dirty = listChanged(saved, edited);

  function add() {
    const result = addRecipient(edited, typed);
    if (!result.ok) {
      setInputError(result.error);
      return;
    }
    setEdited(result.recipients);
    setTyped("");
    setInputError(null);
  }

  function save() {
    if (!dirty || pending) return;
    startTransition(async () => {
      const res = await setLinkDigestRecipients(edited);
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      setSaved(res.state.recipients);
      setEdited(res.state.recipients);
      setChanged({ at: res.state.updated_at, by: res.state.updated_by_email });
      toast.success(digestConfirmation(res.state.recipients));
    });
  }

  return (
    <section aria-labelledby="link-digest-heading">
      <h2
        id="link-digest-heading"
        className="mb-3 text-sm font-semibold text-gray-900"
      >
        Daily job-link digest
      </h2>

      <Card className="p-5">
        <p className="text-sm text-gray-500">{DIGEST_SCHEDULE_NOTE}</p>

        <fieldset disabled={pending} className="mt-4">
          <legend className="sr-only">Digest recipients</legend>

          {edited.length > 0 ? (
            <ul className="divide-y divide-gray-200 rounded-md border border-gray-200">
              {edited.map((address) => (
                <li
                  key={address}
                  className="flex items-center justify-between gap-3 px-3 py-2"
                >
                  <span className="truncate text-sm text-gray-900">{address}</span>
                  <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    onClick={() => setEdited(removeRecipient(edited, address))}
                    aria-label={`Remove ${address}`}
                  >
                    Remove
                  </Button>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-gray-700">
              Nobody is on the list, so each new job link sends an alert to the
              engineer channels instead.
            </p>
          )}

          <div className="mt-3 flex gap-2">
            <Input
              type="email"
              value={typed}
              onChange={(e) => {
                setTyped(e.target.value);
                setInputError(null);
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  add();
                }
              }}
              autoComplete="off"
              spellCheck={false}
              placeholder="name@byu.edu"
              aria-label="Email address to add"
              aria-invalid={inputError ? true : undefined}
              aria-describedby={inputError ? "link-digest-error" : undefined}
            />
            <Button
              type="button"
              variant="secondary"
              onClick={add}
              disabled={edited.length >= MAX_DIGEST_RECIPIENTS}
            >
              Add
            </Button>
          </div>
          {inputError ? (
            <p id="link-digest-error" className="mt-2 text-sm text-danger-600">
              {inputError}
            </p>
          ) : null}

          <div className="mt-4 flex items-center justify-end gap-2">
            {dirty ? (
              <Button
                type="button"
                variant="secondary"
                onClick={() => {
                  setEdited(saved);
                  setInputError(null);
                }}
              >
                Discard changes
              </Button>
            ) : null}
            <Button type="button" onClick={save} disabled={!dirty}>
              {pending ? "Saving…" : "Save"}
            </Button>
          </div>
        </fieldset>

        {!state.email_configured ? (
          <p className="mt-3 text-sm text-warning-600">
            The API has no way to send mail right now, so the digest cannot go
            out and each new link alerts the engineer channels instead. Set{" "}
            <code>RESEND_API_KEY</code> and <code>SURVEY_FROM_EMAIL</code> on the
            API to turn it on.
          </p>
        ) : null}

        {changed.at ? (
          <p className="mt-3 text-sm text-gray-500">
            Last changed {formatChanged(changed.at)}
            {changed.by ? ` by ${changed.by}` : ""}.
          </p>
        ) : null}
      </Card>
    </section>
  );
}

/** Utah time, to the minute — the same clock as the alert-delivery card. */
function formatChanged(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "recently";
  return d.toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "America/Denver",
  });
}
