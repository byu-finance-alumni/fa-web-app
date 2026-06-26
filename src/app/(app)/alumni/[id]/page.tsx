import Link from "next/link";
import { notFound } from "next/navigation";
import {
  GraduationCap,
  Building2,
  Mail,
  Phone,
  Link2,
  MapPin,
  Home,
  Flag,
  CircleAlert,
  Check,
  type LucideIcon,
} from "lucide-react";
import { apiGet, ApiError } from "@/lib/api";
import { daysAgo } from "@/lib/format";
import type { Profile } from "@/types/profile";
import type { UserContext } from "@/types/alumni";
import { canAddInteraction, canEditAlumni, hasFullAccess } from "@/constants/roles";
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
import { ProfileNotes } from "@/components/alumni/ProfileNotes";
import type { Note } from "@/types/notes";
import { ExportProfileButton } from "@/components/alumni/ExportProfileButton";
import { DrawerList } from "@/components/alumni/DrawerList";
import { MetricCard } from "@/components/shared/MetricCard";
import { Avatar } from "@/components/shared/Avatar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";

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

const place = (...parts: (string | null | undefined)[]) =>
  parts.filter(Boolean).join(", ") || null;

/* -------------------------------------------------------- server components */

function Panel({
  title,
  action,
  children,
  className = "",
}: {
  title: string;
  action?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        {action}
      </CardHeader>
      <CardContent>{children}</CardContent>
    </Card>
  );
}

