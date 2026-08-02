"use client";

import { use, useEffect, useRef, useState } from "react";
import { Check, ChevronRight, ExternalLink, Heart } from "lucide-react";

import { HeadshotCropper } from "@/components/alumni/HeadshotCropper";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SAMPLE_ALUM, SAMPLE_ALUM_NAME } from "@/lib/sampleAlumni";
import { PAY_IT_FORWARD_URL } from "@/types/survey";
import { STATE_NAMES } from "@/lib/geo/state-field";
import {
  EMPLOYMENT_STATUS_OPTIONS,
  PRIMARY_INDUSTRY_OPTIONS,
  isEmploymentStatusPlaceholder,
} from "@/constants/dropdowns";
import type { components } from "@/types/api.gen";

/**
 * PUBLIC "confirm your info" survey landing page.
 *
 * The signed token in the URL resolves (via public `GET /survey/respond/{token}`)
 * to the alum's REAL on-file info. Review shows the full field list; "I need to
 * make changes" opens a section menu (Employment / Residence / Personal / …) the
 * alum drills into. Both the review and the edit form are driven by the SAME
 * `SECTIONS` list, so they always match. `demo` shows the sample alum.
 *
 * NOTE: submitting stages the response for staff review — it does not apply to
 * the record directly (that's the admin's confirm step).
 */

type Status = "review" | "confirmed" | "editing" | "submitted";
type LoadState = "loading" | "ready" | "invalid";
type Respondent = components["schemas"]["SurveyRespondInfo"];
type SubmitResult = components["schemas"]["SurveySubmitResult"];
type Fields = Record<string, string>;

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "";

// Country dropdown options (#525) — United States FIRST, then the rest
// alphabetically. Kept local to the public survey (its only consumer); the app
// otherwise stores country as free text, so a stored value outside this list is
// still preserved by the select (see `SelectControl`).
const COUNTRY_OPTIONS: readonly string[] = [
  "United States",
  "Afghanistan", "Albania", "Algeria", "Andorra", "Angola", "Argentina",
  "Armenia", "Australia", "Austria", "Azerbaijan", "Bahamas", "Bahrain",
  "Bangladesh", "Barbados", "Belarus", "Belgium", "Belize", "Benin", "Bolivia",
  "Bosnia and Herzegovina", "Botswana", "Brazil", "Brunei", "Bulgaria",
  "Burkina Faso", "Cambodia", "Cameroon", "Canada", "Chile", "China",
  "Colombia", "Costa Rica", "Croatia", "Cyprus", "Czechia", "Denmark",
  "Dominican Republic", "Ecuador", "Egypt", "El Salvador", "Estonia",
  "Ethiopia", "Fiji", "Finland", "France", "Georgia", "Germany", "Ghana",
  "Greece", "Guatemala", "Honduras", "Hong Kong", "Hungary", "Iceland",
  "India", "Indonesia", "Iraq", "Ireland", "Israel", "Italy", "Jamaica",
  "Japan", "Jordan", "Kazakhstan", "Kenya", "Kuwait", "Latvia", "Lebanon",
  "Lithuania", "Luxembourg", "Malaysia", "Maldives", "Malta", "Mexico",
  "Mongolia", "Montenegro", "Morocco", "Mozambique", "Nepal", "Netherlands",
  "New Zealand", "Nicaragua", "Nigeria", "North Macedonia", "Norway", "Oman",
  "Pakistan", "Panama", "Paraguay", "Peru", "Philippines", "Poland",
  "Portugal", "Qatar", "Romania", "Rwanda", "Saudi Arabia", "Senegal",
  "Serbia", "Singapore", "Slovakia", "Slovenia", "South Africa", "South Korea",
  "Spain", "Sri Lanka", "Sweden", "Switzerland", "Taiwan", "Tanzania",
  "Thailand", "Trinidad and Tobago", "Tunisia", "Turkey", "Uganda", "Ukraine",
  "United Arab Emirates", "United Kingdom", "Uruguay", "Venezuela", "Vietnam",
  "Zambia", "Zimbabwe", "Other",
];

