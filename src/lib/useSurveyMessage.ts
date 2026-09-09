"use client";

import { useCallback, useEffect, useState } from "react";

import {
  ApiClientError,
  clientGet,
  clientPost,
  clientPutJson,
} from "@/lib/api-client";
import {
  SURVEY_MESSAGE_PATH,
  SURVEY_MESSAGE_RESET_PATH,
  surveyMessageError,
  type SurveyMessageRead,
  type SurveyMessageUpdate,
} from "@/lib/surveyMessage";

/** Reading the one stored message: in flight, loaded, or failed with a reason. */
export type SurveyMessageState =
  | { status: "loading" }
  | { status: "ready"; message: SurveyMessageRead }
  | { status: "error"; error: string; forbidden: boolean };

/** A write's outcome. `forbidden` lets the caller drop to read-only, not error. */
export type SurveyMessageWriteResult =
  | { ok: true; message: SurveyMessageRead }
  | { ok: false; error: string; forbidden: boolean };

export interface UseSurveyMessage {
  state: SurveyMessageState;
  /** Re-read from the server (after a failure, or to pick up someone's edit). */
  reload: () => void;
  /** `PUT` the draft. Resolves with what the server actually stored. */
  save: (draft: SurveyMessageUpdate) => Promise<SurveyMessageWriteResult>;
  /** `POST /survey/message/reset` — restore the backend's built-in wording. */
  reset: () => Promise<SurveyMessageWriteResult>;
  /** True while a save or reset is in flight. */
  writing: boolean;
}

/**
 * The survey email copy, read from and written to the backend (#524).
 *
 * Shared by the two surfaces that show this text — the "Edit email message"
 * dialog and the sample-survey preview — so they cannot disagree about what
 * alumni are sent. Each one reads on mount; there is deliberately no cache
 * between them, because a stale copy shown as "what is live" is the whole bug
 * this issue exists to fix.
 *
 * Browser-side rather than a server action for the same reason the rest of the
 * needs-surveying console is: these panels hold unsaved drafts, and a route
 * revalidation re-rendering them underneath the person typing would throw the
 * draft away.
 */
export function useSurveyMessage(): UseSurveyMessage {
  const [state, setState] = useState<SurveyMessageState>({ status: "loading" });
  const [writing, setWriting] = useState(false);

  const reload = useCallback(() => {
    let cancelled = false;
    setState({ status: "loading" });
    void clientGet<SurveyMessageRead>(SURVEY_MESSAGE_PATH)
      .then((message) => {
        if (!cancelled) setState({ status: "ready", message });
      })
      .catch((e: unknown) => {
        if (cancelled) return;
        const status = e instanceof ApiClientError ? e.status : null;
        setState({
          status: "error",
          error: surveyMessageError(status, "load"),
          forbidden: status === 403,
        });
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => reload(), [reload]);

  const write = useCallback(
    async (
      request: () => Promise<SurveyMessageRead>,
      action: "save" | "reset",
    ): Promise<SurveyMessageWriteResult> => {
      setWriting(true);
      try {
        const message = await request();
        // The server's copy of the row, not the one we sent: the two differ on
        // updated_at / updated_by_email, and on anything the backend normalized.
        setState({ status: "ready", message });
        return { ok: true, message };
      } catch (e: unknown) {
        const status = e instanceof ApiClientError ? e.status : null;
        return {
          ok: false,
          error: surveyMessageError(status, action),
          forbidden: status === 403,
        };
      } finally {
        setWriting(false);
      }
    },
    [],
  );

  const save = useCallback(
    (draft: SurveyMessageUpdate) =>
      write(
        () => clientPutJson<SurveyMessageRead>(SURVEY_MESSAGE_PATH, draft),
        "save",
      ),
    [write],
  );

  const reset = useCallback(
    () =>
      write(
        () => clientPost<SurveyMessageRead>(SURVEY_MESSAGE_RESET_PATH),
        "reset",
      ),
    [write],
  );

  return { state, reload, save, reset, writing };
}
