import Link from "next/link";
import { notFound } from "next/navigation";
import { CircleAlert, Check } from "lucide-react";
import { apiGet, ApiError } from "@/lib/api";
import type { Contact, Profile } from "@/types/profile";
import type { UserContext } from "@/types/alumni";
import {
  canAddInteraction,
  canEditAlumni,
  hasFullAccess,
  isUserAdmin,
} from "@/constants/roles";
import { Topbar } from "@/components/shell/Topbar";
import { TopbarSearch } from "@/components/shared/TopbarSearch";
import {
  AddEducationButton,
  AddEventButton,
  AddInteractionButton,
  AddLeadershipButton,
  AddRoleButton,
  AddTaskButton,
  ArchiveControls,
  EducationRowActions,
  EmploymentRowActions,
  LeadershipRowActions,
  TagStatusManager,
  TaskCheckbox,
} from "@/components/alumni/ProfileDialogs";
import { InteractionTimeline } from "@/components/alumni/InteractionTimeline";
import { AlumniProfileTabs } from "@/components/alumni/AlumniProfileTabs";
import { AlumniPayItForwardPanel } from "@/components/donations/AlumniPayItForwardPanel";
import type { AlumniDonations } from "@/types/donations";
import { ProfileNotes } from "@/components/alumni/ProfileNotes";
import type { Note } from "@/types/notes";
import { ExportProfileButton } from "@/components/alumni/ExportProfileButton";
import { DrawerList } from "@/components/alumni/DrawerList";
import { MetricCard } from "@/components/shared/MetricCard";
import { ProfileHeadshot } from "@/components/alumni/ProfileHeadshot";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { designationFullName, splitDesignations } from "@/lib/designations";

/* ----------------------------------------------------------------- helpers */

const fmtDate = (iso: string | null) =>
  iso
    ? new Date(iso).toLocaleDateString("en-US", {
        year: "numeric",
        month: "short",
        day: "numeric",
      })
    : null;

function monthDay(iso: string | null): { mon: string; day: string } | null {
  if (!iso) return null;
  const d = new Date(iso);
  return {
    mon: d.toLocaleDateString("en-US", { month: "short" }).toUpperCase(),
    day: d.toLocaleDateString("en-US", { day: "2-digit" }),
  };
}

/** Month-level date ("Mon YYYY") for the Pay It Forward summary (#403). The
 *  ledger stores a year + optional month (day is always the 1st), so the day is
 *  never surfaced. Parsed as local time (T00:00:00) so a "YYYY-MM-01" value never
 *  shifts back a month in negative-offset timezones. */
const place = (...parts: (string | null | undefined)[]) =>
  parts.filter(Boolean).join(", ") || null;

/** Whole-dollar USD (no cents), matching the Pay It Forward panel. `null` (a
 *  withheld/absent amount) renders as an em-dash rather than "$0". */
function money(value: number | null): string {
  if (value === null) return "—";
  return value.toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  });
}

/* -------------------------------------------------------- server components */

/**
 * Compact contact strip rendered in the profile header (#223) — email, phone,
 * and mailing address shown next to the name. Text-only (no icons) per the
 * design rules. Email/phone are actionable links; the address is plain text.
 * Renders nothing when no contact data is on file (the Overview panel still
 * carries the full, field-by-field breakdown).
 */
function HeaderContact({
  contact,
  linkedinUrl,
  canViewContactDetails,
}: {
  contact: Contact | null;
  linkedinUrl: string | null;
  /** Email, phone, and the full mailing address are contact PII — surfaced only
   *  to editors (defense-in-depth for #166; the backend also nulls them for the
   *  view_only role). LinkedIn stays visible to every role. */
  canViewContactDetails: boolean;
}) {
  // Surface a SINGLE contact in the header: the flagged preferred method (#301),
  // else fall back to personal email, then phone. No star here (the preferred
  // star lives on the Overview contact rows below); the "Preferred" label is
  // dropped too. Email/phone are PII (editor-gated); LinkedIn is visible to
  // every role. A gated-away or empty target resolves to null so we never leak
  // PII or point at a blank field.
  let primary: { label: string; value: string; href: string } | null = null;
  switch (contact?.preferred_contact_method) {
    case "personal_email":
      if (canViewContactDetails && contact?.personal_email)
        primary = {
          label: "Personal email",
          value: contact.personal_email,
          href: `mailto:${contact.personal_email}`,
        };
      break;
    case "work_email":
      if (canViewContactDetails && contact?.work_email)
        primary = {
          label: "Work email",
          value: contact.work_email,
          href: `mailto:${contact.work_email}`,
        };
      break;
    case "phone":
      if (canViewContactDetails && contact?.phone)
        primary = {
          label: "Phone",
          value: contact.phone,
          href: `tel:${contact.phone}`,
        };
      break;
    case "linkedin":
      if (linkedinUrl)
        primary = { label: "LinkedIn", value: "LinkedIn", href: linkedinUrl };
      break;
    default:
      break;
  }

  // No (reachable) preferred method → default to personal email, then phone.
  if (!primary && canViewContactDetails) {
    if (contact?.personal_email)
      primary = {
        label: "Personal email",
        value: contact.personal_email,
        href: `mailto:${contact.personal_email}`,
      };
    else if (contact?.phone)
      primary = {
        label: "Phone",
        value: contact.phone,
        href: `tel:${contact.phone}`,
      };
  }

  if (!primary && !linkedinUrl) return null;

  return (
    <div className="mt-1.5 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-gray-600">
      {primary ? (
        <a
          href={primary.href}
          target={primary.href.startsWith("http") ? "_blank" : undefined}
          rel={
            primary.href.startsWith("http") ? "noopener noreferrer" : undefined
          }
          className="inline-flex items-center gap-1 font-semibold text-brand-blue-600 hover:text-brand-blue-500"
          title={primary.label}
        >
          {primary.value}
        </a>
      ) : null}
      {/* LinkedIn stays up top (non-PII, visible to every role) unless it's
          already the starred primary. */}
      {linkedinUrl && primary?.href !== linkedinUrl ? (
        <a
          href={linkedinUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="font-medium text-brand-blue-600 hover:text-brand-blue-500"
        >
          LinkedIn
        </a>
      ) : null}
    </div>
  );
}

function Panel({
  title,
  action,
  children,
  className = "",
  contentClassName = "",
}: {
  title: string;
  action?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
  /** Extra classes on the CardContent body — e.g. to let it grow and center
   *  its content when the card is stretched to fill a column. */
  contentClassName?: string;
}) {
  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        {action}
      </CardHeader>
      <CardContent className={contentClassName}>{children}</CardContent>
    </Card>
  );
}

function ContactField({
  label,
  value,
  href,
  hrefLabel,
  preferred = false,
}: {
  label: string;
  value: string | null;
  href?: string;
  hrefLabel?: string;
  /** When true, marks this row as the alumnus's preferred contact method (#301)
   *  with a text star (★) next to the label. */
  preferred?: boolean;
}) {
  // Text-only (no icon chip) per the design rules — the label, the actionable
  // value, and the Send/Call/Open action carry all the meaning.
  return (
    <div className="flex items-start gap-3">
      <div className="min-w-0 flex-1">
        <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">
          {label}
          {preferred ? (
            <span
              className="ml-1 text-brand-blue-600"
              title="Preferred contact method"
            >
              ★<span className="sr-only"> (preferred)</span>
            </span>
          ) : null}
        </p>
        {value && href ? (
          // The value itself is clickable (mailto:/tel:/https:), not just the
          // Send/Call/Open action on the right.
          <a
            href={href}
            target={href.startsWith("http") ? "_blank" : undefined}
            rel={href.startsWith("http") ? "noopener noreferrer" : undefined}
            className="block truncate text-sm font-medium text-brand-blue-600 hover:text-brand-blue-500"
          >
            {value}
          </a>
        ) : (
          <p
            className={`truncate text-sm ${value ? "text-gray-900" : "text-gray-300"}`}
          >
            {value || "—"}
          </p>
        )}
      </div>
      {value && href ? (
        <a
          href={href}
          target={href.startsWith("http") ? "_blank" : undefined}
          rel={href.startsWith("http") ? "noopener noreferrer" : undefined}
          className="shrink-0 text-xs font-medium text-brand-blue-600 hover:text-brand-blue-500"
        >
          {hrefLabel}
        </a>
      ) : null}
    </div>
  );
}

