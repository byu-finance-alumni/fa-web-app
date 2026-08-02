"use client";

import { use, useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import { SAMPLE_ALUM, SAMPLE_ALUM_NAME } from "@/lib/sampleAlumni";
import {
  EditFlow,
  INFO_SECTIONS,
  InvalidPanel,
  ReviewGroup,
  SuccessPanel,
  TrustNote,
  initialsOf,
  type Fields,
} from "@/components/survey/survey-screens";
import type { components } from "@/types/api.gen";

/**
 * PUBLIC "confirm your info" survey landing page.
 *
 * The signed token in the URL resolves (via public `GET /survey/respond/{token}`)
 * to the alum's REAL on-file info. Review shows the full field list; "I need to
 * make changes" opens a section menu (Employment / Residence / Personal / …) the
 * alum drills into. `demo` shows the sample alum.
 *
 * This file owns only the DATA: resolving the token, staging the response, and
 * uploading the photo. Every screen comes from
 * `components/survey/survey-screens`, which the staff "Sample survey" preview
 * renders too — that shared view layer is what keeps the preview honest (#574).
 *
 * NOTE: submitting stages the response for staff review — it does not apply to
 * the record directly (that's the admin's confirm step).
 */

type Status = "review" | "confirmed" | "editing" | "submitted";
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

  // Stage the alum's edits for admin review (public, token-gated POST). If a new
  // profile photo was chosen, upload it as a SECOND token-gated step keyed to the
  // returned response id — a photo failure never loses the field submission.
  const handleSubmit = async () => {
    if (token === "demo") {
      setStatus("submitted");
      return;
    }
    setSubmitting(true);
    setSubmitError(null);
    setPhotoFailed(false);
    try {
      const res = await fetch(
        `${API_URL}/survey/respond/${encodeURIComponent(token)}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          // Flag a photo-only submission so the backend still creates a response
          // row (and returns its id) even when `fields` is empty (#537).
          body: JSON.stringify({ fields: edits, has_photo: photoFile != null }),
        },
      );
      if (!res.ok) throw new Error(String(res.status));
      const result = (await res.json()) as SubmitResult;
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
    <main className="min-h-screen bg-white text-gray-900">
      <header className="bg-navy-800">
        <div className="flex h-16 items-center px-5 sm:px-8">
          <span className="text-base font-semibold text-white sm:text-lg">
            BYU Finance Alumni Update
          </span>
        </div>
      </header>

      <div className="mx-auto max-w-[800px] px-5 pb-16 pt-10 sm:px-8">
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
            body={
              photoFailed
                ? "Our team will review your response before any changes are applied to your record. We couldn't upload your new photo this time, but the rest of your updates were received. You can safely close this page."
                : "Our team will review your response before any changes are applied to your record. You can safely close this page."
            }
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
          <EditFlow
            firstName={firstName}
            name={name}
            valueOf={valueOf}
            setEdit={setEdit}
            openSection={openSection}
            openSectionNav={openSectionNav}
            closeSectionNav={closeSectionNav}
            photoPreview={photoPreview}
            setPhotoPreview={setPhotoPreview}
            setPhotoFile={setPhotoFile}
            onBack={() => setStatus("review")}
            onSubmit={handleSubmit}
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
              <div className="grid gap-x-8 gap-y-5 px-5 py-5 sm:grid-cols-2 sm:px-6">
                {INFO_SECTIONS.map((s) => (
                  <ReviewGroup key={s.id} section={s} fields={fields} />
                ))}
              </div>
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

        <footer className="mt-12 text-center">
          <p className="text-xs text-gray-400">BYU Marriott School of Business</p>
        </footer>
      </div>
    </main>
  );
}