// Industry choices for the current-industry dropdown (#525). "Other" is broken
// out separately so selecting it reveals a free-text input.
const INDUSTRY_CHOICES: readonly string[] = PRIMARY_INDUSTRY_OPTIONS.filter(
  (o) => o !== "Other",
);

type FieldKind =
  | "text"
  | "boolean"
  | "date"
  | "usState"
  | "country"
  | "industry"
  | "employmentStatus";
type EditField = {
  key: string;
  label: string;
  kind: FieldKind;
  required?: boolean;
  donateUrl?: string;
  /** Helper/placeholder text for a free-text input (e.g. grad-program examples). */
  placeholder?: string;
  /** Guidance shown under the label — examples too long to sit in the label. */
  helpText?: string;
};
type Section = { id: string; title: string; blurb: string; fields: EditField[] };

/**
 * What the alum SEES for a stored value — a placeholder non-answer reads as
 * blank (#572).
 *
 * Only `edits` is POSTed on submit, so blanking the display never writes: an
 * untouched field is absent from the payload and the stored `Unknown` survives
 * untouched in the database. It disappears only when the alum actually picks a
 * real status. Used by BOTH the review panel and the edit control so the two
 * can't disagree — reading "Unknown" on review and then finding an empty
 * dropdown after clicking edit is exactly the confusion this avoids.
 */
function displayValue(field: EditField, value: string): string {
  if (field.kind === "employmentStatus" && isEmploymentStatusPlaceholder(value)) {
    return "";
  }
  return value;
}

// The single source of truth for BOTH the review panel and the edit form —
// Employment status leads, then the rest of the Career Directors' list, grouped
// (order per Tanya, #568: status first, because the answer to it decides how
// much of the rest of the section even applies).
const INFO_SECTIONS: Section[] = [
  {
    id: "employment",
    title: "Employment",
    blurb: "Status, company, title, industry, work location",
    fields: [
      { key: "profile.employment_status", label: "Employment Status", kind: "employmentStatus" },
      { key: "employment.current_employer", label: "Company", kind: "text" },
      { key: "employment.current_title", label: "Job Title", kind: "text" },
      { key: "employment.current_industry", label: "Industry", kind: "industry" },
      { key: "employment.current_industry_secondary", label: "Secondary Industry", kind: "text" },
      { key: "employment.current_city", label: "Employment city", kind: "text" },
      { key: "employment.current_state", label: "Employment state", kind: "usState" },
      { key: "employment.current_country", label: "Employment country", kind: "country" },
      { key: "employment.current_zip", label: "Company ZIP", kind: "text" },
    ],
  },
  {
    id: "residence",
    title: "Residence",
    blurb: "Where you live",
    fields: [
      { key: "contact.city", label: "City", kind: "text" },
      { key: "contact.state", label: "State", kind: "usState" },
      { key: "contact.country", label: "Country", kind: "country" },
    ],
  },
  {
    id: "personal",
    title: "Personal",
    blurb: "Spouse, contact, & personal details",
    fields: [
      { key: "profile.spouse_first_name", label: "Spouse first name", kind: "text" },
      { key: "profile.spouse_last_name", label: "Spouse last name", kind: "text" },
      { key: "contact.personal_email", label: "Permanent email", kind: "text", required: true },
      { key: "contact.work_email", label: "Work email", kind: "text" },
      { key: "contact.phone", label: "Phone", kind: "text" },
      { key: "profile.linkedin_url", label: "LinkedIn", kind: "text" },
      { key: "profile.gender", label: "Gender", kind: "text" },
      { key: "profile.marital_status", label: "Marital status", kind: "text" },
      { key: "profile.birth_date", label: "Birthday", kind: "date" },
      { key: "profile.citizenship", label: "Citizenship", kind: "text" },
      { key: "profile.home_country", label: "Home country", kind: "country" },
    ],
  },
  {
    id: "grad",
    title: "Graduate school",
    blurb: "Program, school, graduation year",
    // Labels per Tanya (#569) — the examples cover the responses alumni actually
    // give, and sit in `helpText` rather than the label so the review panel's
    // two-column rows stay scannable.
    fields: [
      {
        key: "profile.graduate_degree",
        label: "Graduate Program",
        kind: "text",
        helpText: "ex: MBA, JD/LAW, Medical, Dental, PhD, MHA, MRED, etc.",
        placeholder: "e.g. MBA, JD/LAW, PhD…",
      },
      {
        key: "profile.graduate_school",
        label: "Graduate School",
        kind: "text",
        helpText: "ex: Duke, Harvard, Northwestern, BYU, etc.",
        placeholder: "e.g. Duke, Harvard, BYU…",
      },
      {
        key: "profile.graduate_graduation_year",
        label: "Projected or completed graduation year",
        kind: "text",
      },
    ],
  },
  {
    id: "designations",
    title: "Finance designations",
    blurb: "CFA, CFP, etc.",
    fields: [
      { key: "profile.other_designations", label: "Finance designations (CFA, CFP, etc.)", kind: "text" },
    ],
  },
];

