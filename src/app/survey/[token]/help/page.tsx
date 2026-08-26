"use client";

import { use, useEffect, useState } from "react";
import { useRouter } from "next/navigation";

import { SAMPLE_ALUM, SAMPLE_ALUM_NAME } from "@/lib/sampleAlumni";
import {
  emptyLinkEntry,
  linkSubmitErrorMessage,
  linksToSubmit,
  type LinkEntry,
} from "@/lib/opportunityLinks";
import {
  answeredFields,
  surveyReviewHref,
  waysToHelpThanksBody,
} from "@/lib/surveyConfirm";
import {
  InvalidPanel,
  SuccessPanel,
  WAYS_TO_HELP_FIELD_KEYS,
  WaysToHelp,
  type Fields,
} from "@/components/survey/survey-screens";
import { SurveyPageShell } from "@/components/survey/SurveyPageShell";
import type { components } from "@/types/api.gen";

/**
 * PUBLIC "ways to help" page — where "Yes, everything is correct" now lands
 * (#755).
 *
 * Confirming used to be a client-side state flip onto a panel whose only
 * control was "I need to make changes": it recorded nothing, and it never asked
 * for anything. Both of the survey's asks — mentoring/speaking/hosting, and
 * jobs & internships — sat inside the EDIT flow, so the alumni with nothing to
 * correct were the only ones never asked to help. The confirmation itself is
 * POSTed by the review page before it sends anyone here, so by the time this
 * page renders the confirmation is already recorded: everything on it is
 * optional extra, and Submit works with the whole page untouched.
 *
 * ⚠️ PUBLIC. `/survey/*` skips authentication entirely (`isNoAuthPath` in the
 * root middleware) — the visitor is a stranger holding a signed token, not a
 * signed-in user. Nothing auth-dependent may be imported here or into anything
 * it renders: no supabase client, no session, no user, no nav model. Check
 * transitively before adding an import.
 *
 * Its own route rather than another state on `/survey/{token}` on purpose: a
 * reload does not re-post the confirmation, Back returns to the review screen
 * the alum came from, and the screen that must not edit fields cannot reach the
 * edit flow's machinery by accident.
 *
 * Field values come from the same public `GET /survey/respond/{token}` the
 * review page reads, so the involvement questions arrive pre-filled with
 * whatever we already hold — an alum who said yes to mentoring last year sees
 * "Yes" rather than a blank they have to answer again.
 */

type LoadState = "loading" | "ready" | "invalid";
type Respondent = components["schemas"]["SurveyRespondInfo"];

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "";

