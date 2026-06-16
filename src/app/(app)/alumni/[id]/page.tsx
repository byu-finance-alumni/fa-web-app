import Link from "next/link";
import { notFound } from "next/navigation";
import {
  GraduationCap,
  Building2,
  Briefcase,
  Cake,
  MessageSquare,
  CalendarDays,
  CheckSquare,
  PieChart,
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
import type { Profile } from "@/types/profile";
import type { UserContext } from "@/types/alumni";
import { canEditAlumni, hasFullAccess } from "@/constants/roles";
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
import {
  ProfileActivity,
  type ActivityCategory,
  type ActivityItem,
} from "@/components/alumni/ProfileActivity";
import { ExportProfileButton } from "@/components/alumni/ExportProfileButton";
import { DrawerList } from "@/components/alumni/DrawerList";
import { DrawerView } from "@/components/alumni/DrawerView";
import { MetricCard } from "@/components/shared/MetricCard";
import { Avatar } from "@/components/shared/Avatar";

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

function activityCategory(type: string | null): ActivityCategory {
  const t = (type ?? "").toLowerCase();
  if (t.includes("call")) return "Calls";
  if (t.includes("note")) return "Notes";
  if (t.includes("event")) return "Events";
  return "Meetings";
}

const humanize = (s: string) =>
  s.replace(/_/g, " ").replace(/^\w/, (c) => c.toUpperCase());

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
    <section
      className={`rounded-xl border border-gray-300 bg-white p-5 ${className}`}
    >
      <div className="mb-4 flex items-center justify-between gap-2">
        <h3 className="text-lg font-semibold text-gray-900">{title}</h3>
        {action}
      </div>
      {children}
    </section>
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
    <Link
      href={`/alumni/${id}/edit`}
      className="text-xs font-medium text-brand-blue-600 hover:text-brand-blue-500"
    >
      {label}
    </Link>
  );
}