const ENGAGEMENT_SECTION: Section = {
  id: "engagement",
  title: "Ways to get involved",
  blurb: "Optional — mentoring, speaking, giving",
  fields: [
    { key: "program.mentor_willing", label: "Willing to mentor students?", kind: "boolean" },
    { key: "program.women_in_finance_mentor_willing", label: "Willing to mentor for Women in Finance?", kind: "boolean" },
    { key: "program.guest_speaker_willing", label: "Willing to be a guest speaker?", kind: "boolean" },
    { key: "program.help_at_event_willing", label: "Willing to help at an event?", kind: "boolean" },
    { key: "program.nettrek_host_willing", label: "Willing to host a NetTrek visit?", kind: "boolean" },
    { key: "program.finance_conference_willing", label: "Willing to take part in the finance conference?", kind: "boolean" },
    { key: "program.company_event_sponsor_willing", label: "Willing to sponsor a company event?", kind: "boolean" },
    { key: "program.case_competition_host_willing", label: "Willing to host a case competition?", kind: "boolean" },
    { key: "program.piff_donor", label: "Would you like to donate to the Pay It Forward fund?", kind: "boolean", donateUrl: PAY_IT_FORWARD_URL },
  ],
};

const EDIT_SECTIONS: Section[] = [...INFO_SECTIONS, ENGAGEMENT_SECTION];

function initialsOf(name: string): string {
  return (
    name.trim().split(/\s+/).map((p) => p[0]).slice(0, 2).join("").toUpperCase() ||
    "?"
  );
}


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

/* ------------------------------------------------------------ review group -- */

function ReviewGroup({ section, fields }: { section: Section; fields: Fields }) {
  // Collapse spouse first/last into one "Spouse name" row for the read view.
  const rows: { label: string; value: string }[] = [];
  for (const f of section.fields) {
    if (f.key === "profile.spouse_last_name") continue;
    if (f.key === "profile.spouse_first_name") {
      const spouse = [fields["profile.spouse_first_name"], fields["profile.spouse_last_name"]]
        .filter(Boolean)
        .join(" ");
      rows.push({ label: "Spouse name", value: spouse });
    } else {
      rows.push({ label: f.label, value: displayValue(f, fields[f.key] ?? "") });
    }
  }
  return (
    <div>
      <h3 className="text-xs font-semibold uppercase tracking-wide text-navy-800">
        {section.title}
      </h3>
      <dl className="mt-1.5 divide-y divide-gray-100">
        {rows.map((r) => (
          <div key={r.label} className="flex items-baseline justify-between gap-6 py-1.5">
            <dt className="shrink-0 text-xs text-gray-500">{r.label}</dt>
            <dd className="min-w-0 break-words text-right text-sm font-medium text-gray-900">
              {r.value ? r.value : <span className="font-normal text-gray-400">—</span>}
            </dd>
          </div>
        ))}
      </dl>
    </div>
  );
}

/* --------------------------------------------------------------- edit flow -- */