function EditLink({ id, label = "Edit" }: { id: number; label?: string }) {
  return (
    <Button asChild variant="link" size="sm" className="px-0">
      <Link href={`/alumni/${id}/edit`}>{label}</Link>
    </Button>
  );
}

function EngagementChip({
  children,
  tone = "tag",
}: {
  children: React.ReactNode;
  tone?: "tag" | "neutral" | "success" | "warning" | "solid";
}) {
  // "solid" keeps the navy treatment used on the profile; the rest map to the
  // Badge variants directly.
  if (tone === "solid") {
    return (
      <Badge variant="neutral" className="bg-navy-800 text-white">
        {children}
      </Badge>
    );
  }
  return <Badge variant={tone}>{children}</Badge>;
}

function avatarColor(seed: string): string {
  const colors = [
    "bg-navy-800",
    "bg-brand-blue-600",
    "bg-royal-700",
    "bg-brand-blue-500",
  ];
  return colors[seed.charCodeAt(0) % colors.length];
}

/* ------------------------------------------------------------------- page -- */

export default async function AlumniProfilePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  let profile: Profile;
  try {
    profile = await apiGet<Profile>(`/alumni/${id}/profile`);
  } catch (e) {
    if (e instanceof ApiError && e.status === 404) notFound();
    throw e;
  }

  // Unified notes (#39): readable by every role; a failure here must not break
  // the whole profile, so fall back to an empty list.
  let notes: Note[] = [];
  try {
    notes = await apiGet<Note[]>(
      `/notes?entity_type=alumni&entity_id=${id}`,
    );
  } catch {
    /* notes unavailable — render the card empty rather than 500 the page */
  }

  // Pay It Forward giving (#161): only surfaces a tab when this alumnus actually
  // has donations. Readable by every role; dollar amounts arrive pre-gated from
  // the backend (null for non-full-access). A failure just omits the tab.
  let donations: AlumniDonations | null = null;
  try {
    const d = await apiGet<AlumniDonations>(`/donations/alumni/${id}`);
    if (d.donation_count > 0) donations = d;
  } catch {
    /* no donations / endpoint error — the tab is simply not shown */
  }

  // Headshot: a short-lived signed URL for the profile photo, readable by every
  // role (the bucket is private, so the signed URL is the only way to view it).
  // A failure here just falls back to the initials avatar — never breaks the page.
  let headshotUrl: string | null = null;
  try {
    const h = await apiGet<{ url: string | null }>(`/alumni/${id}/headshot`);
    headshotUrl = h?.url ?? null;
  } catch {
    /* no headshot / endpoint error — the initials fallback is shown */
  }

  // `canEdit` covers editing the EXISTING record + nested data — students get
  // this (mirrors backend require_alumni_edit). `canArchive` is the narrower
  // create/archive tier (full_access and up) used only for the Archive control,
  // which the backend keeps on require_full_access (students are 403'd there).
  // `canAdd` additionally lets professors (view_only) log interactions — the
  // backend (fa-web-api#129) permits view_only to POST interactions. It gates
  // ONLY the add-interaction control; it must never unlock any other edit
  // affordance (alumni record, employment, education, tasks, etc.).
  let canEdit = false;
  let canArchive = false;
  let canAdd = false;
  // Deleting a donation is now the donations.manage tier (super_admin+), matching
  // the tightened backend gate — separate from canArchive (full_access) which
  // still governs archive/notes.
  let canDeleteDonation = false;
  // Profile-completeness tab is gated by the editable `profile.completeness`
  // capability (default: super_admin + engineer), toggleable per role in the
  // Engineer Console permission editor. NOTE (#189): this is a CLIENT-SIDE
  // DISPLAY gate only — there is no backend endpoint guarded by this capability,
  // and the completeness % is computed here from the already-VIEW-accessible
  // profile. Toggling it hides/shows the tab; it does not protect any data a
  // viewer couldn't already derive. See the matching note in the backend
  // capabilities registry.
  let canViewCompleteness = false;
  try {
    const ctx = await apiGet<UserContext>("/auth/context");
    canEdit = canEditAlumni(ctx.roles);
    canArchive = hasFullAccess(ctx.roles);
    canDeleteDonation = isUserAdmin(ctx.roles);
    canAdd = canAddInteraction(ctx.roles);
    canViewCompleteness = (ctx.capabilities ?? []).includes(
      "profile.completeness",
    );
  } catch {
    /* not provisioned → view-only */
  }

  // Contact PII (personal/work email, phone, street address, ZIP) is shown only
  // to editors — defense-in-depth for #166. The backend nulls these fields for
  // the view_only role; this keeps the client from rendering them regardless.
  // Directory-like location (city/state/country) and LinkedIn stay visible to
  // every role, matching the backend minimization.
  const canViewContactDetails = canEdit;

  const a = profile.alumni;
  const c = profile.contact;
  const career = profile.current_career;
  const aid = a.alumni_id;
  const name =
    [a.preferred_first_name ?? a.first_name, a.last_name]
      .filter(Boolean)
      .join(" ") || "Alumni";
  const initials =
    (a.first_name?.[0] ?? name[0] ?? "?") + (a.last_name?.[0] ?? "");
  const recordStatus = a.archived
    ? "Archived"
    : a.deceased
      ? "Deceased"
      : "Active";

  // KPI derivations
  const openTasks = profile.tasks.filter((t) => !t.completed);
  // Most recent completed survey → "Last surveyed" KPI.
  const lastSurveyedIso =
    [...profile.surveys]
      .filter((s) => s.completed_at)
      .sort((x, y) =>
        (y.completed_at ?? "").localeCompare(x.completed_at ?? ""),
      )[0]?.completed_at ?? null;

  // ---- Backend contract (profile detail payload) --------------------------
  // Fields a separate backend agent is adding to `GET /alumni/{id}/profile`.
  // Read via optional access (typed extension casts) so a not-yet-deployed
  // backend simply renders an em-dash instead of failing to compile.
  const careerExtra = career as
    | (NonNullable<typeof career> & { company_address?: string | null })
    | null;
  const profileExtra = profile as typeof profile & {
    next_survey_date?: string | null;
  };


  // Next scheduled survey (#364) — prefer a backend-provided date, else derive
  // the nearest not-yet-completed due date from the survey list.
  const nextSurveyIso =
    profileExtra.next_survey_date ??
    profile.surveys
      .filter((s) => !s.completed && !!s.survey_due_date)
      .sort((x, y) =>
        (x.survey_due_date ?? "").localeCompare(y.survey_due_date ?? ""),
      )[0]?.survey_due_date ??
    null;

  // Career Snapshot employment (#367): the current role (from current_career,
  // falling back to the flagged current employment-history row) plus the two
  // most-recent previous roles from employment history.
  const currentEmp =
    profile.employment_history.find((e) => e.is_current) ?? null;
  const currentJob = career
    ? {
        title: career.current_title,
        company: career.current_employer,
        // Location comes from the contact record (single source of truth for the
        // person's current city/state, populated by import) — the career
        // current_city/current_state pair is an employer field the import never
        // writes and is almost always blank.
        city: c?.city,
        state: c?.state,
      }
    : currentEmp
      ? {
          title: currentEmp.employment_title,
          company: currentEmp.employer_name,
          city: currentEmp.city,
          state: currentEmp.state,
        }
      : null;
  const previousJobsAll = [...profile.employment_history]
    .filter((e) => !e.is_current)
    .sort(
      (x, y) =>
        (y.end_year ?? y.start_year ?? 0) - (x.end_year ?? x.start_year ?? 0),
    );
  const previousJobs = previousJobsAll.slice(0, 2);

  // Graduate degrees & designations box (#399/#405): graduate degree/school from
  // the alumni record, plus held certifications from program engagement (a
  // non-empty free-text value = held) surfaced as their standard abbreviation
  // with a full-name tooltip. `other_designations` is rendered as free text.
  const pe = profile.program_engagement;
  const heldDesignations = [
    pe?.cfp_designation ? "CFP" : null,
    pe?.cfa_designation ? "CFA" : null,
    pe?.cpa_designation ? "CPA" : null,
  ].filter(Boolean) as string[];
  const hasGradContent = Boolean(
    a.graduate_degree ||
      a.graduate_school ||
      heldDesignations.length ||
      a.other_designations,
  );

  // Pay It Forward summary (#403) — always present on the profile payload.
  // `last_donation_amount` / `total_lifetime_amount` are DOLLAR amounts gated
  // server-side (null for callers without full access); `donation_count` and
  // `last_donation_date` stay visible to every role.
  const pif = profile.pay_it_forward;

  // Completeness checks (mirror the Figma checklist)
  const checks: { label: string; ok: boolean }[] = [
    { label: "Profile photo", ok: Boolean(headshotUrl) },
    {
      label: "At least one job",
      ok: Boolean(career?.current_employer) || profile.employment_history.length > 0,
    },
    { label: "Email", ok: Boolean(c?.personal_email || c?.work_email) },
    { label: "Cell phone", ok: Boolean(c?.phone) },
    { label: "City & state", ok: Boolean(c?.city && c?.state) },
    { label: "Mailing ZIP code", ok: Boolean(c?.zip) },
    { label: "LinkedIn", ok: Boolean(a.linkedin_url) },
    { label: "Graduation year", ok: Boolean(a.graduation_year) },
    { label: "Current industry", ok: Boolean(career?.current_industry) },
    { label: "Gender", ok: Boolean(a.gender) },
    { label: "Birthday", ok: Boolean(a.birth_date) },
    { label: "Marital status", ok: Boolean(a.marital_status) },
    { label: "Home country", ok: Boolean(a.home_country) },
    { label: "Work email", ok: Boolean(c?.work_email) },
    { label: "Company address", ok: Boolean(careerExtra?.company_address) },
  ];
  const completeCount = checks.filter((x) => x.ok).length;
  const completeness = Math.round((completeCount / checks.length) * 100);
  const missing = checks.filter((x) => !x.ok);
  // Completeness badge — derived purely from the real filled/total field count
  // above (never a fabricated score). Tone pairs with a text label so we never
  // rely on color alone.
  const completenessTone: "success" | "warning" | "danger" =
    completeness >= 80 ? "success" : completeness >= 50 ? "warning" : "danger";
  const completenessLabel =
    completeness >= 80
      ? "Complete"
      : completeness >= 50
        ? "Needs detail"
        : "Sparse";

  return (
    <>
      {/* Top bar (fixed; only the content below scrolls) */}
      <Topbar
        breadcrumb={[{ label: "Alumni", href: "/alumni" }, { label: name }]}
      >
        <TopbarSearch />
      </Topbar>

      <main className="flex-1 overflow-y-auto bg-gray-100 p-4 md:p-6">
        <div className="mx-auto max-w-6xl space-y-4">
          {/* Header card */}
          <div className="rounded-lg border border-gray-200 bg-white p-5 shadow-card">
            <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
              <div className="flex items-center gap-4">
                <ProfileHeadshot
                  alumniId={aid}
                  initialUrl={headshotUrl}
                  name={name}
                  initials={initials}
                  size="h-48 w-48 text-5xl"
                  colorClass={avatarColor(initials)}
                  canManage={canArchive}
                />
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 className="text-3xl font-semibold text-gray-900">{name}</h2>
                    {a.preferred_first_name &&
                    a.preferred_first_name.trim().toLowerCase() !==
                      (a.first_name ?? "").trim().toLowerCase() ? (
                      <EngagementChip tone="neutral">
                        Goes by “{a.preferred_first_name}”
                      </EngagementChip>
                    ) : null}
                    {recordStatus !== "Active" ? (
                      <Badge variant="muted">
                        <span className="h-1.5 w-1.5 rounded-full bg-gray-400" />
                        {recordStatus}
                      </Badge>
                    ) : null}
                  </div>
                  {/* BYU ID and BYU Net ID removed from the header (#361) — the
                      Net ID now lives in the Personal & family box; the BYU ID
                      number is not rendered in the UI at all. */}
                  {a.graduation_year ? (
                    <p className="mt-1 text-base text-gray-500">
                      Class of {a.graduation_year}
                    </p>
                  ) : null}
                  {/* Job title on its own line, company name underneath (#363);
                      the job/city icons are removed (#362). */}
                  <div className="mt-1.5 space-y-0.5 text-base text-gray-600">
                    {career?.current_title ? (
                      <p className="font-medium text-gray-900">
                        {career.current_title}
                      </p>
                    ) : null}
                    {career?.current_employer ? (
                      <p>{career.current_employer}</p>
                    ) : null}
                    {place(c?.city, c?.state) ? (
                      <p className="text-sm text-gray-500">
                        {place(c?.city, c?.state)}
                      </p>
                    ) : null}
                    {/* Employment status (#306) — text-only label. */}
                    {a.employment_status ? (
                      <p className="text-sm text-gray-500">
                        {a.employment_status}
                      </p>
                    ) : null}
                  </div>

                  {/* Contact info lifted into the header (#223): email, phone,
                      and mailing address are visible right next to the name.
                      Text-only (no icons) per the design rules; the full
                      breakdown still lives in the Overview "Contact
                      information" panel. */}
                  <HeaderContact
                    contact={c}
                    linkedinUrl={a.linkedin_url}
                    canViewContactDetails={canViewContactDetails}
                  />
                </div>
              </div>

              {canAdd ? (
                <div className="flex shrink-0 flex-wrap items-center gap-2">
                  {/* Add-interaction is the only header control professors
                      (view_only) get — gated on canAdd. Every other control
                      below stays on canEdit so professors never gain edits to
                      the alumni record, tasks, exports, or archive state. */}
                  <AddInteractionButton alumniId={aid} label="Add interaction" />
                  {canEdit ? (
                    <>
                      <AddTaskButton alumniId={aid} label="Create task" />
                      {/* Export is a full_access action (audited server
                          endpoint), so it's gated to canArchive (hasFullAccess)
                          — students and professors never see it. */}
                      {canArchive ? (
                        <ExportProfileButton
                          alumniId={aid}
                          fileBaseName={`${name.replace(/\s+/g, "-").toLowerCase()}-${aid}`}
                        />
                      ) : null}
                      <Button asChild>
                        <Link href={`/alumni/${aid}/edit`}>Edit</Link>
                      </Button>
                      {canArchive ? (
                        <ArchiveControls
                          alumniId={aid}
                          archived={a.archived}
                          name={name}
                        />
                      ) : null}
                    </>
                  ) : null}
                </div>
              ) : null}
            </div>

            {(profile.tags.length || profile.status_labels.length) > 0 ? (
              <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-gray-100 pt-4">
                <span className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                  Tags
                </span>
                {profile.tags.map((t) => (
                  <EngagementChip
                    key={t}
                    tone="tag"
                  >
                    {t}
                  </EngagementChip>
                ))}
                {profile.status_labels.map((s) => (
                  <EngagementChip key={s} tone="neutral">
                    {s}
                  </EngagementChip>
                ))}
              </div>
            ) : null}
          </div>

          {/* KPI strip — 6 non-sensitive tiles, shown for every role.
              "Graduating class" is the named cohort (graduation_class, falling
              back to graduation_year); "Graduated" is the specific semester +
              year once both are on file. */}
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
            <MetricCard
              label="Graduating class"
              value={
                a.graduation_class
                  ? `Class of ${a.graduation_class}`
                  : a.graduation_year
                    ? `Class of ${a.graduation_year}`
                    : "—"
              }
            />
            <MetricCard
              label="Graduated"
              value={
                a.graduation_semester && a.graduation_year
                  ? `${a.graduation_semester} ${a.graduation_year}`
                  : "—"
              }
            />
            <MetricCard label="Interactions" value={profile.interaction_count} />
            <MetricCard label="Events attended" value={profile.events.length} />
            {/* Pay It Forward giving (#365/#403) — last gift amount + lifetime
                total, both pre-gated by the backend (Restricted when the caller
                may not see dollar figures; em-dash when there are no gifts). */}
            <StackedTile
              topLabel="Last donated"
              topValue={
                pif.donation_count > 0 ? (
                  pif.last_donation_amount !== null ? (
                    money(pif.last_donation_amount)
                  ) : (
                    <span className="text-gray-400">Restricted</span>
                  )
                ) : (
                  "—"
                )
              }
              bottomLabel="Total given"
              bottomValue={
                pif.donation_count > 0 ? (
                  pif.total_lifetime_amount !== null ? (
                    money(pif.total_lifetime_amount)
                  ) : (
                    <span className="text-gray-400">Restricted</span>
                  )
                ) : (
                  "—"
                )
              }
              title="Pay It Forward giving"
            />
            {/* Last updated + Next survey combined into one stacked tile (#364),
                kept as the last tile in the row. */}
            <StackedTile
              topLabel="Last updated"
              topValue={fmtDate(a.profile_updated_date ?? a.updated_at) ?? "—"}
              bottomLabel="Next survey"
              bottomValue={fmtDate(nextSurveyIso) ?? "—"}
              title={
                a.profile_updated_by_name || a.profile_updated_by
                  ? `Updated by ${a.profile_updated_by_name ?? a.profile_updated_by}`
                  : undefined
              }
            />
          </div>

          {/* Secondary-nav tabs organize the long profile into Overview /
              Interactions / Education / Tasks. Every panel below is built on the
              server with the already-fetched data and handed to the client tab
              island as props — no fetching, gating, or business logic moves to
              the client. */}
          <AlumniProfileTabs
            overview={
              <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
              {/* LEFT column, row 1 — Career snapshot (#399: swapped with Current
                  employment, which now sits on the right). Current role on top,
                  then the two most recent previous roles under a "Previous
                  employment" heading. Employment drawn from employment history. */}
              <Panel
                title="Career snapshot"
                action={canEdit ? <EditLink id={aid} /> : undefined}
                className="lg:col-span-1"
              >
                <div className="flex h-full flex-col">
                  {currentJob || previousJobs.length ? (
                    <div className="space-y-4">
                      {currentJob ? (
                        <div>
                          <p className="text-sm font-semibold text-gray-900">
                            {currentJob.title ?? "—"}
                          </p>
                          <p className="text-sm text-gray-600">
                            {currentJob.company ?? "—"}
                          </p>
                          {place(currentJob.city, currentJob.state) ? (
                            <p className="mt-0.5 text-xs text-gray-500">
                              {place(currentJob.city, currentJob.state)}
                            </p>
                          ) : null}
                        </div>
                      ) : null}
                      {previousJobs.length ? (
                        <div className="border-t border-gray-100 pt-4">
                          <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-gray-500">
                            Previous employment
                          </p>
                          <div className="space-y-3">
                            {previousJobs.map((e) => (
                              <div key={e.employment_history_id}>
                                <div className="flex items-start justify-between gap-2">
                                  <p className="text-sm font-semibold text-gray-900">
                                    {e.employment_title ?? "—"}
                                  </p>
                                  <span className="shrink-0 text-xs tabular-nums text-gray-500">
                                    {e.start_year ?? "—"} – {e.end_year ?? "—"}
                                  </span>
                                </div>
                                <p className="text-sm text-gray-600">
                                  {e.employer_name ?? "—"}
                                </p>
                                {place(e.city, e.state) ? (
                                  <p className="mt-0.5 text-xs text-gray-500">
                                    {place(e.city, e.state)}
                                  </p>
                                ) : null}
                              </div>
                            ))}
                          </div>
                        </div>
                      ) : null}
                    </div>
                  ) : (
                    <p className="py-6 text-center text-sm text-gray-500">
                      No employment on file yet.
                    </p>
                  )}
                  {/* Persistent link to the full Employment tab. */}
                  <Link
                    href="?tab=employment"
                    className="mt-auto pt-4 text-sm font-medium text-brand-blue-600 hover:text-brand-blue-500"
                  >
                    View full employment history →
                  </Link>
                </div>
              </Panel>

              {/* RIGHT column, row 1 — Current employment contact information
                  (#366, #399: swapped to the right, keeps its 2-col width). Work
                  email is contact PII (editor-gated); LinkedIn and directory-like
                  company location stay visible to every role. */}
              <Panel
                title="Current employment contact information"
                action={canEdit ? <EditLink id={aid} /> : undefined}
                className="lg:col-span-2"
              >
                {/* Split into two columns of three (#profile tweak): work email
                    + address + city on the left, state + country + ZIP on the
                    right. LinkedIn moved to Personal & family. */}
                <div className="grid grid-cols-1 gap-x-6 gap-y-4 sm:grid-cols-2">
                  <div className="space-y-4">
                    {canViewContactDetails ? (
                      <ContactField
                        label="Work email"
                        value={c?.work_email ?? null}
                        href={c?.work_email ? `mailto:${c.work_email}` : undefined}
                        hrefLabel="Send"
                        preferred={c?.preferred_contact_method === "work_email"}
                      />
                    ) : null}
                    <Field
                      label="Company address"
                      value={careerExtra?.company_address ?? null}
                    />
                    <Field
                      label="Current city"
                      value={c?.city ?? null}
                    />
                  </div>
                  <div className="space-y-4">
                    <Field
                      label="Current state"
                      value={c?.state ?? null}
                    />
                    <Field
                      label="Company country"
                      value={career?.current_country ?? null}
                    />
                    <Field label="Company ZIP" value={career?.current_zip ?? null} />
                  </div>
                </div>
                {/* LinkedIn spans the full width at the bottom of the box. */}
                <div className="mt-4">
                  <ContactField
                    label="LinkedIn profile"
                    value={a.linkedin_url}
                    href={a.linkedin_url ?? undefined}
                    hrefLabel="Open ↗"
                    preferred={c?.preferred_contact_method === "linkedin"}
                  />
                </div>
              </Panel>

              {/* LEFT column, row 2 — Graduate degrees & designations (#399 new
                  box, same 1-col width as Career snapshot above it). Populated
                  from existing profile fields; designation abbreviations carry a
                  full-name tooltip (#405). */}
              <Panel
                title="Graduate degrees & designations"
                action={canEdit ? <EditLink id={aid} /> : undefined}
                className="lg:col-span-1"
              >
                {hasGradContent ? (
                  <div className="space-y-4">
                    {a.graduate_degree || a.graduate_school ? (
                      <div className="space-y-4">
                        <Field
                          label="Graduate degree"
                          value={a.graduate_degree}
                        />
                        <Field
                          label="Graduate school"
                          value={a.graduate_school}
                        />
                      </div>
                    ) : null}
                    {heldDesignations.length ? (
                      <ChipRow label="Designations">
                        {heldDesignations.map((d) => (
                          <EngagementChip key={d} tone="success">
                            <DesignationAbbr token={d} />
                          </EngagementChip>
                        ))}
                      </ChipRow>
                    ) : null}
                    {a.other_designations ? (
                      <OtherDesignations text={a.other_designations} />
                    ) : null}
                  </div>
                ) : (
                  <p className="py-6 text-center text-sm text-gray-500">
                    No graduate degrees or designations on file yet.
                  </p>
                )}
              </Panel>

              {/* RIGHT column, row 2 — Personal & family (#366, #399: shrunk from
                  full width to the same 2-col width as Current employment).
                  Fields arranged into three columns (#402): contact · household ·
                  identity/origin. Personal email + cell phone are contact PII
                  (editor-gated). Spouse shows the FIRST name only. */}
              <Panel
                title="Personal & family"
                action={canEdit ? <EditLink id={aid} /> : undefined}
                className="lg:col-span-2"
              >
                <div className="grid grid-cols-1 gap-x-6 gap-y-4 sm:grid-cols-3">
                  {/* Col 1: personal email · cell phone · gender */}
                  <div className="space-y-4">
                    {canViewContactDetails ? (
                      <>
                        <ContactField
                          label="Personal email"
                          value={c?.personal_email ?? null}
                          href={
                            c?.personal_email
                              ? `mailto:${c.personal_email}`
                              : undefined
                          }
                          hrefLabel="Send"
                          preferred={
                            c?.preferred_contact_method === "personal_email"
                          }
                        />
                        <ContactField
                          label="Cell phone"
                          value={c?.phone ?? null}
                          href={c?.phone ? `tel:${c.phone}` : undefined}
                          hrefLabel="Call"
                          preferred={c?.preferred_contact_method === "phone"}
                        />
                      </>
                    ) : null}
                    <Field label="Gender" value={a.gender} />
                  </div>
                  {/* Col 2: marital status · spouse · birthday */}
                  <div className="space-y-4">
                    <Field label="Marital status" value={a.marital_status} />
                    {/* First name ONLY — never render the spouse's last name. */}
                    <Field label="Spouse" value={a.spouse_first_name} />
                    <Field label="Birthday" value={fmtDate(a.birth_date)} />
                  </div>
                  {/* Col 3: net id · home country */}
                  <div className="space-y-4">
                    <Field label="BYU Net ID" value={a.net_id} />
                    <Field label="Home country" value={a.home_country} />
                  </div>
                </div>
              </Panel>

              </div>
            }
            profileCompleteness={
              // Its own tab, gated by the editable `profile.completeness`
              // capability (default super_admin + engineer; toggleable per role
              // in the Engineer Console permission editor). Omitted entirely
              // when the viewer doesn't hold the capability.
              canViewCompleteness ? (
                <Panel title="Profile completeness">
                  <div className="mb-3 flex items-end justify-between">
                    <span className="text-3xl font-semibold tabular-nums text-gray-900">
                      {completeness}%
                    </span>
                    <Badge variant={completenessTone}>
                      {completenessLabel}
                    </Badge>
                  </div>
                  <Progress
                    value={completeness}
                    className="mb-4"
                    barClassName={
                      completenessTone === "success"
                        ? "bg-success-600"
                        : completenessTone === "warning"
                          ? "bg-warning-600"
                          : "bg-danger-600"
                    }
                  />
                  <ul className="space-y-2">
                    {checks.map((ck) => (
                      <li
                        key={ck.label}
                        className="flex items-center justify-between text-sm"
                      >
                        <span className="flex items-center gap-2 text-gray-700">
                          {ck.ok ? (
                            <Check className="h-4 w-4 text-success-600" />
                          ) : (
                            <CircleAlert className="h-4 w-4 text-warning-600" />
                          )}
                          {ck.label}
                        </span>
                        <span
                          className={`text-xs font-medium ${ck.ok ? "text-success-600" : "text-warning-600"}`}
                        >
                          {ck.ok ? "Complete" : "Missing"}
                        </span>
                      </li>
                    ))}
                  </ul>
                  {canEdit && missing.length ? (
                    <Button asChild variant="secondary" className="mt-4 w-full">
                      <Link href={`/alumni/${aid}/edit`}>Add missing info</Link>
                    </Button>
                  ) : null}
                </Panel>
              ) : undefined
            }
            engagement={
              // Engagement & tags is an editor tool — the tab only renders for
              // users who can edit (AlumniProfileTabs omits a tab whose node is
              // undefined), so view-only roles never see it.
              canEdit ? (
                <Panel title="Tags">
                  <div className="space-y-5">
                    <TagStatusManager
                      alumniId={aid}
                      tags={profile.tags}
                      statusLabels={profile.status_labels}
                    />
                    {profile.program_engagement ? (
                      <ChipRow label="Program">
                        {programChips(profile.program_engagement).map((label) => (
                          <EngagementChip key={label} tone="success">
                            {label}
                          </EngagementChip>
                        ))}
                      </ChipRow>
                    ) : null}
                  </div>
                </Panel>
              ) : undefined
            }
            interactions={
              /* Interactions timeline (full width) — dedicated #38 deliverable.
                 Interactions only (NOT merged with audit). */
              <InteractionTimeline
                alumniId={aid}
                items={profile.interactions}
                canAdd={canAdd}
                canEdit={canEdit}
                canWriteNotes={canArchive}
              />
            }
            notes={
              /* Unified notes (#39) in their own tab. Visible to every role;
                 writing is full_access (canArchive), re-enforced + audit-logged
                 server-side. ProfileNotes renders its own empty state. */
              <Panel title="Notes">
                <ProfileNotes
                  alumniId={aid}
                  notes={notes}
                  canWrite={canArchive}
                />
              </Panel>
            }
            events={
              /* Recent events / attendance in their own tab (moved off Education).
                 Rendered only when the alumnus has events or the viewer can add
                 them, otherwise the island omits the tab. */
              profile.events.length || canEdit ? (
                <Panel
                  title="Recent events"
                  action={
                    canEdit ? <AddEventButton alumniId={aid} /> : undefined
                  }
                >
                  {profile.events.length ? (
                    <DrawerList
                      title="Recent events"
                      collapsed={5}
                      listClassName="space-y-1"
                      action={
                        canEdit ? <AddEventButton alumniId={aid} /> : undefined
                      }
                    >
                      {profile.events.map((ev) => {
                        const md = monthDay(ev.event_date);
                        return (
                          <li
                            key={ev.event_id}
                            className="flex items-center gap-3 border-b border-gray-100 py-2.5 last:border-0"
                          >
                            <span className="flex h-11 w-11 shrink-0 flex-col items-center justify-center rounded-lg bg-gray-100 text-center">
                              <span className="text-[9px] font-semibold uppercase text-gray-500">
                                {md?.mon ?? "—"}
                              </span>
                              <span className="text-sm font-semibold tabular-nums text-gray-900">
                                {md?.day ?? "--"}
                              </span>
                            </span>
                            <div className="min-w-0 flex-1">
                              <p className="text-sm font-medium text-gray-900">
                                {ev.event_name}
                              </p>
                              <p className="text-xs text-gray-500">
                                {[ev.event_location, ev.event_type]
                                  .filter(Boolean)
                                  .join(" · ")}
                              </p>
                            </div>
                            {ev.attendance_status ? (
                              <EngagementChip tone="neutral">
                                {ev.attendance_status}
                              </EngagementChip>
                            ) : null}
                          </li>
                        );
                      })}
                    </DrawerList>
                  ) : (
                    <p className="py-6 text-center text-sm text-gray-500">
                      No events attended yet.
                    </p>
                  )}
                </Panel>
              ) : undefined
            }
            surveys={
              profile.surveys.length ? (
                (() => {
                  // Survey summary (#292): most-recent completed survey, the
                  // nearest upcoming/overdue due date, and the latest survey's
                  // status, shown above the full history table.
                  const surveysSorted = [...profile.surveys].sort(
                    (x, y) =>
                      (y.survey_year ?? 0) - (x.survey_year ?? 0) ||
                      (y.survey_due_date ?? "").localeCompare(
                        x.survey_due_date ?? "",
                      ),
                  );
                  // Most-recent completed survey's completion date; fall back
                  // to the newest survey's completed_at (may be null → "—").
                  const lastCompletedIso =
                    lastSurveyedIso ?? surveysSorted[0]?.completed_at ?? null;
                  // Nearest not-yet-completed due date; overdue when < today
                  // (same past-due basis as the table rows below).
                  const nextDue = profile.surveys
                    .filter((s) => !s.completed && !!s.survey_due_date)
                    .sort((x, y) =>
                      (x.survey_due_date ?? "").localeCompare(
                        y.survey_due_date ?? "",
                      ),
                    )[0];
                  const nextDueIso = nextDue?.survey_due_date ?? null;
                  const nextDueOverdue =
                    !!nextDueIso && new Date(nextDueIso) < new Date();
                  const latestSurvey = surveysSorted[0];
                  const latestOverdue =
                    !!latestSurvey &&
                    !latestSurvey.completed &&
                    !!latestSurvey.survey_due_date &&
                    new Date(latestSurvey.survey_due_date) < new Date();
                  const latestStatusTone: "success" | "danger" | "warning" =
                    latestSurvey?.completed
                      ? "success"
                      : latestOverdue
                        ? "danger"
                        : "warning";
                  const latestStatusLabel =
                    latestSurvey?.survey_status ??
                    (latestSurvey?.completed
                      ? "Completed"
                      : latestOverdue
                        ? "Overdue"
                        : "Pending");
                  return (
                    <Panel
                      title="Survey history"
                      action={
                        // Donation link (#295): quick jump to the Pay It Forward
                        // ledger to record a gift. Secondary text-only action.
                        <Button asChild variant="secondary" size="sm">
                          <Link href="/pay-it-forward">
                            Pay It Forward — record a donation
                          </Link>
                        </Button>
                      }
                    >
                      {/* Summary row (#292) — surfaced above the table. */}
                      <div className="mb-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
                        <MetricCard
                          label="Last survey completed"
                          value={fmtDate(lastCompletedIso) ?? "—"}
                        />
                        <MetricCard
                          label="Next survey due"
                          value={
                            nextDueIso ? (
                              <span
                                className={
                                  nextDueOverdue
                                    ? "text-danger-600"
                                    : undefined
                                }
                              >
                                {fmtDate(nextDueIso)}
                                {nextDueOverdue ? (
                                  <span className="block text-xs font-semibold">
                                    Overdue
                                  </span>
                                ) : null}
                              </span>
                            ) : (
                              "—"
                            )
                          }
                        />
                        <MetricCard
                          label="Latest survey status"
                          value={
                            <Badge variant={latestStatusTone}>
                              {latestStatusLabel}
                            </Badge>
                          }
                        />
                      </div>
                      <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-gray-200 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">
                          <th className="px-3 py-2">Year</th>
                          <th className="px-3 py-2">Due date</th>
                          <th className="px-3 py-2">Status</th>
                          <th className="px-3 py-2">Completed</th>
                          <th className="px-3 py-2">Notes</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100">
                        {[...profile.surveys]
                          .sort(
                            (x, y) =>
                              (y.survey_year ?? 0) - (x.survey_year ?? 0) ||
                              (y.survey_due_date ?? "").localeCompare(
                                x.survey_due_date ?? "",
                              ),
                          )
                          .map((s) => {
                            const overdue =
                              !s.completed &&
                              !!s.survey_due_date &&
                              new Date(s.survey_due_date) < new Date();
                            const tone = s.completed
                              ? "success"
                              : overdue
                                ? "danger"
                                : "warning";
                            const label =
                              s.survey_status ??
                              (s.completed
                                ? "Completed"
                                : overdue
                                  ? "Overdue"
                                  : "Pending");
                            return (
                              <tr key={s.survey_id}>
                                <td className="px-3 py-2 tabular-nums text-gray-900">
                                  {s.survey_year ?? "—"}
                                </td>
                                <td className="px-3 py-2 text-gray-600">
                                  {fmtDate(s.survey_due_date) ?? "—"}
                                </td>
                                <td className="px-3 py-2">
                                  <Badge variant={tone}>{label}</Badge>
                                </td>
                                <td className="px-3 py-2 text-gray-600">
                                  {fmtDate(s.completed_at) ?? "—"}
                                </td>
                                <td className="max-w-xs truncate px-3 py-2 text-gray-500">
                                  {s.survey_notes || "—"}
                                </td>
                              </tr>
                            );
                          })}
                      </tbody>
                    </table>
                      </div>
                    </Panel>
                  );
                })()
              ) : undefined
            }
            employment={
              <div>
                {/* Employment history — its own tab, full width. */}
                <Panel
                  title="Employment history"
                  action={canEdit ? <AddRoleButton alumniId={aid} /> : undefined}
                >
                  {career || profile.employment_history.length ? (
                    <DrawerList
                      title="Employment history"
                      ordered
                      collapsed={3}
                      listClassName="space-y-1"
                      action={
                        canEdit ? <AddRoleButton alumniId={aid} /> : undefined
                      }
                    >
                      {/* Current role lives in current-employment (not history),
                          so surface it here so the tab lists the current job. */}
                      {career ? (
                        <li className="flex gap-3 border-b border-gray-100 py-3 last:border-0">
                          <span
                            className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-xs font-semibold text-white ${avatarColor(career.current_employer ?? "?")}`}
                          >
                            {(career.current_employer ?? "?")[0]?.toUpperCase()}
                          </span>
                          <div className="min-w-0 flex-1">
                            <div className="flex items-start justify-between gap-2">
                              <p className="text-sm font-semibold text-gray-900">
                                {career.current_employer ?? "—"}
                                <Badge variant="success" className="ml-2">
                                  Current
                                </Badge>
                              </p>
                              <span className="text-xs tabular-nums text-gray-500">
                                Present
                              </span>
                            </div>
                            <p className="text-sm text-gray-600">
                              {career.current_title ?? "—"}
                            </p>
                            {place(c?.city, c?.state) ? (
                              <p className="text-xs text-gray-500">
                                {place(c?.city, c?.state)}
                              </p>
                            ) : null}
                          </div>
                        </li>
                      ) : null}
                      {profile.employment_history.map((e) => (
                        <li
                          key={e.employment_history_id}
                          className="flex gap-3 border-b border-gray-100 py-3 last:border-0"
                        >
                          <span
                            className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-xs font-semibold text-white ${avatarColor(e.employer_name ?? "?")}`}
                          >
                            {(e.employer_name ?? "?")[0]?.toUpperCase()}
                          </span>
                          <div className="min-w-0 flex-1">
                            <div className="flex items-start justify-between gap-2">
                              <p className="text-sm font-semibold text-gray-900">
                                {e.employer_name ?? "—"}
                                {e.is_current ? (
                                  <Badge variant="success" className="ml-2">
                                    Current
                                  </Badge>
                                ) : null}
                              </p>
                              <div className="flex shrink-0 items-center gap-2">
                                <span className="text-xs tabular-nums text-gray-500">
                                  {e.start_year ?? "—"} –{" "}
                                  {e.is_current
                                    ? "Present"
                                    : (e.end_year ?? "—")}
                                </span>
                                {canEdit ? (
                                  <EmploymentRowActions alumniId={aid} row={e} />
                                ) : null}
                              </div>
                            </div>
                            <p className="text-sm text-gray-600">
                              {e.employment_title ?? "—"}
                            </p>
                            <p className="text-xs text-gray-500">
                              {[e.employment_industry, place(e.city, e.state)]
                                .filter(Boolean)
                                .join(" · ")}
                            </p>
                          </div>
                        </li>
                      ))}
                    </DrawerList>
                  ) : (
                    <p className="py-6 text-center text-sm text-gray-500">
                      No employment history recorded yet.
                    </p>
                  )}
                </Panel>
              </div>
            }
            education={(() => {
              // Equal-height panels (#235-adjacent request): collect every
              // panel that should render, then lay them out in a 2-column grid
              // so panels sharing a row stretch to the tallest one (bottoms
              // align) regardless of how much data each holds. Leadership now
              // lives in this same grid instead of a fixed side rail, so the
              // layout no longer reshapes based on which data is present. A
              // lone panel spans full width instead of sitting at half width.
              const panels: React.ReactNode[] = [];

              if (profile.education.length || canEdit) {
                panels.push(
                  <Panel
                    key="education"
                    title="Education"
                    className="flex h-full flex-col"
                    contentClassName="flex-1"
                    action={
                      canEdit ? <AddEducationButton alumniId={aid} /> : undefined
                    }
                  >
                    {profile.education.length ? (
                      <DrawerList
                        title="Education"
                        collapsed={3}
                        listClassName="space-y-1"
                        action={
                          canEdit ? (
                            <AddEducationButton alumniId={aid} />
                          ) : undefined
                        }
                      >
                        {profile.education.map((ed) => {
                          // Lead with the degree + major (what people scan
                          // for); fall back to the university when no degree is
                          // recorded so the row is never blank (#221).
                          const degreeLine =
                            [ed.degree, ed.major].filter(Boolean).join(" · ") ||
                            null;
                          const meta = [
                            ed.college,
                            ed.department,
                            ed.degree_status,
                          ]
                            .filter(Boolean)
                            .join(" · ");
                          return (
                            <li
                              key={ed.education_id}
                              className="border-b border-gray-100 py-3 last:border-0"
                            >
                              <div className="flex items-start justify-between gap-2">
                                <div className="min-w-0 flex-1">
                                  <p className="text-sm font-semibold text-gray-900">
                                    {degreeLine ?? ed.university ?? "—"}
                                  </p>
                                  {degreeLine && ed.university ? (
                                    <p className="text-sm text-gray-600">
                                      {ed.university}
                                    </p>
                                  ) : null}
                                  {meta ? (
                                    <p className="mt-0.5 text-xs text-gray-500">
                                      {meta}
                                    </p>
                                  ) : null}
                                </div>
                                <div className="flex shrink-0 items-center gap-2">
                                  {ed.degree_year ? (
                                    <Badge variant="neutral">
                                      {ed.degree_year}
                                    </Badge>
                                  ) : null}
                                  {canEdit ? (
                                    <EducationRowActions
                                      alumniId={aid}
                                      row={ed}
                                    />
                                  ) : null}
                                </div>
                              </div>
                            </li>
                          );
                        })}
                      </DrawerList>
                    ) : (
                      <p className="py-6 text-center text-sm text-gray-500">
                        No education on file yet.
                      </p>
                    )}
                  </Panel>,
                );
              }

              // Finance Society leadership — now a grid peer (was a side
              // rail); still hidden entirely when there's no leadership.
              if (profile.leadership.length) {
                panels.push(
                  <Panel
                    key="leadership"
                    title="Finance Society leadership"
                    className="flex h-full flex-col"
                    contentClassName="flex-1"
                    action={
                      canEdit ? (
                        <AddLeadershipButton alumniId={aid} />
                      ) : undefined
                    }
                  >
                    <DrawerList
                      title="Finance Society leadership"
                      collapsed={3}
                      listClassName="space-y-1"
                      action={
                        canEdit ? (
                          <AddLeadershipButton alumniId={aid} />
                        ) : undefined
                      }
                    >
                      {profile.leadership.map((le) => (
                        <li
                          key={le.finance_society_leadership_id}
                          className="flex items-center gap-3 border-b border-gray-100 py-2.5 last:border-0"
                        >
                          <div className="min-w-0 flex-1">
                            <p className="text-sm font-medium text-gray-900">
                              {le.leadership_role}
                            </p>
                          </div>
                          <div className="flex shrink-0 items-center gap-2">
                            <span className="text-xs tabular-nums text-gray-500">
                              {le.role_year ?? "—"}
                            </span>
                            {canEdit ? (
                              <LeadershipRowActions alumniId={aid} row={le} />
                            ) : null}
                          </div>
                        </li>
                      ))}
                    </DrawerList>
                  </Panel>,
                );
              }

              // Additional education — top-level school/program names (#47).
              // graduate_degree stays in the Career snapshot panel; these are
              // the secondary-education fields. Only rendered when at least
              // one has a value, and each row is suppressed when empty.
              if (
                [
                  a.mba_program,
                  a.law_school,
                  a.medical_school,
                  a.graduate_school,
                ].some(Boolean)
              ) {
                panels.push(
                  <Panel
                    key="additional-education"
                    title="Additional education"
                    className="flex h-full flex-col"
                    contentClassName="flex-1"
                  >
                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                      {a.mba_program ? (
                        <Field label="MBA program" value={a.mba_program} />
                      ) : null}
                      {a.law_school ? (
                        <Field label="Law school" value={a.law_school} />
                      ) : null}
                      {a.medical_school ? (
                        <Field
                          label="Medical school"
                          value={a.medical_school}
                        />
                      ) : null}
                      {a.graduate_school ? (
                        <Field
                          label="Graduate school"
                          value={a.graduate_school}
                        />
                      ) : null}
                    </div>
                  </Panel>,
                );
              }

              // Secondary affiliations — narrative free-text (#47). Only
              // rendered when at least one field has a value; empty fields
              // are suppressed.
              if (
                [
                  a.startup_involvement,
                  a.advisory_roles,
                  a.secondary_employment,
                ].some(Boolean)
              ) {
                panels.push(
                  <Panel
                    key="secondary-affiliations"
                    title="Secondary affiliations"
                    className="flex h-full flex-col"
                    contentClassName="flex-1"
                  >
                    <div className="space-y-4">
                      {a.startup_involvement ? (
                        <ProfileNote
                          label="Startup involvement"
                          value={a.startup_involvement}
                        />
                      ) : null}
                      {a.advisory_roles ? (
                        <ProfileNote
                          label="Advisory roles"
                          value={a.advisory_roles}
                        />
                      ) : null}
                      {a.secondary_employment ? (
                        <ProfileNote
                          label="Secondary employment"
                          value={a.secondary_employment}
                        />
                      ) : null}
                    </div>
                  </Panel>,
                );
              }

              return (
                <div
                  className={
                    panels.length === 1
                      ? ""
                      : "grid grid-cols-1 gap-4 lg:grid-cols-2 lg:items-stretch"
                  }
                >
                  {panels}
                </div>
              );
            })()}
            designations={(() => {
              // Other Designations tab (#307): the free-text `other_designations`
              // field plus the free-text CFA/CFP/CPA certifications (from
              // program_engagement) shown for context. Each designation stores
              // its own label (e.g. "CFA all 3 levels"), so render the value
              // verbatim when present. Renders a friendly empty state when
              // nothing is on file, so the tab always appears.
              const pe = profile.program_engagement;
              const certs = [
                pe?.cfa_designation || null,
                pe?.cfp_designation || null,
                pe?.cpa_designation || null,
              ].filter(Boolean) as string[];
              return (
                <Panel title="Designations">
                  {a.other_designations || certs.length ? (
                    <div className="space-y-5">
                      {a.other_designations ? (
                        <ProfileNote
                          label="Other designations"
                          value={a.other_designations}
                        />
                      ) : null}
                      {certs.length ? (
                        <ChipRow label="Certifications">
                          {certs.map((cert) => (
                            <EngagementChip key={cert} tone="success">
                              {cert}
                            </EngagementChip>
                          ))}
                        </ChipRow>
                      ) : null}
                    </div>
                  ) : (
                    <p className="py-6 text-center text-sm text-gray-500">
                      No designations on file yet.
                    </p>
                  )}
                </Panel>
              );
            })()}
            tasks={
              /* Open tasks — visible to admins (full_access / super_admin) only.
                 Rendered only when canEdit so the Tasks tab itself is omitted for
                 view-only roles (the island skips a tab with no node). */
              canEdit ? (
                <Panel
                  title={`Open tasks (${openTasks.length})`}
                  action={
                    <AddTaskButton alumniId={aid} label="+ New task" />
                  }
                >
                  {openTasks.length ? (
                    <ul className="space-y-3">
                      {openTasks.map((t) => {
                        const overdue =
                          t.due_date && new Date(t.due_date) < new Date();
                        return (
                          <li key={t.follow_up_task_id} className="flex gap-3">
                            <TaskCheckbox
                              alumniId={aid}
                              taskId={t.follow_up_task_id}
                              completed={t.completed}
                              disabled={!canEdit}
                            />
                            <div className="min-w-0 flex-1">
                              <div className="flex items-start justify-between gap-2">
                                <p className="text-sm font-medium text-gray-900">
                                  {t.task_title ?? "Untitled task"}
                                </p>
                                <Badge
                                  variant={overdue ? "warning" : "neutral"}
                                  className="shrink-0"
                                >
                                  {overdue ? "Overdue · " : ""}
                                  {t.due_date ? fmtDate(t.due_date) : "No date"}
                                </Badge>
                              </div>
                              {t.assigned_to ? (
                                <p className="text-xs text-gray-500">
                                  Assigned to {t.assigned_to}
                                </p>
                              ) : null}
                            </div>
                          </li>
                        );
                      })}
                    </ul>
                  ) : (
                    <p className="py-6 text-center text-sm text-gray-500">
                      No open tasks.
                    </p>
                  )}
                </Panel>
              ) : undefined
            }
            payItForward={
              // Only present when the alumnus has donations; shown to every role
              // (amounts gated server-side). The tab is omitted otherwise.
              donations ? (
                // Per-gift delete is now the donations.manage tier (super_admin+),
                // matching the tightened DELETE /donations/{id} gate (#296).
                <AlumniPayItForwardPanel
                  data={donations}
                  canDelete={canDeleteDonation}
                />
              ) : undefined
            }
          />
        </div>
      </main>
    </>
  );
}

