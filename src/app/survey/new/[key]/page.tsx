"use client";

import { use, useEffect, useMemo, useState } from "react";

import { SurveyPageShell } from "@/components/survey/SurveyPageShell";
import { SurveyContactLink } from "@/components/survey/SurveyContactLink";
import { SuccessPanel, type EditField, type Fields } from "@/components/survey/survey-screens";
import {
  NewPeopleClosedPanel,
  NewPeopleHoneypot,
  NewPeopleIntro,
  NewPeopleKindPicker,
  NewPeopleLoadFailedPanel,
  NewPeopleWizardPage,
} from "@/components/survey/new-people-screens";
import {
  buildSubmitBody,
  effectiveRequiredGroups,
  missingKeysFromError,
  pageIndexOfKey,
  pageSequence,
  requiredGroupsFor,
  submitErrorMessage,
  validatePage,
  withRequiredMarkers,
} from "@/lib/newPeopleSurvey";
import { useActiveTimer } from "@/lib/surveyActiveTime";
import type {
  NewPeopleSurveyInfo,
  NewPersonKind,
} from "@/types/new-people-survey";

/**
 * PUBLIC "new people" survey (api#661): ONE shared link staff email to alumni
 * and professionals who are not in the database yet.
 *
 * Intro → "BYU Alumni Professional" / "Non-BYU Alumni Professional" → one
 * section per page with Back/Next → thank you. Nothing is added to the database
 * on submit: answers wait in the staff "New people" queue.
 *
 * Public and unauthenticated (`/survey/*` skips auth in the proxy). Never import
 * auth or session code here. The key in the URL is the shared link's secret; a
 * wrong, reissued or switched-off key is a 404 and reads "This survey link is
 * closed."
 *
 * Which fields are required comes from the GET, never from this file: the
 * server's `required_fields`, plus Employment state when the employment country
 * is in the server's `state_required_countries`.
 */
type LoadState = "loading" | "ready" | "closed" | "failed";
type Step = "intro" | "kind" | "wizard" | "submitted";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "";

function loadSupportContact(
  set: (c: NewPeopleSurveyInfo["support_contact"]) => void,
) {
  fetch(`${API_URL}/survey/contact`, { cache: "no-store" })
    .then((res) => (res.ok ? res.json() : null))
    .then((c) => set(c ?? null))
    .catch(() => {});
}