function EditFlow({
  firstName,
  name,
  valueOf,
  setEdit,
  openSection,
  openSectionNav,
  closeSectionNav,
  photoPreview,
  setPhotoPreview,
  setPhotoFile,
  onBack,
  onSubmit,
  submitting,
  submitError,
}: {
  firstName: string;
  name: string;
  valueOf: (key: string) => string;
  setEdit: (key: string, value: string) => void;
  openSection: string | null;
  /** Open a section AND push a history entry so Back returns here (#526). */
  openSectionNav: (id: string) => void;
  /** Close the open section by popping that history entry (#526). */
  closeSectionNav: () => void;
  photoPreview: string | null;
  setPhotoPreview: (v: string | null) => void;
  setPhotoFile: (v: File | null) => void;
  onBack: () => void;
  onSubmit: () => void;
  submitting: boolean;
  submitError: string | null;
}) {
  const section =
    openSection === "photo"
      ? null
      : EDIT_SECTIONS.find((s) => s.id === openSection);

  // A specific section (or the photo screen) is open.
  if (openSection) {
    return (
      <>
        <button
          type="button"
          onClick={closeSectionNav}
          className="mb-4 inline-flex items-center gap-1 text-sm font-medium text-brand-blue-600 hover:text-brand-blue-500"
        >
          ← All sections
        </button>
        {openSection === "photo" ? (
          <PhotoSection
            name={name}
            photoPreview={photoPreview}
            setPhotoPreview={setPhotoPreview}
            setPhotoFile={setPhotoFile}
          />
        ) : section ? (
          <>
            <h1 className="text-3xl font-semibold leading-tight tracking-tight text-navy-800">
              {section.title}
            </h1>
            <div className="mt-6 space-y-5 rounded-lg border border-gray-200 bg-white p-5 sm:p-6">
              {section.fields.map((f) => (
                <FieldControl
                  key={f.key}
                  field={f}
                  value={valueOf(f.key)}
                  onChange={(v) => setEdit(f.key, v)}
                />
              ))}
            </div>
          </>
        ) : null}
        <div className="mt-6">
          <Button type="button" variant="navy" size="lg" onClick={closeSectionNav}>
            Done
          </Button>
        </div>
      </>
    );
  }

  // Section menu.
  return (
    <>
      <div>
        <h1 className="text-3xl font-semibold leading-tight tracking-tight text-navy-800">
          What would you like to update, {firstName}?
        </h1>
        <p className="mt-3 max-w-prose text-base leading-relaxed text-gray-600">
          Pick a section to edit. Change anything that&apos;s out of date, then
          submit — our team reviews updates before they&apos;re applied.
        </p>
      </div>

      <ul className="mt-6 divide-y divide-gray-100 overflow-hidden rounded-lg border border-gray-200">
        <SectionRow
          title="Profile photo"
          blurb="Upload a new headshot"
          onClick={() => openSectionNav("photo")}
        />
        {EDIT_SECTIONS.map((s) => (
          <SectionRow
            key={s.id}
            title={s.title}
            blurb={s.blurb}
            onClick={() => openSectionNav(s.id)}
          />
        ))}
      </ul>

      <a
        href={PAY_IT_FORWARD_URL}
        target="_blank"
        rel="noopener noreferrer"
        className="mt-4 inline-flex items-center gap-1.5 rounded-md bg-brand-blue-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-brand-blue-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-blue-500 focus-visible:ring-offset-1"
      >
        <Heart className="h-4 w-4" aria-hidden="true" />
        Donate to Pay It Forward
        <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
      </a>

      {submitError ? (
        <p className="mt-4 text-sm text-danger-600">{submitError}</p>
      ) : null}

      <div className="mt-8 flex flex-col-reverse gap-3 sm:flex-row sm:items-center sm:justify-between">
        <Button type="button" variant="ghost" onClick={onBack} disabled={submitting}>
          Back
        </Button>
        <Button
          type="button"
          variant="navy"
          size="lg"
          className="w-full sm:w-auto"
          onClick={onSubmit}
          disabled={submitting}
        >
          {submitting ? "Submitting…" : "Submit my updates"}
        </Button>
      </div>

      <TrustNote />
    </>
  );
}

