"use client";

import { use, useEffect, useState } from "react";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";
import { SAMPLE_ALUM, SAMPLE_ALUM_NAME } from "@/lib/sampleAlumni";
import {
  emptyLinkEntry,
  linkSubmitErrorMessage,
  linksToSubmit,
  type LinkEntry,
} from "@/lib/opportunityLinks";
import {
  EditFlow,
  INFO_SECTIONS,
  InvalidPanel,
  ReviewSections,
  SuccessPanel,
  TrustNote,
  WaysToHelp,
  initialsOf,
  type Fields,
} from "@/components/survey/survey-screens";
import { SurveyPageShell } from "@/components/survey/SurveyPageShell";
import {
  confirmErrorMessage,
  confirmOnlyBody,
  isDeadTokenStatus,
  waysToHelpHref,
} from "@/lib/surveyConfirm";
import { editSubmitBody } from "@/lib/surveyWaysToHelp";
import type { components } from "@/types/api.gen";

/**
 * PUBLIC "confirm your info" survey landing page.
 *
 * The signed token in the URL resolves (via public `GET /survey/respond/{token}`)
 * to the alum's REAL on-file info. Review shows the full field list; "I need to
 * make changes" opens a section menu (Employment / Personal / …) the
 * alum drills into, and Continue there leads to the ways-to-help step every
 * alum now ends on (#773). `demo` shows the sample alum.
 *
 * This file owns only the DATA: resolving the token, staging the response, and
 * uploading the photo. Every screen comes from
 * `components/survey/survey-screens`, which the staff "Sample survey" preview
 * renders too — that shared view layer is what keeps the preview honest (#574).
 *
 * NOTE: submitting stages the response for staff review — it does not apply to
 * the record directly (that's the admin's confirm step).
 */

/**
 * ⚠️ There is deliberately no `"confirmed"` state any more (#755).
 *
 * It used to exist and to record NOTHING: "Yes, everything is correct" flipped
 * a local state flag, sent no request at all, and rendered a panel whose only
 * control was "I need to make changes". Confirming now POSTs
 * (`confirmed_only`) and then NAVIGATES to `/survey/{token}/help`, so the
 * confirmation is a row in the database and the alum is asked to help rather
 * than shown a wall. If you find yourself re-adding a local "confirmed" screen,
 * you are re-adding the dead end.
 *
 * `"helping"` is the EDIT branch's version of that same ending (#773): the
 * involvement questions and the jobs/internships form, shown to everyone who
 * makes changes, because those two asks are only CHOICES in the section menu
 * and an alum who opened Employment to fix their employer never met either one.
 *
 * ⚠️ It is a state here rather than a route push to `/survey/{token}/help`, and
 * that is the no-duplicate-rows decision, not a shortcut. The help ROUTE fetches
 * the record fresh and posts its own answers — fine on the confirm branch, where
 * the backend upgrades the confirmation row in place. On this branch a second
 * POST would stage a SECOND pending row beside the submission (that is what the
 * backend does with two real submissions on one token, deliberately). Staying on
 * this page keeps the edits and the involvement answers in ONE `edits` map and
 * sends them in ONE body — and it is also what pre-fills the questions for an
 * alum who already answered them in the section menu, which a fresh fetch of
 * the record could not do, because their answers are staged and not applied yet.
 */
type Status = "review" | "editing" | "helping" | "submitted";
type LoadState = "loading" | "ready" | "invalid";
type Respondent = components["schemas"]["SurveyRespondInfo"];
type SubmitResult = components["schemas"]["SurveySubmitResult"];

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "";