function ContactField({
  icon: Icon,
  label,
  value,
  href,
  hrefLabel,
}: {
  icon: LucideIcon;
  label: string;
  value: string | null;
  href?: string;
  hrefLabel?: string;
}) {
  return (
    <div className="flex items-start gap-3">
      <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-gray-100 text-gray-500">
        <Icon className="h-4 w-4" aria-hidden="true" />
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">
          {label}
        </p>
        <p className={`truncate text-sm ${value ? "text-gray-900" : "text-gray-300"}`}>
          {value || "—"}
        </p>
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
  try {
    const ctx = await apiGet<UserContext>("/auth/context");
    canEdit = canEditAlumni(ctx.roles);
    canArchive = hasFullAccess(ctx.roles);
    canAdd = canAddInteraction(ctx.roles);
  } catch {
    /* not provisioned → view-only */
  }

  const a = profile.alumni;
  const c = profile.contact;
  const career = profile.current_career;
  const aid = a.alumni_id;
  // Spouse display: the typed name, plus a deep-link label when linked to
  // another alumni record (prefer that alumnus's current name).
  const spouseName =
    [a.spouse_first_name, a.spouse_last_name].filter(Boolean).join(" ") || null;
  const spouseLinkLabel =
    profile.spouse_alumni_name ||
    spouseName ||
    (a.spouse_alumni_id ? `Alumnus #${a.spouse_alumni_id}` : null);
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

  // Last-contacted is derived client-side from the newest interaction
  // (interactions arrive newest-first), NOT a backend "score".
  const lastInteraction = profile.interactions[0];
  const lastContactedIso = lastInteraction?.interaction_date_time ?? null;
  // Whole-day difference between calendar dates (same basis as daysAgo), so the
  // tone and the "N days ago" label can never disagree near a threshold.
  const lastContactedDays = (() => {
    if (!lastContactedIso) return null;
    const then = new Date(lastContactedIso);
    if (Number.isNaN(then.getTime())) return null;
    const startOfDay = (d: Date) =>
      new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
    return Math.round((startOfDay(new Date()) - startOfDay(then)) / 864e5);
  })();
  // Stale = no contact in > 180 days; recent = within ~30 days. Tone always
  // pairs with a text label so we never rely on color alone.
  const contactTone: "warning" | "success" | "neutral" =
    lastContactedDays === null
      ? "warning"
      : lastContactedDays > 180
        ? "warning"
        : lastContactedDays <= 30
          ? "success"
          : "neutral";

  // Completeness checks (mirror the Figma checklist)
  const checks: { label: string; ok: boolean }[] = [
    { label: "Contact information", ok: Boolean(c?.personal_email || c?.work_email) },
    { label: "Employment history", ok: profile.employment_history.length > 0 },
    { label: "Mailing ZIP code", ok: Boolean(c?.zip) },
    { label: "Graduate degree", ok: Boolean(a.graduate_degree) },
    { label: "Home phone", ok: Boolean(c?.phone) },
    { label: "Profile photo", ok: false },
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
                <Avatar
                  netId={a.net_id}
                  initials={initials}
                  name={name}
                  size="h-48 w-48 text-5xl"
                  colorClass={avatarColor(initials)}
                />
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 className="text-3xl font-semibold text-gray-900">{name}</h2>
                    {a.preferred_first_name &&
                    a.preferred_first_name !== a.first_name ? (
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
                  <p className="mt-1 text-base text-gray-500">
                    {[
                      a.graduation_year ? `Class of ${a.graduation_year}` : null,
                      a.byu_id ? `BYU ID ${a.byu_id}` : null,
                    ]
                      .filter(Boolean)
                      .join(" · ")}
                  </p>
                  {a.net_id ? (
                    <p className="mt-0.5 text-base text-gray-500">
                      BYU Net ID {a.net_id}
                    </p>
                  ) : null}
                  <div className="mt-1.5 flex flex-wrap items-center gap-x-4 gap-y-1 text-base text-gray-600">
                    {career?.current_employer || career?.current_title ? (
                      <span className="flex items-center gap-1.5">
                        <Building2 className="h-4 w-4 text-gray-400" />
                        {[career?.current_title, career?.current_employer]
                          .filter(Boolean)
                          .join(" · ")}
                      </span>
                    ) : null}
                    {place(c?.city, c?.state) ? (
                      <span className="flex items-center gap-1.5">
                        <MapPin className="h-4 w-4 text-gray-400" />
                        {place(c?.city, c?.state)}
                      </span>
                    ) : null}
                  </div>
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
                  Engagement
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

          {/* KPI strip — 6 non-sensitive tiles, shown for every role. */}
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
            <MetricCard
              label="Year entered program"
              value={a.finance_program_year ?? "—"}
            />
            <MetricCard
              label="Graduation year"
              value={a.graduation_year ?? "—"}
            />
            <MetricCard label="Interactions" value={profile.interaction_count} />
            <MetricCard label="Events attended" value={profile.events.length} />
            <MetricCard
              label="Last updated"
              value={fmtDate(a.updated_at) ?? "—"}
            />
            <MetricCard
              label="Last surveyed"
              value={fmtDate(lastSurveyedIso) ?? "—"}
            />
          </div>

          {/* Secondary-nav tabs organize the long profile into Overview /
              Interactions / Education / Tasks. Every panel below is built on the
              server with the already-fetched data and handed to the client tab
              island as props — no fetching, gating, or business logic moves to
              the client. */}
          <AlumniProfileTabs
            overview={
              <div className="space-y-4">
                <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
                  {/* Main column (wider). */}
                  <div className="flex flex-col gap-4 lg:col-span-2">
              {/* Career snapshot — lead with what they do (before contact info) */}
              <Panel
                title="Career snapshot"
                action={canEdit ? <EditLink id={aid} /> : undefined}
              >
                {career ? (
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <Field label="Current employer" value={career.current_employer} />
                    <Field label="Current title" value={career.current_title} />
                    <Field label="Industry" value={career.current_industry} />
                    <Field label="Seniority level" value={career.seniority_level} />
                    <Field
                      label="Graduate degree"
                      value={a.graduate_degree}
                    />
                    <Field
                      label="Location"
                      value={place(career.current_city, career.current_state)}
                    />
                  </div>
                ) : (
                  <p className="py-6 text-center text-sm text-gray-500">
                    No current employment on file yet.
                  </p>
                )}
              </Panel>

              {/* Contact information */}
              <Panel
                title="Contact information"
                action={canEdit ? <EditLink id={aid} /> : undefined}
              >
                {c ? (
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <ContactField
                      icon={Mail}
                      label="Personal email"
                      value={c.personal_email}
                      href={c.personal_email ? `mailto:${c.personal_email}` : undefined}
                      hrefLabel="Send"
                    />
                    <ContactField
                      icon={Mail}
                      label="Work email"
                      value={c.work_email}
                      href={c.work_email ? `mailto:${c.work_email}` : undefined}
                      hrefLabel="Send"
                    />
                    <ContactField
                      icon={Phone}
                      label="Phone"
                      value={c.phone}
                      href={c.phone ? `tel:${c.phone}` : undefined}
                      hrefLabel="Call"
                    />
                    <ContactField
                      icon={Link2}
                      label="LinkedIn"
                      value={a.linkedin_url}
                      href={a.linkedin_url ?? undefined}
                      hrefLabel="Open ↗"
                    />
                    <ContactField
                      icon={Home}
                      label="Address"
                      value={place(c.address_line_1, c.address_line_2)}
                    />
                    <ContactField icon={MapPin} label="City" value={c.city} />
                    <ContactField
                      icon={MapPin}
                      label="State"
                      value={c.state}
                    />
                    <ContactField
                      icon={Flag}
                      label="Country"
                      value={c.country}
                    />
                  </div>
                ) : (
                  <p className="py-6 text-center text-sm text-gray-500">
                    No contact information on file yet.
                  </p>
                )}
              </Panel>

              {/* Unified notes (#39): free-text notes on this alumnus. Visible to
                  every role; writing is full_access (canArchive), re-enforced and
                  audit-logged server-side. */}
              <Panel title="Notes">
                <ProfileNotes
                  alumniId={aid}
                  notes={notes}
                  canWrite={canArchive}
                />
              </Panel>

            </div>

            {/* Right sidebar (narrower). Same flex-column treatment so it ends
                level with the main column. */}
            <div className="flex flex-col gap-4 lg:[&>:last-child]:flex-1">
              {/* Engagement summary — non-sensitive metrics + tags + derived
                  last-contacted. Shown for all roles (same gating posture as
                  "Engagement & tags"). Last-contacted comes from the newest
                  interaction, not a backend score. */}
              <Panel title="Engagement summary">
                <div className="space-y-4">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                      Last contacted
                    </p>
                    <p className="mt-0.5 text-2xl font-semibold text-gray-900">
                      {daysAgo(lastContactedIso)}
                    </p>
                    {fmtDate(lastContactedIso) ? (
                      <p className="text-sm text-gray-500">
                        {fmtDate(lastContactedIso)}
                      </p>
                    ) : null}
                    {lastContactedIso !== null &&
                    lastInteraction?.interaction_type ? (
                      <div className="mt-2">
                        <EngagementChip tone={contactTone}>
                          {contactTone === "warning"
                            ? "Stale · "
                            : contactTone === "success"
                              ? "Recent · "
                              : ""}
                          {lastInteraction.interaction_type}
                        </EngagementChip>
                      </div>
                    ) : null}
                  </div>

                  <div className="grid grid-cols-2 gap-3 border-t border-gray-100 pt-4">
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                        Interactions
                      </p>
                      <p className="mt-0.5 text-xl font-semibold tabular-nums text-gray-900">
                        {profile.interaction_count}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                        Events attended
                      </p>
                      <p className="mt-0.5 text-xl font-semibold tabular-nums text-gray-900">
                        {profile.events.length}
                      </p>
                    </div>
                  </div>

                  {profile.tags.length ? (
                    <div className="border-t border-gray-100 pt-4">
                      <ChipRow label="Tags">
                        {profile.tags.map((t) => (
                          <EngagementChip key={t} tone="tag">
                            {t}
                          </EngagementChip>
                        ))}
                      </ChipRow>
                    </div>
                  ) : null}
                </div>
              </Panel>

              {/* Personal & family */}
              <Panel
                title="Personal & family"
                action={canEdit ? <EditLink id={aid} /> : undefined}
              >
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <Field label="Birthday" value={fmtDate(a.birth_date)} />
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                      Spouse
                    </p>
                    {spouseLinkLabel ? (
                      a.spouse_alumni_id ? (
                        <Link
                          href={`/alumni/${a.spouse_alumni_id}`}
                          className="text-sm font-medium text-brand-blue-600 hover:text-brand-blue-500"
                        >
                          {spouseLinkLabel} ↗
                        </Link>
                      ) : (
                        <p className="text-sm text-gray-900">{spouseLinkLabel}</p>
                      )
                    ) : (
                      <p className="text-sm text-gray-300">—</p>
                    )}
                  </div>
                  <Field
                    label="Spouse birthday"
                    value={fmtDate(a.spouse_birth_date)}
                  />
                </div>
              </Panel>

              {/* Profile completeness — admin tool, hidden for view_only. */}
              {canEdit ? (
              <Panel title="Profile completeness">
                <div className="mb-3 flex items-end justify-between">
                  <span className="text-3xl font-semibold tabular-nums text-gray-900">
                    {completeness}%
                  </span>
                  <Badge variant={completenessTone}>{completenessLabel}</Badge>
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
              ) : null}

                  </div>
                </div>
              </div>
            }
            engagement={
              // Engagement & tags is an editor tool — the tab only renders for
              // users who can edit (AlumniProfileTabs omits a tab whose node is
              // undefined), so view-only roles never see it.
              canEdit ? (
                <Panel title="Engagement & tags">
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
            education={
              <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                {/* Employment history */}
                <Panel
                  title="Employment history"
                  action={canEdit ? <AddRoleButton alumniId={aid} /> : undefined}
                >
                  {profile.employment_history.length ? (
                    <DrawerList
                      title="Employment history"
                      ordered
                      collapsed={3}
                      listClassName="space-y-1"
                      action={
                        canEdit ? <AddRoleButton alumniId={aid} /> : undefined
                      }
                    >
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

                {/* Education */}
                {profile.education.length || canEdit ? (
                  <Panel
                    title="Education"
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
                        {profile.education.map((ed) => (
                          <li
                            key={ed.education_id}
                            className="flex gap-3 border-b border-gray-100 py-3 last:border-0"
                          >
                            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gray-100 text-gray-500">
                              <GraduationCap
                                className="h-4 w-4"
                                aria-hidden="true"
                              />
                            </span>
                            <div className="min-w-0 flex-1">
                              <div className="flex items-start justify-between gap-2">
                                <p className="text-sm font-semibold text-gray-900">
                                  {ed.university ?? "—"}
                                </p>
                                <div className="flex shrink-0 items-center gap-2">
                                  <span className="text-xs tabular-nums text-gray-500">
                                    {ed.degree_year ?? "—"}
                                  </span>
                                  {canEdit ? (
                                    <EducationRowActions
                                      alumniId={aid}
                                      row={ed}
                                    />
                                  ) : null}
                                </div>
                              </div>
                              <p className="text-sm text-gray-600">
                                {[ed.degree, ed.major]
                                  .filter(Boolean)
                                  .join(" · ") || "—"}
                              </p>
                              <p className="text-xs text-gray-500">
                                {[ed.college, ed.department, ed.degree_status]
                                  .filter(Boolean)
                                  .join(" · ")}
                              </p>
                            </div>
                          </li>
                        ))}
                      </DrawerList>
                    ) : (
                      <p className="py-6 text-center text-sm text-gray-500">
                        No education on file yet.
                      </p>
                    )}
                  </Panel>
                ) : null}

                {/* Recent events */}
                {profile.events.length || canEdit ? (
                  <Panel
                    title="Recent events"
                    action={
                      canEdit ? <AddEventButton alumniId={aid} /> : undefined
                    }
                  >
                    {profile.events.length ? (
                      <DrawerList
                        title="Recent events"
                        collapsed={3}
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
                ) : null}

                {/* Finance Society leadership */}
                {profile.leadership.length || canEdit ? (
                  <Panel
                    title="Finance Society leadership"
                    action={
                      canEdit ? (
                        <AddLeadershipButton alumniId={aid} />
                      ) : undefined
                    }
                  >
                    {profile.leadership.length ? (
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
                    ) : (
                      <p className="py-6 text-center text-sm text-gray-500">
                        No leadership roles recorded yet.
                      </p>
                    )}
                  </Panel>
                ) : null}
              </div>
            }
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
          />
        </div>
      </main>
    </>
  );
}

/* ----------------------------------------------------- small server helpers */

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

function ChipRow({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-start gap-3">
      <span className="w-16 shrink-0 pt-0.5 text-xs font-semibold uppercase tracking-wide text-gray-500">
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
    [p.cfa_designation, "CFA"],
    [p.cfp_designation, "CFP"],
    [p.piff_donor, "PIFF donor"],
  ];
  return flags.filter(([on]) => on).map(([, label]) => label);
}