function SectionRow({
  title,
  blurb,
  onClick,
}: {
  title: string;
  blurb: string;
  onClick: () => void;
}) {
  return (
    <li>
      <button
        type="button"
        onClick={onClick}
        className="flex w-full items-center justify-between gap-4 px-5 py-4 text-left transition-colors hover:bg-gray-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-blue-500 focus-visible:ring-inset"
      >
        <span>
          <span className="block text-sm font-semibold text-gray-900">{title}</span>
          <span className="text-xs text-gray-500">{blurb}</span>
        </span>
        <ChevronRight className="h-5 w-5 shrink-0 text-gray-400" aria-hidden="true" />
      </button>
    </li>
  );
}

// Image types the canvas cropper can safely decode + export.
const PHOTO_ACCEPTED_TYPES = ["image/jpeg", "image/png", "image/webp"];
// Ceiling on the ORIGINAL picked file. The cropper always exports a small
// (≤1024px) JPEG, so the actual upload is tiny regardless — this only guards
// against decoding an absurdly large source. Generous so modern phone photos
// (often 20-40 MB) get through instead of being rejected before cropping.
const PHOTO_MAX_BYTES = 50 * 1024 * 1024;

function PhotoSection({
  name,
  photoPreview,
  setPhotoPreview,
  setPhotoFile,
}: {
  name: string;
  photoPreview: string | null;
  setPhotoPreview: (v: string | null) => void;
  setPhotoFile: (v: File | null) => void;
}) {
  // Object URL open in the crop modal (null = closed). We keep the ORIGINAL
  // picked image's URL in a ref so "Adjust" can reopen the cropper on the full
  // photo (not the already-cropped result).
  const [cropSrc, setCropSrc] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const origSrc = useRef<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const setOrig = (url: string | null) => {
    if (origSrc.current) URL.revokeObjectURL(origSrc.current);
    origSrc.current = url;
  };

  // Validate, then open the cropper so the alum positions the photo in the
  // circle — same "adjust the frame" step the staff profile uses.
  const onPick = (file: File | null) => {
    if (!file) return;
    if (!PHOTO_ACCEPTED_TYPES.includes(file.type)) {
      setError("That image type isn't supported. Use a JPG, PNG, or WebP.");
      return;
    }
    if (file.size > PHOTO_MAX_BYTES) {
      setError("That image is too large. Please use one under 50 MB.");
      return;
    }
    setError(null);
    const url = URL.createObjectURL(file);
    setOrig(url);
    setCropSrc(url);
  };

  // Cropper saved: the cropped square becomes the photo to upload + the preview.
  const onCropSave = (blob: Blob) => {
    if (photoPreview) URL.revokeObjectURL(photoPreview);
    setPhotoFile(new File([blob], "headshot.jpg", { type: "image/jpeg" }));
    setPhotoPreview(URL.createObjectURL(blob));
    setCropSrc(null);
  };

  return (
    <>
      <h1 className="text-3xl font-semibold leading-tight tracking-tight text-navy-800">
        Profile photo
      </h1>
      <div className="mt-6 flex flex-col items-center gap-5 rounded-lg border border-gray-200 bg-white p-6 sm:p-8">
        {photoPreview ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={photoPreview}
            alt="New profile photo preview"
            className="h-48 w-48 shrink-0 rounded-full object-cover shadow-sm"
          />
        ) : (
          <span className="flex h-48 w-48 shrink-0 items-center justify-center rounded-full bg-navy-800 text-5xl font-semibold text-white">
            {initialsOf(name)}
          </span>
        )}

        <div className="flex flex-col items-center gap-2">
          <div className="flex flex-wrap items-center justify-center gap-x-3 gap-y-1 text-sm">
            <label className="inline-flex cursor-pointer items-center rounded-md border border-gray-300 bg-white px-3 py-1.5 font-medium text-gray-700 transition-colors hover:bg-gray-50 focus-within:outline-none focus-within:ring-2 focus-within:ring-brand-blue-500 focus-within:ring-offset-1">
              <input
                ref={inputRef}
                type="file"
                accept={PHOTO_ACCEPTED_TYPES.join(",")}
                className="sr-only"
                onChange={(e) => {
                  onPick(e.target.files?.[0] ?? null);
                  // Reset so re-picking the SAME file still fires onChange.
                  e.target.value = "";
                }}
              />
              {photoPreview ? "Choose a different photo" : "Upload a photo"}
            </label>
            {photoPreview && origSrc.current ? (
              <button
                type="button"
                onClick={() => setCropSrc(origSrc.current)}
                className="font-medium text-brand-blue-600 hover:text-brand-blue-500"
              >
                Adjust
              </button>
            ) : null}
          </div>
          {error ? (
            <p className="text-xs text-danger-600">{error}</p>
          ) : (
            <p className="text-xs text-gray-500">
              JPG, PNG, or WebP — you&apos;ll position it in the circle. Replaces
              the photo we have on file.
            </p>
          )}
        </div>
      </div>

      {cropSrc ? (
        <HeadshotCropper
          src={cropSrc}
          busy={false}
          onCancel={() => setCropSrc(null)}
          onSave={onCropSave}
        />
      ) : null}
    </>
  );
}