/* ----------------------------------------------------- small server helpers */

/** A KPI-strip tile with two stacked label/value rows (top + bottom), matching
 *  the MetricCard surface. Used for the combined "Last updated / Next survey"
 *  tile (#364) and the "Pay It Forward" giving tile (#365). */
function StackedTile({
  topLabel,
  topValue,
  bottomLabel,
  bottomValue,
  title,
}: {
  topLabel: string;
  topValue: React.ReactNode;
  bottomLabel: string;
  bottomValue: React.ReactNode;
  title?: string;
}) {
  return (
    <div
      className="flex h-full flex-col justify-center gap-2 rounded-lg border border-gray-200 bg-white p-4 shadow-card"
      title={title}
    >
      <div>
        <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">
          {topLabel}
        </p>
        <p className="mt-0.5 text-sm font-semibold tabular-nums text-gray-900">
          {topValue}
        </p>
      </div>
      <div className="border-t border-gray-100 pt-2">
        <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">
          {bottomLabel}
        </p>
        <p className="mt-0.5 text-sm font-semibold tabular-nums text-gray-900">
          {bottomValue}
        </p>
      </div>
    </div>
  );
}

function Field({ label, value }: { label: string; value: string | null }) {
  return (
    <div>
      <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">
        {label}
      </p>
      <p className={`text-sm ${value ? "text-gray-900" : "text-gray-300"}`}>
        {value || "—"}
      </p>
    </div>
  );
}

