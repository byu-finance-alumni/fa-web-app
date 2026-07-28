"use client";

import { use, useEffect, useState } from "react";
import { Check, ChevronRight, ExternalLink, Heart } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SAMPLE_ALUM, SAMPLE_ALUM_NAME } from "@/lib/sampleAlumni";
import { PAY_IT_FORWARD_URL } from "@/types/survey";
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
type Fields = Record<string, string>;

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "";

type EditField = {
  key: string;
  label: string;
  kind: "text" | "boolean";
  required?: boolean;
  donateUrl?: string;
};
type Section = { id: string; title: string; blurb: string; fields: EditField[] };

// The single source of truth for BOTH the review panel and the edit form —
// Industry leads, then the rest of the Career Directors' list, grouped.
const INFO_SECTIONS: Section[] = [
  {
    id: "employment",
    title: "Employment",
    blurb: "Industry, company, title, work location",
    fields: [
      { key: "employment.current_industry", label: "Industry", kind: "text" },
      { key: "profile.employment_status", label: "Employment status", kind: "text" },
      { key: "employment.current_employer", label: "Company", kind: "text" },
      { key: "employment.current_title", label: "Title", kind: "text" },
      { key: "employment.current_industry_secondary", label: "Secondary industry", kind: "text" },
      { key: "employment.current_city", label: "Employment city", kind: "text" },
      { key: "employment.current_state", label: "Employment state", kind: "text" },
      { key: "employment.current_country", label: "Employment country", kind: "text" },
    ],
  },
  {
    id: "residence",
    title: "Residence",
    blurb: "Where you live",
    fields: [
      { key: "contact.city", label: "City", kind: "text" },
      { key: "contact.state", label: "State", kind: "text" },
      { key: "contact.country", label: "Country", kind: "text" },
    ],
  },
  {
    id: "personal",
    title: "Personal",
    blurb: "Spouse, email, LinkedIn",
    fields: [
      { key: "profile.spouse_first_name", label: "Spouse first name", kind: "text" },
      { key: "profile.spouse_last_name", label: "Spouse last name", kind: "text" },
      { key: "contact.personal_email", label: "Permanent email", kind: "text", required: true },
      { key: "contact.work_email", label: "Work email", kind: "text" },
      { key: "profile.linkedin_url", label: "LinkedIn", kind: "text" },
    ],
  },
  {
    id: "grad",
    title: "Graduate school",
    blurb: "Program, school, projected year",
    fields: [
      { key: "profile.graduate_degree", label: "Program", kind: "text" },
      { key: "profile.graduate_school", label: "School", kind: "text" },
      { key: "profile.graduate_graduation_year", label: "Projected graduation year", kind: "text" },
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
            body="Our team will review your response before any changes are applied to your record. You can safely close this page."
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
            setOpenSection={setOpenSection}
            photoPreview={photoPreview}
            setPhotoPreview={setPhotoPreview}
            onBack={() => setStatus("review")}
            onSubmit={() => setStatus("submitted")}
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
      rows.push({ label: f.label, value: fields[f.key] ?? "" });
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
  setOpenSection,
  photoPreview,
  setPhotoPreview,
  onBack,
  onSubmit,
}: {
  firstName: string;
  name: string;
  valueOf: (key: string) => string;
  setEdit: (key: string, value: string) => void;
  openSection: string | null;
  setOpenSection: (id: string | null) => void;
  photoPreview: string | null;
  setPhotoPreview: (v: string | null) => void;
  onBack: () => void;
  onSubmit: () => void;
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
          onClick={() => setOpenSection(null)}
          className="mb-4 inline-flex items-center gap-1 text-sm font-medium text-brand-blue-600 hover:text-brand-blue-500"
        >
          ← All sections
        </button>
        {openSection === "photo" ? (
          <PhotoSection
            name={name}
            photoPreview={photoPreview}
            setPhotoPreview={setPhotoPreview}
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
          <Button type="button" variant="navy" size="lg" onClick={() => setOpenSection(null)}>
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
          onClick={() => setOpenSection("photo")}
        />
        {EDIT_SECTIONS.map((s) => (
          <SectionRow
            key={s.id}
            title={s.title}
            blurb={s.blurb}
            onClick={() => setOpenSection(s.id)}
          />
        ))}
      </ul>

      <div className="mt-8 flex flex-col-reverse gap-3 sm:flex-row sm:items-center sm:justify-between">
        <Button type="button" variant="ghost" onClick={onBack}>
          Back
        </Button>
        <Button
          type="button"
          variant="navy"
          size="lg"
          className="w-full sm:w-auto"
          onClick={onSubmit}
        >
          Submit my updates
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

function PhotoSection({
  name,
  photoPreview,
  setPhotoPreview,
}: {
  name: string;
  photoPreview: string | null;
  setPhotoPreview: (v: string | null) => void;
}) {
  return (
    <>
      <h1 className="text-3xl font-semibold leading-tight tracking-tight text-navy-800">
        Profile photo
      </h1>
      <div className="mt-6 flex items-center gap-4 rounded-lg border border-gray-200 bg-white p-5 sm:p-6">
        {photoPreview ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={photoPreview}
            alt="New profile photo preview"
            className="h-16 w-16 shrink-0 rounded-full object-cover"
          />
        ) : (
          <span className="flex h-16 w-16 shrink-0 items-center justify-center rounded-full bg-navy-800 text-base font-semibold text-white">
            {initialsOf(name)}
          </span>
        )}
        <div className="min-w-0">
          <label className="inline-flex cursor-pointer items-center rounded-md border border-gray-300 bg-white px-3 py-1.5 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50 focus-within:outline-none focus-within:ring-2 focus-within:ring-brand-blue-500 focus-within:ring-offset-1">
            <input
              type="file"
              accept="image/*"
              className="sr-only"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) setPhotoPreview(URL.createObjectURL(file));
              }}
            />
            {photoPreview ? "Choose a different photo" : "Change photo"}
          </label>
          <p className="mt-1 text-xs text-gray-500">
            JPG or PNG. Replaces the photo we have on file.
          </p>
        </div>
      </div>
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

function FieldControl({
  field,
  value,
  onChange,
}: {
  field: EditField;
  value: string;
  onChange: (v: string) => void;
}) {
  const controlId = `survey-${field.key}`;
  const labelId = `${controlId}-label`;
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
      <div className="mt-1.5">
        {field.kind === "text" ? (
          <Input
            id={controlId}
            value={value}
            required={field.required}
            placeholder="Add a value"
            onChange={(e) => onChange(e.target.value)}
          />
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