export default function SurveyConfirmPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = use(params);
  const router = useRouter();

  const [loadState, setLoadState] = useState<LoadState>("loading");
  const [name, setName] = useState("");
  const [firstName, setFirstName] = useState("");
  const [fields, setFields] = useState<Fields>({});
  const [status, setStatus] = useState<Status>("review");
  const [openSection, setOpenSection] = useState<string | null>(null);
  const [edits, setEdits] = useState<Fields>({});
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  // The actual File the alum chose, kept so it can be UPLOADED (the preview is
  // just an object URL). Sent as a separate token-gated step after the fields.
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [photoFailed, setPhotoFailed] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  // The confirmation POST (#755), tracked separately from `submitting` because
  // it belongs to a different screen and a different request.
  const [confirming, setConfirming] = useState(false);
  const [confirmError, setConfirmError] = useState<string | null>(null);

  // Opportunity links (#441). One blank entry to start, so opening the section
  // shows a form rather than an empty page with a button on it; a blank entry
  // submits nothing, so an alum who looks and backs out sends nothing.
  const [links, setLinks] = useState<LinkEntry[]>(() => [emptyLinkEntry()]);
  // Which steps have already landed, so pressing Submit again after a failure
  // RETRIES only what failed. Without this, a links failure the alum fixes and
  // resubmits would stage their field response a second time — two pending rows
  // for one submission, and the response queue is all-or-nothing per row, so a
  // reviewer would apply the same change twice.
  const [fieldsStaged, setFieldsStaged] = useState(false);
  const [linksStaged, setLinksStaged] = useState(false);
  // How many links went with the submission, so the thank-you screen can say
  // what happens to them next. They are staged PENDING like everything else
  // here — the alum is never told they are live.
  const [linkCount, setLinkCount] = useState(0);

  // `?step=edit` opens straight on the section menu — the screen an alum reaches
  // by pressing "I need to make changes". Staff previewing the survey want to
  // look at the editable form, and making them click through the review panel
  // first to get there is friction for no reason.
  //
  // DEMO ONLY, deliberately. A real alum must meet the review panel first: it is
  // where they are told what we hold and that a human checks the answer, and
  // skipping it would also let a forwarded link land someone straight in a form
  // over another person's record.
  useEffect(() => {
    if (token !== "demo") return;
    const step = new URLSearchParams(window.location.search).get("step");
    if (step === "edit") setStatus("editing");
  }, [token]);

  useEffect(() => {
    if (token === "demo") {
      setName(SAMPLE_ALUM_NAME);
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
        setName(data.full_name);
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
  // The record as it arrived, with no edit folded over it. The controlled
  // vocabularies need it to tell "the odd industry already on your record" from
  // "something you just typed that we can't save" (#426) — see `isValueOnFile`.
  const onFileValueOf = (key: string) => fields[key] ?? "";
  const setEdit = (key: string, value: string) =>
    setEdits((prev) => ({ ...prev, [key]: value }));

  // Browser/device Back closes an open section instead of leaving the page
  // (#526). Opening a section pushes a history entry; a Back press (or the
  // in-page Done / "All sections" buttons, which call `history.back()`) pops it
  // and the popstate handler returns to the section menu. Push/pop stay balanced
  // so exactly one Back is consumed per open section.
  const openSectionNav = (id: string) => {
    if (typeof window !== "undefined") {
      window.history.pushState({ surveySection: id }, "");
    }
    setOpenSection(id);
  };
  const closeSectionNav = () => {
    if (typeof window !== "undefined") {
      window.history.back();
    } else {
      setOpenSection(null);
    }
  };
  useEffect(() => {
    const onPop = () => setOpenSection(null);
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, []);

  // Stage the alum's edits for admin review (public, token-gated POST). Called
  // from the ways-to-help step (#773), not from the section menu: the menu's
  // Continue advances to that step and this runs when the alum presses the
  // button there, so `edits` carries their profile changes AND anything they
  // answered on it, in ONE body and therefore ONE response row. See
  // `editSubmitBody` for why a second POST is not an option here.
  //
  // If a new profile photo was chosen, upload it as a SECOND token-gated step
  // keyed to the returned response id — a photo failure never loses the field
  // submission.
  //
  // Opportunity links are a THIRD call (#441), to their own endpoint, because
  // they are rows in their own table with their own moderation queue rather than
  // `table.column` answers the response pipeline can carry.
  //
  // ORDER IS DELIBERATE: fields, then photo, then links. The fields are what the
  // alum was asked here to do, so an optional extra failing — a rate limit, a
  // rejected url — must never cost them the corrections they came to make. Each
  // step records that it landed, so pressing Submit again after a failure
  // retries ONLY what failed.
  // "Yes, everything is correct" (#755). It used to set a local status flag and
  // nothing else — a client-side flip that recorded nothing — and it now
  // RECORDS the confirmation before taking the alum to the ways-to-help page.
  //
  // Sent as a bare `confirmed_only` body with NO fields and NO photo, because
  // the backend ignores that flag whenever the body carries content: a
  // confirmation folded in with anything else is silently filed as an ordinary
  // staged response instead. Involvement answers therefore go as a second,
  // ordinary POST from the ways-to-help page.
  //
  // FAILURE IS NEVER SWALLOWED and never dressed up as success. The alum stays
  // on this screen, with their information still in front of them and the
  // reason under the buttons, and can press again — "I need to make changes"
  // never depended on this request, so there is always a way forward. A dead
  // token is the one unretryable case: nothing about it improves on a second
  // press, so it shows `InvalidPanel` instead of a message to keep pressing.
  const handleConfirm = async () => {
    if (token === "demo") {
      router.push(waysToHelpHref(token));
      return;
    }
    setConfirming(true);
    setConfirmError(null);
    let status: number | null = null;
    try {
      const res = await fetch(
        `${API_URL}/survey/respond/${encodeURIComponent(token)}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(confirmOnlyBody()),
        },
      );
      status = res.status;
    } catch {
      // Network/CORS failure — no status to reason about.
      status = null;
    }
    if (status !== null && status >= 200 && status < 300) {
      // `confirming` stays true on purpose: the navigation is in flight and the
      // buttons must not go live again underneath it.
      router.push(waysToHelpHref(token));
      return;
    }
    setConfirming(false);
    if (isDeadTokenStatus(status)) {
      setLoadState("invalid");
      return;
    }
    setConfirmError(confirmErrorMessage(status));
  };

  const handleSubmit = async () => {
    if (token === "demo") {
      setStatus("submitted");
      return;
    }
    setSubmitting(true);
    setSubmitError(null);
    try {
      if (!fieldsStaged) {
        // Reset INSIDE the guard: on a links-only retry the photo step doesn't
        // run again, so clearing this would lose the "we couldn't upload your
        // photo" warning the first pass earned.
        setPhotoFailed(false);
        const res = await fetch(
          `${API_URL}/survey/respond/${encodeURIComponent(token)}`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            // `has_photo` flags a photo-only submission so the backend still
            // creates a response row (and returns its id) even when `fields` is
            // empty (#537).
            body: JSON.stringify(editSubmitBody(edits, photoFile != null)),
          },
        );
        if (!res.ok) throw new Error(String(res.status));
        const result = (await res.json()) as SubmitResult;
        setFieldsStaged(true);
        // Fields are safely staged. Attach the photo if one was picked; surface a
        // soft warning on failure but still treat the submission as successful.
        if (photoFile && result.survey_response_id != null) {
          try {
            const form = new FormData();
            form.append("survey_response_id", String(result.survey_response_id));
            form.append("photo", photoFile);
            const photoRes = await fetch(
              `${API_URL}/survey/respond/${encodeURIComponent(token)}/photo`,
              { method: "POST", body: form },
            );
            if (!photoRes.ok) setPhotoFailed(true);
          } catch {
            setPhotoFailed(true);
          }
        }
      }

      // Blank entries are dropped, so an alum who never opened the section sends
      // nothing — and must not, since the body requires at least one link.
      const linkPayload = linksToSubmit(links);
      if (linkPayload.length > 0 && !linksStaged) {
        // The batch is all-or-nothing server-side: one bad value is a 422 for
        // the whole call and NOTHING is staged. So a failure here is reported
        // as a thing to fix and retry, on the form, rather than folded into the
        // thank-you screen as a soft warning the way a failed photo is — the
        // alum can act on it, and the entries are still on screen to act on.
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
          // Network/CORS failure — no status to reason about.
          status = null;
        }
        if (status === null || status < 200 || status >= 300) {
          setSubmitError(linkSubmitErrorMessage(status));
          return;
        }
      }
      setLinkCount(linkPayload.length);
      setStatus("submitted");
    } catch {
      setSubmitError(
        "Something went wrong submitting your updates. Please try again.",
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    /* The masthead, the reading column and the sign-off all come from the shell
       (#756), so every state below — loading, invalid, review, editing,
       helping, submitted — is framed identically, and the ways-to-help page
       (#755) wears the same one. */
    <SurveyPageShell>
      {loadState === "loading" ? (
        <div className="space-y-4">
          <div className="h-9 w-2/3 animate-pulse rounded bg-gray-100" />
          <div className="h-48 animate-pulse rounded-lg bg-gray-100" />
        </div>
      ) : loadState === "invalid" ? (
        <InvalidPanel />
      ) : status === "submitted" ? (
        <SuccessPanel
          title="Thank you — your updates are in"
          body={[
            "Our team will review your response before any changes are applied to your record.",
            photoFailed
              ? "We couldn't upload your new photo this time, but the rest of your updates were received."
              : null,
            linkCount > 0
              ? `We've also received the ${linkCount === 1 ? "opportunity" : `${linkCount} opportunities`} you shared — our team checks each one before passing it on to students.`
              : null,
            "You can safely close this page.",
          ]
            .filter(Boolean)
            .join(" ")}
        />
      ) : status === "helping" ? (
        /* The EDIT branch's ending (#773) — the same screen, the same question
           list and the same links form the confirm branch reaches at
           `/survey/{token}/help`, in `edited` mode because nothing has been sent
           yet and the copy has to say so.

           `valueOf` and `setEdit` are the SAME pair the edit flow was given, so
           an alum who opened "Ways to get involved" in the section menu finds
           their answers already filled in here rather than a blank form that
           reads as though their edits were thrown away — and whatever they add
           lands in the same `edits` map, which is what makes the submission one
           request. `links` is shared for the same reason: entries added in the
           "Jobs & internships" section are still here, and go out in the one
           links call `handleSubmit` already makes. */
        <WaysToHelp
          firstName={firstName}
          mode="edited"
          valueOf={valueOf}
          setEdit={setEdit}
          links={links}
          setLinks={setLinks}
          // Back to the section menu they came from, with everything they typed
          // still in it — not to the review screen, which would make an alum
          // with one more change to make walk the whole fork again.
          onNeedChanges={() => {
            setOpenSection(null);
            setStatus("editing");
          }}
          onSubmit={handleSubmit}
          submitting={submitting}
          submitError={submitError}
        />
      ) : status === "editing" ? (
        <EditFlow
          firstName={firstName}
          name={name}
          valueOf={valueOf}
          onFileValueOf={onFileValueOf}
          setEdit={setEdit}
          openSection={openSection}
          openSectionNav={openSectionNav}
          closeSectionNav={closeSectionNav}
          photoPreview={photoPreview}
          setPhotoPreview={setPhotoPreview}
          setPhotoFile={setPhotoFile}
          links={links}
          setLinks={setLinks}
          onBack={() => setStatus("review")}
          // Continue, not submit (#773). Everything the alum typed is valid, so
          // take them to the ways-to-help step; `handleSubmit` runs from there,
          // once, with the edits and the involvement answers in one body.
          onSubmit={() => setStatus("helping")}
          submitting={submitting}
          submitError={submitError}
        />
      ) : (
        /* review */
        <>
          <div>
            <div className="flex items-center gap-4">
              <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-navy-800 text-base font-semibold text-white">
                {initialsOf(name)}
              </span>
              <div className="min-w-0">
                <h1 className="text-3xl font-semibold leading-tight tracking-tight text-navy-800">
                  Hi, {firstName}
                </h1>
                <p className="mt-1 truncate text-sm text-gray-500">
                  {name} · BYU Finance · Marriott School of Business
                </p>
              </div>
            </div>
            <p className="mt-4 max-w-prose text-base leading-relaxed text-gray-600">
              Please review the information we currently have on file. This
              should take less than a minute.
            </p>
          </div>

          <section
            className="mt-8 rounded-lg border border-gray-200"
            aria-labelledby="your-info-heading"
          >
            <div className="border-b border-gray-200 px-5 py-3 sm:px-6">
              <h2 id="your-info-heading" className="text-sm font-semibold text-gray-900">
                Your information
              </h2>
            </div>
            <ReviewSections
              sections={INFO_SECTIONS}
              fields={fields}
              className="sm:px-6"
            />
          </section>

          <div className="mt-8">
            <p className="text-base font-medium text-gray-900">
              Is this information correct?
            </p>
            <div className="mt-4 flex flex-col gap-3 sm:flex-row">
              <Button
                type="button"
                variant="navy"
                size="lg"
                className="w-full sm:w-auto"
                onClick={handleConfirm}
                disabled={confirming}
              >
                {confirming ? "Confirming…" : "Yes, everything is correct"}
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
                disabled={confirming}
              >
                I need to make changes
              </Button>
            </div>
            {confirmError ? (
              <p role="alert" className="mt-4 text-sm text-danger-600">
                {confirmError}
              </p>
            ) : null}
          </div>

          <TrustNote />
        </>
      )}
    </SurveyPageShell>
  );
}