export default function NewPeopleSurveyPage({
  params,
}: {
  params: Promise<{ key: string }>;
}) {
  const { key } = use(params);
  const getFillSeconds = useActiveTimer();

  const [loadState, setLoadState] = useState<LoadState>("loading");
  const [info, setInfo] = useState<NewPeopleSurveyInfo | null>(null);
  const [step, setStep] = useState<Step>("intro");
  const [kind, setKind] = useState<NewPersonKind>("alum");
  const [pageIndex, setPageIndex] = useState(0);
  const [values, setValues] = useState<Fields>({});
  const [comments, setComments] = useState("");
  const [website, setWebsite] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  // A closed link has no payload to carry the support contact, so it is read
  // from the survey's public contact route instead (the same one the demo survey
  // uses). Best-effort: a failure just leaves the contact line out.
  const [closedContact, setClosedContact] =
    useState<NewPeopleSurveyInfo["support_contact"]>(null);

  useEffect(() => {
    let cancelled = false;
    fetch(`${API_URL}/survey/new/${encodeURIComponent(key)}`, { cache: "no-store" })
      .then(async (res) => {
        if (cancelled) return;
        if (res.status === 404) {
          setLoadState("closed");
          loadSupportContact(setClosedContact);
          return;
        }
        if (!res.ok) throw new Error(String(res.status));
        setInfo((await res.json()) as NewPeopleSurveyInfo);
        setLoadState("ready");
      })
      .catch(() => {
        if (!cancelled) setLoadState("failed");
      });
    return () => {
      cancelled = true;
    };
  }, [key]);

  const pages = useMemo(() => pageSequence(kind), [kind]);
  const serverGroups = useMemo(
    () => requiredGroupsFor(info?.required_fields, kind),
    [info, kind],
  );
  // Plus State when the employment country is the US (the server's list).
  const groups = useMemo(
    () => effectiveRequiredGroups(serverGroups, values, info?.state_required_countries),
    [serverGroups, values, info],
  );
  const page = pages[Math.min(pageIndex, pages.length - 1)];
  const pageFields = useMemo(
    () => withRequiredMarkers(page.fields, groups),
    [page, groups],
  );

  const valueOf = (k: string) => values[k] ?? "";
  const setValue = (k: string, v: string) => {
    setValues((prev) => ({ ...prev, [k]: v }));
    // Typing answers the complaint; it is re-checked on blur and on Next.
    setErrors((prev) => {
      if (!prev[k]) return prev;
      const next = { ...prev };
      delete next[k];
      return next;
    });
  };

  // Re-check only the field's FORMAT on blur (LinkedIn, year, vocab). A
  // required complaint waits for Next, so tabbing past an empty box is not
  // scolded.
  const onBlurField = (f: EditField) => {
    const found = validatePage(page, kind, [], { [f.key]: valueOf(f.key) });
    setErrors((prev) => {
      const next = { ...prev };
      if (found[f.key]) next[f.key] = found[f.key];
      else if (!groups.some((g) => g.includes(f.key))) delete next[f.key];
      return next;
    });
  };

  const scrollTop = () => {
    if (typeof window !== "undefined") window.scrollTo({ top: 0 });
  };

  const goToPage = (i: number) => {
    setErrors({});
    setPageIndex(i);
    scrollTop();
  };

  const submit = async () => {
    setSubmitting(true);
    setSubmitError(null);
    let status: number | null = null;
    let body: unknown = null;
    try {
      const res = await fetch(`${API_URL}/survey/new/${encodeURIComponent(key)}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(
          buildSubmitBody({
            kind,
            values,
            comments,
            fillSeconds: getFillSeconds(),
            website,
          }),
        ),
      });
      status = res.status;
      body = await res.json().catch(() => null);
    } catch {
      status = null;
    }
    setSubmitting(false);
    if (status !== null && status >= 200 && status < 300) {
      setStep("submitted");
      scrollTop();
      return;
    }
    if (status === 404) {
      setLoadState("closed");
      loadSupportContact(setClosedContact);
      return;
    }
    if (status === 422) {
      // Take them to the first question the server says is missing.
      const missing = missingKeysFromError(body, kind);
      const target = missing.length > 0 ? pageIndexOfKey(kind, missing[0]) : -1;
      if (target >= 0 && target !== pageIndex) {
        setPageIndex(target);
        setErrors(validatePage(pages[target], kind, groups, values));
      }
    }
    setSubmitError(submitErrorMessage(status, body, kind));
  };

  const onNext = () => {
    const found = validatePage(page, kind, groups, values);
    setErrors(found);
    if (Object.keys(found).length > 0) return;
    if (pageIndex < pages.length - 1) {
      goToPage(pageIndex + 1);
      return;
    }
    void submit();
  };

  const onBack = () => {
    setSubmitError(null);
    if (pageIndex === 0) {
      setErrors({});
      setStep("kind");
      scrollTop();
      return;
    }
    goToPage(pageIndex - 1);
  };

  return (
    <SurveyPageShell>
      {loadState === "loading" ? (
        <div className="space-y-4">
          <div className="h-9 w-2/3 animate-pulse rounded bg-gray-100" />
          <div className="h-48 animate-pulse rounded-lg bg-gray-100" />
        </div>
      ) : loadState === "closed" ? (
        <NewPeopleClosedPanel />
      ) : loadState === "failed" ? (
        <NewPeopleLoadFailedPanel />
      ) : step === "intro" ? (
        <NewPeopleIntro
          onStart={() => {
            setStep("kind");
            scrollTop();
          }}
        />
      ) : step === "kind" ? (
        <NewPeopleKindPicker
          onBack={() => setStep("intro")}
          onPick={(k) => {
            setKind(k);
            setPageIndex(0);
            setErrors({});
            setStep("wizard");
            scrollTop();
          }}
        />
      ) : step === "submitted" ? (
        <SuccessPanel
          title="Thank you. Your answers are in"
          body="Our team will review your response before adding you to our records. You can safely close this page."
        />
      ) : (
        <>
          <NewPeopleWizardPage
            page={page}
            stepNumber={pageIndex + 1}
            stepCount={pages.length}
            fields={pageFields}
            valueOf={valueOf}
            setValue={setValue}
            errors={errors}
            onBlurField={onBlurField}
            comments={comments}
            setComments={setComments}
            isLast={pageIndex === pages.length - 1}
            onBack={onBack}
            onNext={onNext}
            submitting={submitting}
            submitError={submitError}
          />
          <NewPeopleHoneypot value={website} onChange={setWebsite} />
        </>
      )}

      {/* Every state, the closed link included, when a contact is set. */}
      <SurveyContactLink
        contact={info?.support_contact ?? closedContact}
        variant="newPeople"
      />
    </SurveyPageShell>
  );
}