/* -------------------------------------------------------------- info panels - */

function TrustNote() {
  return (
    <p className="mt-8 border-t border-gray-200 pt-6 text-sm leading-relaxed text-gray-500">
      This secure form was sent by the BYU Finance Department. Your response will
      be reviewed before any changes are applied.
    </p>
  );
}

function InvalidPanel() {
  return (
    <div className="rounded-lg border border-gray-200 bg-white p-8 text-center sm:p-10">
      <h1 className="text-xl font-semibold tracking-tight text-navy-800">
        This link isn&apos;t valid
      </h1>
      <p className="mx-auto mt-2 max-w-md text-sm leading-relaxed text-gray-600">
        This survey link may have expired or been mistyped. If you received it in
        an email, try opening it again from the original message, or reach out to
        the BYU Finance team.
      </p>
    </div>
  );
}

/* ---------------------------------------------------------- field control -- */

// Shared native <select> styling — matches the Input's border/height/focus so
// dropdowns and text inputs line up in the edit form.
const SELECT_CLASS =
  "flex h-10 w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm " +
  "text-gray-900 focus-visible:outline-none focus-visible:ring-2 " +
  "focus-visible:ring-brand-blue-500 focus-visible:ring-offset-1 " +
  "disabled:cursor-not-allowed disabled:opacity-50";

/**
 * A native dropdown over a fixed option list (US states, countries). A stored
 * value that isn't in the list (e.g. an international province, or a country
 * spelled differently) is preserved by prepending it as a selectable option, so
 * opening the survey never silently blanks or rewrites what's on file.
 */
function SelectControl({
  id,
  value,
  options,
  placeholder,
  onChange,
}: {
  id: string;
  value: string;
  options: readonly string[];
  placeholder: string;
  onChange: (v: string) => void;
}) {
  const opts =
    value && !options.includes(value) ? [value, ...options] : options;
  return (
    <select
      id={id}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className={SELECT_CLASS}
    >
      <option value="">{placeholder}</option>
      {opts.map((o) => (
        <option key={o} value={o}>
          {o}
        </option>
      ))}
    </select>
  );
}

/**
 * Current industry (#525): the controlled industry list with an "Other" option
 * that reveals a free-text input. A stored value outside the list is treated as
 * "Other" and shown in the text box, so nothing on file is lost.
 */
function IndustryControl({
  id,
  value,
  onChange,
}: {
  id: string;
  value: string;
  onChange: (v: string) => void;
}) {
  const inList = INDUSTRY_CHOICES.includes(value);
  const [other, setOther] = useState(value !== "" && !inList);
  const selectValue = other ? "__other__" : inList ? value : "";
  return (
    <>
      <select
        id={id}
        value={selectValue}
        onChange={(e) => {
          const v = e.target.value;
          if (v === "__other__") {
            setOther(true);
            onChange("");
          } else {
            setOther(false);
            onChange(v);
          }
        }}
        className={SELECT_CLASS}
      >
        <option value="">Select an industry</option>
        {INDUSTRY_CHOICES.map((o) => (
          <option key={o} value={o}>
            {o}
          </option>
        ))}
        <option value="__other__">Other</option>
      </select>
      {other ? (
        <Input
          className="mt-2"
          value={value}
          placeholder="Type your industry"
          onChange={(e) => onChange(e.target.value)}
        />
      ) : null}
    </>
  );
}