function EngagementChip({
  children,
  tone = "tag",
}: {
  children: React.ReactNode;
  tone?: "tag" | "neutral" | "success" | "warning" | "solid";
}) {
  const tones = {
    tag: "bg-brand-blue-50 text-navy-800",
    neutral: "bg-gray-100 text-gray-700",
    success: "bg-success-50 text-success-600",
    warning: "bg-warning-50 text-warning-600",
    solid: "bg-navy-800 text-white",
  } as const;
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${tones[tone]}`}
    >
      {children}
    </span>
  );
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

  // `canEdit` covers editing the EXISTING record + nested data — students get
  // this (mirrors backend require_alumni_edit). `canArchive` is the narrower
  // create/archive tier (full_access and up) used only for the Archive control,
  // which the backend keeps on require_full_access (students are 403'd there).
  let canEdit = false;
  let canArchive = false;
  try {
    const ctx = await apiGet<UserContext>("/auth/context");
    canEdit = canEditAlumni(ctx.roles);
    canArchive = hasFullAccess(ctx.roles);
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
  const overdueTasks = openTasks.filter(
    (t) => t.due_date && new Date(t.due_date) < new Date(),
  );
  const lastEvent = profile.events[0];
  const quarterAgo = new Date(Date.now() - 90 * 864e5).toISOString();
  const recentInteractions = profile.interactions.filter(
    (i) => i.interaction_date_time && i.interaction_date_time >= quarterAgo,
  ).length;

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

  // Activity feed = interactions (typed) + audit (updates), newest first
  const activity: ActivityItem[] = [
    ...profile.interactions.map((i) => ({
      id: `i${i.interaction_id}`,
      category: activityCategory(i.interaction_type),
      title: i.interaction_type ?? "Interaction",
      typeLabel: i.interaction_type ?? "Interaction",
      when: i.interaction_date_time,
      who: i.logged_by,
      description: i.interaction_notes,
    })),
    ...profile.audit.map((e) => ({
      id: `a${e.audit_log_id}`,
      category: "Updates" as ActivityCategory,
      title: humanize(e.action_type),
      typeLabel: "Update",
      when: e.created_at,
      who: null,
      description: e.field_name
        ? `${e.field_name}: ${e.old_value ?? "∅"} → ${e.new_value ?? "∅"}`
        : null,
    })),
  ].sort((x, y) => (y.when ?? "").localeCompare(x.when ?? ""));

  const recentActivity = activity.slice(0, 5);

  // Shared chip content for Engagement & tags — rendered in the panel and in
  // its "View all" right-side drawer.
  const engagementContent = (
    <div className="space-y-3">
      {profile.tags.length ? (
        <ChipRow label="Tags">
          {profile.tags.map((t) => (
            <EngagementChip
              key={t}
              tone={t.toLowerCase().includes("engaged") ? "warning" : "tag"}
            >
              {t}
            </EngagementChip>
          ))}
        </ChipRow>
      ) : null}
      {profile.status_labels.length ? (
        <ChipRow label="Status">
          {profile.status_labels.map((s) => (
            <EngagementChip key={s} tone="neutral">
              {s}
            </EngagementChip>
          ))}
        </ChipRow>
      ) : null}
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
  );

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
          <div className="rounded-xl border border-gray-300 bg-white p-5">
            <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
              <div className="flex items-center gap-4">
                <Avatar
                  netId={a.net_id}
                  initials={initials}
                  name={name}
                  size="h-24 w-24 text-2xl"
                  colorClass={avatarColor(initials)}
                />
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 className="text-2xl font-semibold text-gray-900">{name}</h2>
                    {a.preferred_first_name &&
                    a.preferred_first_name !== a.first_name ? (
                      <EngagementChip tone="neutral">
                        Goes by “{a.preferred_first_name}”
                      </EngagementChip>
                    ) : null}
                    <span
                      className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium ${
                        recordStatus === "Active"
                          ? "bg-success-50 text-success-600"
                          : "bg-gray-100 text-gray-500"
                      }`}
                    >
                      <span
                        className={`h-1.5 w-1.5 rounded-full ${recordStatus === "Active" ? "bg-success-600" : "bg-gray-400"}`}
                      />
                      {recordStatus}
                    </span>
                  </div>
                  <p className="mt-1 text-sm text-gray-500">
                    {[
                      a.graduation_year ? `Class of ${a.graduation_year}` : null,
                      a.byu_id ? `BYU ID ${a.byu_id}` : null,
                      a.net_id ? `BYU Net ID ${a.net_id}` : null,
                    ]
                      .filter(Boolean)
                      .join(" · ")}
                  </p>
                  <div className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-gray-600">
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

              {canEdit ? (
                <div className="flex shrink-0 flex-wrap items-center gap-2">
                  <AddInteractionButton alumniId={aid} label="+ Add interaction" />
                  <AddTaskButton alumniId={aid} label="Create task" />
                  <ExportProfileButton
                    profile={profile}
                    fileBaseName={`${name.replace(/\s+/g, "-").toLowerCase()}-${aid}`}
                  />
                  <Link
                    href={`/alumni/${aid}/edit`}
                    className="rounded-lg bg-brand-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-blue-500"
                  >
                    Edit
                  </Link>
                  {canArchive ? (
                    <ArchiveControls
                      alumniId={aid}
                      archived={a.archived}
                      name={name}
                    />
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

          {/* KPI strip — always 6 slots. For view_only the admin-only Open
              tasks + Completeness tiles become blank placeholders so the 4 real
              tiles stay aligned with the admin layout. */}
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
            <MetricCard
              icon={GraduationCap}
              label="Graduation year"
              value={a.graduation_year}
              sub={
                a.finance_program_year
                  ? `Finance program '${String(a.finance_program_year).slice(-2)}`
                  : null
              }
            />
            <MetricCard
              icon={Building2}
              label="Industry"
              value={career?.current_industry ?? "—"}
              sub={career?.current_industry_secondary ?? null}
            />
            <MetricCard
              icon={MessageSquare}
              label="Interactions"
              value={profile.interaction_count}
              sub={recentInteractions ? `+${recentInteractions} this quarter` : null}
              subTone={recentInteractions ? "success" : "muted"}
            />
            <MetricCard
              icon={CalendarDays}
              label="Events attended"
              value={profile.events.length}
              sub={lastEvent ? `Last: ${lastEvent.event_name}` : null}
            />
            {/* Tasks are visible to admins (full_access / super_admin) only. */}
            {canEdit ? (
              <MetricCard
                icon={CheckSquare}
                label="Open tasks"
                value={openTasks.length}
                sub={overdueTasks.length ? `${overdueTasks.length} overdue` : null}
                subTone={overdueTasks.length ? "warning" : "muted"}
              />
            ) : (
              <MetricCard
                icon={Briefcase}
                label="Past roles"
                value={profile.employment_history.length}
                sub={profile.employment_history[0]?.employer_name ?? null}
              />
            )}
            {/* Completeness for admins; Birthday fills the slot for view_only. */}
            {canEdit ? (
              <MetricCard
                icon={PieChart}
                label="Completeness"
                value={`${completeness}%`}
                sub={missing.length ? `${missing.length} fields missing` : "Complete"}
                subTone={missing.length ? "warning" : "success"}
              />
            ) : (
              <MetricCard
                icon={Cake}
                label="Birthday"
                value={fmtDate(a.birth_date) ?? "—"}
                sub={null}
              />
            )}
          </div>

          {/* Paired-row body */}
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
            {/* Main column (wider). Flex column with the last panel growing so
                both columns end at the same point (equal length). */}
            <div className="flex flex-col gap-4 lg:col-span-2 lg:[&>:last-child]:flex-1">
              {/* Contact information */}
              <Panel title="Contact information" action={<EditLink id={aid} />}>
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

              {/* Career snapshot */}
              <Panel title="Career snapshot" action={<EditLink id={aid} />}>
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
                                <span className="ml-2 inline-flex items-center rounded-full bg-success-50 px-2 py-0.5 text-[11px] font-medium text-success-600">
                                  Current
                                </span>
                              ) : null}
                            </p>
                            <div className="flex shrink-0 items-center gap-2">
                              <span className="text-xs tabular-nums text-gray-500">
                                {e.start_year ?? "—"} –{" "}
                                {e.is_current ? "Present" : (e.end_year ?? "—")}
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
                            <GraduationCap className="h-4 w-4" aria-hidden="true" />
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
                  action={canEdit ? <AddEventButton alumniId={aid} /> : undefined}
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

            </div>

            {/* Right sidebar (narrower). Same flex-column treatment so it ends
                level with the main column. */}
            <div className="flex flex-col gap-4 lg:[&>:last-child]:flex-1">
              {/* Personal & family */}
              <Panel title="Personal & family" action={<EditLink id={aid} />}>
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

              {/* Finance Society leadership */}
              {profile.leadership.length || canEdit ? (
                <Panel
                  title="Finance Society leadership"
                  action={
                    canEdit ? <AddLeadershipButton alumniId={aid} /> : undefined
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

              {/* Open tasks — visible to admins (full_access / super_admin) only. */}
              {canEdit ? (
              <Panel
                title={`Open tasks (${openTasks.length})`}
                action={canEdit ? <AddTaskButton alumniId={aid} label="+ New task" /> : undefined}
              >
                {openTasks.length ? (
                  <DrawerList
                    title="Open tasks"
                    collapsed={2}
                    listClassName="space-y-3"
                    action={
                      canEdit ? (
                        <AddTaskButton alumniId={aid} label="+ New task" />
                      ) : undefined
                    }
                  >
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
                              <span
                                className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] font-medium ${
                                  overdue
                                    ? "bg-warning-50 text-warning-600"
                                    : "bg-gray-100 text-gray-600"
                                }`}
                              >
                                {overdue ? "Overdue · " : ""}
                                {t.due_date ? fmtDate(t.due_date) : "No date"}
                              </span>
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
                  </DrawerList>
                ) : (
                  <p className="py-4 text-center text-sm text-gray-500">
                    No open tasks.
                  </p>
                )}
              </Panel>
              ) : null}

              {/* Profile completeness — admin tool, hidden for view_only. */}
              {canEdit ? (
              <Panel title="Profile completeness">
                <div className="mb-3 flex items-end justify-between">
                  <span className="text-3xl font-semibold tabular-nums text-gray-900">
                    {completeness}%
                  </span>
                </div>
                <div className="mb-4 h-2 overflow-hidden rounded-full bg-gray-100">
                  <div
                    className="h-full rounded-full bg-brand-blue-600"
                    style={{ width: `${completeness}%` }}
                  />
                </div>
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
                  <Link
                    href={`/alumni/${aid}/edit`}
                    className="mt-4 block rounded-lg border border-gray-300 bg-white py-2 text-center text-sm font-medium text-gray-700 hover:bg-gray-50"
                  >
                    Add missing info
                  </Link>
                ) : null}
              </Panel>
              ) : null}

              {/* Engagement & tags */}
              {profile.tags.length ||
              profile.status_labels.length ||
              profile.program_engagement ||
              canEdit ? (
                <Panel
                  title="Engagement & tags"
                  action={
                    <DrawerView
                      title="Engagement & tags"
                      triggerLabel="View all"
                    >
                      <div className="space-y-5">
                        {canEdit ? (
                          <TagStatusManager
                            alumniId={aid}
                            tags={profile.tags}
                            statusLabels={profile.status_labels}
                          />
                        ) : null}
                        {profile.program_engagement ? (
                          <ChipRow label="Program">
                            {programChips(profile.program_engagement).map(
                              (label) => (
                                <EngagementChip key={label} tone="success">
                                  {label}
                                </EngagementChip>
                              ),
                            )}
                          </ChipRow>
                        ) : null}
                      </div>
                    </DrawerView>
                  }
                >
                  {/* Capped so a chip-heavy alumnus can't grow the box — the
                      overflow lives behind "View all". */}
                  {profile.tags.length ||
                  profile.status_labels.length ||
                  profile.program_engagement ? (
                    <div className="max-h-40 overflow-hidden">
                      {engagementContent}
                    </div>
                  ) : (
                    <p className="py-4 text-center text-sm text-gray-500">
                      No tags or status labels yet. Use “View all” to add some.
                    </p>
                  )}
                </Panel>
              ) : null}

              {/* Recent activity — admin-only (hidden for view_only). */}
              {canEdit && recentActivity.length ? (
                <Panel title="Recent activity">
                  <ul className="space-y-2.5">
                    {recentActivity.map((i) => (
                      <li
                        key={i.id}
                        className="flex items-start justify-between gap-3 text-sm"
                      >
                        <span className="flex min-w-0 items-start gap-2 text-gray-700">
                          <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-brand-blue-600" />
                          <span className="truncate">{i.title}</span>
                        </span>
                        <span className="shrink-0 text-xs text-gray-500">
                          {fmtDate(i.when)}
                        </span>
                      </li>
                    ))}
                  </ul>
                </Panel>
              ) : null}
            </div>
          </div>

          {/* Activity feed (full width) */}
          <ProfileActivity alumniId={aid} items={activity} canEdit={canEdit} />
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