/** Read-only display for a narrative free-text field — preserves the author's
 * line breaks (whitespace-pre-wrap). Callers only render it when `value` is
 * present, so there is no empty state. */
function ProfileNote({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">
        {label}
      </p>
      <p className="whitespace-pre-wrap text-sm text-gray-900">{value}</p>
    </div>
  );
}

/** Renders a designation abbreviation with a full-name tooltip on hover (#405).
 *  Uses a native `<abbr title>` — accessible, text-only, no dependency, matching
 *  the app's existing `title=` tooltip convention. Unknown tokens render as plain
 *  text with no tooltip. */
function DesignationAbbr({ token }: { token: string }) {
  const full = designationFullName(token);
  if (!full) return <>{token}</>;
  return (
    <abbr title={full} className="cursor-help no-underline">
      {token}
    </abbr>
  );
}

/** Free-text `other_designations` (#405) rendered token-by-token so recognized
 *  designations (e.g. "Series 7") pick up a full-name tooltip. When the value
 *  has no delimiters it falls back to a single plain (line-break-preserving)
 *  block. */
function OtherDesignations({ text }: { text: string }) {
  const tokens = splitDesignations(text);
  return (
    <div>
      <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">
        Other designations
      </p>
      {tokens.length > 1 ? (
        <p className="text-sm text-gray-900">
          {tokens.map((tok, i) => (
            <span key={`${tok}-${i}`}>
              {i > 0 ? ", " : ""}
              <DesignationAbbr token={tok} />
            </span>
          ))}
        </p>
      ) : (
        <p className="whitespace-pre-wrap text-sm text-gray-900">
          <DesignationAbbr token={text.trim()} />
        </p>
      )}
    </div>
  );
}

function ChipRow({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-start gap-3">
      <span className="shrink-0 whitespace-nowrap pt-0.5 text-xs font-semibold uppercase tracking-wide text-gray-500">
        {label}
      </span>
      <div className="flex flex-wrap gap-2">{children}</div>
    </div>
  );
}

function programChips(p: Profile["program_engagement"]): string[] {
  if (!p) return [];
  const flags: [boolean, string][] = [
    [p.mentor_willing, "Mentor"],
    [p.guest_speaker_willing, "Guest speaker"],
    [p.nettrek_host_willing, "NetTrek host"],
    [p.finance_conference_willing, "Finance conference"],
    [p.piff_donor, "PIFF donor"],
  ];
  const chips = flags.filter(([on]) => on).map(([, label]) => label);
  // Free-text designations render their stored value (e.g. "CFA all 3 levels").
  for (const designation of [
    p.cfa_designation,
    p.cfp_designation,
    p.cpa_designation,
  ]) {
    if (designation) chips.push(designation);
  }
  return chips;
}