function FieldControl({
  field,
  value: storedValue,
  onChange,
}: {
  field: EditField;
  value: string;
  onChange: (v: string) => void;
}) {
  // A placeholder non-answer ("Unknown") renders as an untouched, empty control
  // — so it is never offered back as a choice — while staying in the DB (#572).
  const value = displayValue(field, storedValue);
  const controlId = `survey-${field.key}`;
  const labelId = `${controlId}-label`;
  const helpId = field.helpText ? `${controlId}-help` : undefined;
  return (
    <div>
      <Label id={labelId} htmlFor={controlId} className="text-sm font-medium text-gray-900">
        {field.label}
        {field.required ? (
          <span className="ml-1 text-danger-600" aria-hidden="true">
            *
          </span>
        ) : null}
      </Label>
      {field.helpText ? (
        <p id={helpId} className="mt-0.5 text-xs leading-relaxed text-gray-500">
          {field.helpText}
        </p>
      ) : null}
      <div className="mt-1.5">
        {field.kind === "text" ? (
          <Input
            id={controlId}
            value={value}
            required={field.required}
            aria-describedby={helpId}
            placeholder={field.placeholder ?? "Add a value"}
            onChange={(e) => onChange(e.target.value)}
          />
        ) : field.kind === "date" ? (
          <Input
            id={controlId}
            type="date"
            value={value}
            required={field.required}
            onChange={(e) => onChange(e.target.value)}
          />
        ) : field.kind === "usState" ? (
          <SelectControl
            id={controlId}
            value={value}
            options={STATE_NAMES}
            placeholder="Select a state"
            onChange={onChange}
          />
        ) : field.kind === "country" ? (
          <SelectControl
            id={controlId}
            value={value}
            options={COUNTRY_OPTIONS}
            placeholder="Select a country"
            onChange={onChange}
          />
        ) : field.kind === "employmentStatus" ? (
          <SelectControl
            id={controlId}
            value={value}
            options={EMPLOYMENT_STATUS_OPTIONS}
            placeholder="Select your status"
            onChange={onChange}
          />
        ) : field.kind === "industry" ? (
          <IndustryControl id={controlId} value={value} onChange={onChange} />
        ) : (
          <>
            <div className="flex gap-2" role="radiogroup" aria-labelledby={labelId}>
              {["Yes", "No"].map((opt) => (
                <label
                  key={opt}
                  className="inline-flex cursor-pointer items-center gap-2 rounded-md border border-gray-300 px-4 py-1.5 text-sm text-gray-700 transition-colors hover:border-brand-blue-500 has-[:checked]:border-brand-blue-600 has-[:checked]:bg-brand-blue-50 has-[:checked]:font-medium has-[:checked]:text-navy-800"
                >
                  <input
                    type="radio"
                    name={controlId}
                    value={opt}
                    checked={value === opt}
                    onChange={() => onChange(opt)}
                    className="h-4 w-4 border-gray-300 text-brand-blue-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-blue-500 focus-visible:ring-offset-1"
                  />
                  {opt}
                </label>
              ))}
            </div>
            {field.donateUrl ? (
              <a
                href={field.donateUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-2 inline-flex items-center gap-1.5 rounded-md bg-brand-blue-600 px-3 py-1.5 text-sm font-semibold text-white transition-colors hover:bg-brand-blue-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-blue-500 focus-visible:ring-offset-1"
              >
                <Heart className="h-4 w-4" aria-hidden="true" />
                Donate to Pay It Forward
                <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
              </a>
            ) : null}
          </>
        )}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------- success ----- */

function SuccessPanel({
  title,
  body,
  action,
}: {
  title: string;
  body: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="rounded-lg border border-gray-200 bg-white p-8 text-center sm:p-10">
      <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-success-50">
        <Check className="h-7 w-7 text-success-600" aria-hidden="true" />
      </div>
      <h1 className="mt-5 text-xl font-semibold tracking-tight text-navy-800">{title}</h1>
      <p className="mx-auto mt-2 max-w-md text-sm leading-relaxed text-gray-600">{body}</p>
      {action ? <div className="mt-6 flex justify-center">{action}</div> : null}
    </div>
  );
}