export default function SurveyWaysToHelpPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = use(params);
  const router = useRouter();

  const [loadState, setLoadState] = useState<LoadState>("loading");
  const [firstName, setFirstName] = useState("");
  const [fields, setFields] = useState<Fields>({});
  const [edits, setEdits] = useState<Fields>({});
  const [links, setLinks] = useState<LinkEntry[]>(() => [emptyLinkEntry()]);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  // What actually went with the submission, so the thank-you screen can say
  // what happened instead of claiming updates are in when nothing was sent.
  const [answerCount, setAnswerCount] = useState(0);
  const [linkCount, setLinkCount] = useState(0);
  // Which steps have already landed, so pressing Submit again after a links
  // failure retries ONLY the links. Without it, a retry would stage the
  // involvement answers a second time and leave a reviewer two pending rows for
  // one submission — the same guard the edit flow carries, for the same reason.
  const [fieldsStaged, setFieldsStaged] = useState(false);
  const [linksStaged, setLinksStaged] = useState(false);

  useEffect(() => {
    if (token === "demo") {
      setFirstName(SAMPLE_ALUM_NAME.split(/\s+/)[0] || SAMPLE_ALUM_NAME);
      setFields(SAMPLE_ALUM);
      setLoadState("ready");
      return;
    }
    let cancelled = false;
    fetch(`${API_URL}/survey/respond/${encodeURIComponent(token)}`, {
      cache: "no-store",
    })
      .then(async (res) => {
        if (!res.ok) throw new Error(String(res.status));
        return (await res.json()) as Respondent;
      })
      .then((data) => {
        if (cancelled) return;
        setFirstName(data.first_name);
        setFields(data.fields ?? {});
        setLoadState("ready");
      })
      .catch(() => {
        if (!cancelled) setLoadState("invalid");
      });
    return () => {
      cancelled = true;
    };
  }, [token]);

  const valueOf = (key: string) => edits[key] ?? fields[key] ?? "";
  const setEdit = (key: string, value: string) =>
    setEdits((prev) => ({ ...prev, [key]: value }));

  /**
   * Send whatever the alum chose to add.
   *
   * An ORDINARY submit, carrying no confirmation flag: the confirmation was
   * recorded by the review page before they got here, and the backend ignores
   * that flag on a body carrying content anyway. Involvement answers are plain
   * survey fields; opportunity links are rows in their own table with their own
   * moderation queue, so they go to their own endpoint, second.
   *
   * Both halves are optional and BOTH MAY BE EMPTY. An alum who reads the page
   * and adds nothing presses the same button and reaches the same thank-you
   * screen — their confirmation already counted, so there is nothing to gate
   * the button on, and posting an empty body would only stage a response row
   * with no changes in it for a reviewer to open and close again.
   */
  const handleSubmit = async () => {
    const payload = answeredFields(edits, WAYS_TO_HELP_FIELD_KEYS);
    const linkPayload = linksToSubmit(links);
    const answers = Object.keys(payload).length;

    if (token === "demo") {
      setAnswerCount(answers);
      setLinkCount(linkPayload.length);
      setDone(true);
      return;
    }

    setSubmitting(true);
    setSubmitError(null);
    try {
      if (answers > 0 && !fieldsStaged) {
        const res = await fetch(
          `${API_URL}/survey/respond/${encodeURIComponent(token)}`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ fields: payload, has_photo: false }),
          },
        );
        if (!res.ok) throw new Error(String(res.status));
        setFieldsStaged(true);
      }

      if (linkPayload.length > 0 && !linksStaged) {
        // All-or-nothing server-side, so a failure here is a thing to fix and
        // retry on the form rather than a footnote on a success screen — the
        // entries are still on screen to act on.
        let status: number | null = null;
        try {
          const res = await fetch(
            `${API_URL}/survey/respond/${encodeURIComponent(token)}/links`,
            {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ links: linkPayload }),
            },
          );
          status = res.status;
          if (res.ok) setLinksStaged(true);
        } catch {
          status = null;
        }
        if (status === null || status < 200 || status >= 300) {
          setSubmitError(linkSubmitErrorMessage(status));
          return;
        }
      }

      setAnswerCount(answers);
      setLinkCount(linkPayload.length);
      setDone(true);
    } catch {
      setSubmitError(
        "Something went wrong sending your answers. Please try again.",
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    /* The masthead, the reading column and the sign-off all come from the shell
       (#756) — the same one every survey screen wears, so confirming does not
       hand the alum a page that looks like a different site. Do not add a
       second main element, a second wrapper column, a second footer, or ANY
       full-width element between the photo and the content here: a pale band in
       that gap has come back four times on the app side. */
    <SurveyPageShell>
      {loadState === "loading" ? (
        <div className="space-y-4">
          <div className="h-9 w-2/3 animate-pulse rounded bg-gray-100" />
          <div className="h-48 animate-pulse rounded-lg bg-gray-100" />
        </div>
      ) : loadState === "invalid" ? (
        <InvalidPanel />
      ) : done ? (
        <SuccessPanel
          title={`Thank you, ${firstName}`}
          body={waysToHelpThanksBody({ answerCount, linkCount })}
        />
      ) : (
        <WaysToHelp
          firstName={firstName}
          valueOf={valueOf}
          setEdit={setEdit}
          links={links}
          setLinks={setLinks}
          // Back to REVIEW, not straight into the form: `?step=edit` is
          // demo-only by design, and the review panel is where an alum is told
          // what we hold before they change it. "I need to make changes" is the
          // second control on that screen, so the way out stays one screen away
          // rather than shut.
          onNeedChanges={() => router.push(surveyReviewHref(token))}
          onSubmit={handleSubmit}
          submitting={submitting}
          submitError={submitError}
        />
      )}
    </SurveyPageShell>
  );
}
