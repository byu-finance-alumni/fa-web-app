"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { ChevronDown } from "lucide-react";
import { ROLE } from "@/constants/roles";

type NavLeaf = {
  href: string;
  label: string;
  superAdminOnly?: boolean;
  /** Visible to full_access and super_admin only (admin tooling). */
  fullAccessOnly?: boolean;
  /** Visible to the engineer role only (e.g. support-contact management). */
  engineerOnly?: boolean;
  /** Visible to anyone holding the `vocab_admin` capability — the engineer plus
   *  any role an engineer grants it in the permission editor (e.g. super_admin).
   *  Capability-driven so a grant actually takes effect, unlike role flags. */
  vocabOnly?: boolean;
  /** Hidden from view_only ("Professor"). Use for tabs that only error for
   *  unprovisioned/read-only users (e.g. Activity) — still shown to student and
   *  every higher tier. */
  hideViewOnly?: boolean;
};

type NavItem = NavLeaf & {
  children?: NavLeaf[];
};

const NAV: NavItem[] = [
  // --- Browse: the everyday find/view surfaces. Flat and (almost) ungated so
  // every role gets a short, scannable list at the top. ---
  { href: "/dashboard", label: "Dashboard" },
  { href: "/alumni", label: "Alumni" },
  // #218 Friends of the finance program — its own /friends route (non-alumni
  // contacts, backend is_alumni=false).
  { href: "/friends", label: "Friends" },
  { href: "/events", label: "Events" },
  { href: "/map", label: "Map" },
  // #400 Statistics — placeholder analytics workspace. No gating flags, so it's
  // visible to EVERY role (engineer / super_admin / full_access / student /
  // professor); the page itself is a public-to-all "Under construction" notice.
  { href: "/statistics", label: "Statistics" },
  // Activity feed — hidden from view_only ("Professor"), shown to student and
  // every higher tier (it only errors for unprovisioned/read-only users).
  { href: "/activity", label: "Activity", hideViewOnly: true },

  // --- Manage: the full_access work tools, gathered into one collapsible group.
  // Every child is fullAccessOnly, so the whole group is dropped for
  // student/view_only rather than showing an empty header. ---
  {
    href: "/manage",
    label: "Manage",
    fullAccessOnly: true,
    children: [
      { href: "/tasks", label: "Tasks", fullAccessOnly: true },
      {
        href: "/needs-surveying",
        label: "Needs Surveying",
        fullAccessOnly: true,
      },
      // Pay It Forward donor ledger — the backend requires the full_access tier
      // (alumni.full) to read it at all (#278), so gate the nav to match rather
      // than leaving lower tiers a link that just 403s.
      { href: "/pay-it-forward", label: "Pay It Forward", fullAccessOnly: true },
      { href: "/data-quality", label: "Data quality", fullAccessOnly: true },
      // Import CSV lives here — it's a full_access DATA operation, not user/audit
      // administration. Keeping it out of Admin means Admin stays a true
      // super-admin section (no lone "Import" link for full_access).
      { href: "/admin/import", label: "Import", fullAccessOnly: true },
    ],
  },

  // --- Admin: user & audit administration (super_admin+). Vocabulary is
  // capability-gated (not role-locked): the engineer always, plus any role an
  // engineer grants the vocab capability. Users/Audit keep the group non-empty
  // for super_admin, so Vocabulary is never a lone item here. ---
  {
    href: "/admin",
    label: "Admin",
    children: [
      { href: "/admin", label: "Users", superAdminOnly: true },
      { href: "/audit", label: "Audit", superAdminOnly: true },
      { href: "/vocabulary", label: "Vocabulary", vocabOnly: true },
    ],
  },
  // Engineer console — its own home for every engineer-only tool (#162). The
  // whole group (and each child) is engineerOnly, so it's invisible to everyone
  // below engineer; the backend re-enforces each route.
  {
    href: "/engineer",
    label: "Engineer",
    engineerOnly: true,
    children: [
      { href: "/engineer/permissions", label: "Permissions", engineerOnly: true },
      { href: "/engineer/preview", label: "Preview as role", engineerOnly: true },
      // Quick filters lives here (engineer-only). Vocabulary is in the Admin
      // dropdown since it's capability-gated and reachable by super_admin.
      { href: "/admin/quick-filters", label: "Quick filters", engineerOnly: true },
      { href: "/engineer/logins", label: "Logins", engineerOnly: true },
      {
        href: "/engineer/support-contacts",
        label: "Support contacts",
        engineerOnly: true,
      },
    ],
  },
];

// Every navigable leaf href (group headers are toggles, not links — their
// children are the real destinations), plus the standalone privacy link.
const LEAF_HREFS: string[] = [
  ...NAV.flatMap((i) => (i.children ? i.children.map((c) => c.href) : [i.href])),
  "/privacy",
];

// The active link is the LONGEST leaf href the current path matches (exact, or
// as a "/parent/…" prefix). An exact deeper route therefore wins over a shorter
// prefix — so "/admin/import" activates only Import CSV, not the Users link
// ("/admin"), while "/alumni/123" still activates Alumni ("/alumni").
const resolveActiveHref = (pathname: string): string | null =>
  LEAF_HREFS.reduce<string | null>((best, href) => {
    const matches = pathname === href || pathname.startsWith(`${href}/`);
    if (!matches) return best;
    return best === null || href.length > best.length ? href : best;
  }, null);

export function Sidebar({
  email,
  name = "",
  role,
  canVocab = false,
}: {
  email: string;
  /** Display name for the footer; falls back to the email when empty. */
  name?: string;
  role: string;
  /** Holds the `vocab_admin` capability (engineer, or any granted role). Drives
   *  the capability-gated Vocabulary item independently of the role string. */
  canVocab?: boolean;
}) {
  const pathname = usePathname();
  // Single most-specific active link (see resolveActiveHref) — avoids a
  // parent-prefix href lighting up alongside its deeper sibling.
  const activeHref = resolveActiveHref(pathname);
  const isActive = (href: string) => href === activeHref;
  // engineer is the top role and satisfies both gates. User/audit admin =
  // engineer or super_admin; full_access tooling (e.g. Tasks) also includes
  // full_access. (Mirrors @/constants/roles, but operates on the single
  // highest-role string the layout resolved.)
  const isSuperAdmin = role === ROLE.ENGINEER || role === ROLE.SUPER_ADMIN;
  const isEngineer = role === ROLE.ENGINEER;
  const hasFullAccess =
    role === ROLE.ENGINEER ||
    role === ROLE.SUPER_ADMIN ||
    role === ROLE.FULL_ACCESS;
  // view_only ("Professor") is the lowest provisioned tier; some tabs (e.g.
  // Activity) only error for it and should be hidden.
  const isViewOnly = role === ROLE.VIEW_ONLY;
  // Track explicit open/close toggles per group; a group with an active child
  // defaults to open.
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>({});

  const canSee = (n: {
    superAdminOnly?: boolean;
    fullAccessOnly?: boolean;
    engineerOnly?: boolean;
    vocabOnly?: boolean;
    hideViewOnly?: boolean;
  }) =>
    (!n.superAdminOnly || isSuperAdmin) &&
    (!n.fullAccessOnly || hasFullAccess) &&
    (!n.engineerOnly || isEngineer) &&
    (!n.vocabOnly || canVocab) &&
    (!n.hideViewOnly || !isViewOnly);

  // Role-filtered nav. A group (e.g. Admin) keeps only the children the user may
  // see and is dropped entirely if none remain — so full_access staff still see
  // the Admin group for "Import CSV" even though Users/Audit are super-admin only.
  const visibleNav = NAV.flatMap((item) => {
    if (item.children) {
      const children = item.children.filter(canSee);
      return children.length ? [{ ...item, children }] : [];
    }
    return canSee(item) ? [item] : [];
  });

  const linkCls = (active: boolean, indent = false) =>
    `flex items-center rounded-lg px-3 py-2.5 text-sm transition-colors ${
      indent ? "ml-3 pl-4" : ""
    } ${
      active
        ? "bg-brand-blue-600 font-semibold text-white"
        : "font-medium text-brand-blue-300 hover:bg-navy-700 hover:text-white"
    }`;

  return (
    <aside className="hidden w-60 shrink-0 flex-col bg-navy-800 px-3 py-5 md:flex">
      <div className="px-2 pb-3">
        <p className="text-[13px] font-semibold tracking-[0.15em] text-white">
          BYU FINANCE
        </p>
        <p className="text-xs text-brand-blue-300">Alumni Database</p>
      </div>

      <nav className="flex flex-col gap-1">
        {visibleNav.map((item) => {
          const { href, label, children } = item;

          if (!children) {
            return (
              <Link
                key={href}
                href={href}
                className={linkCls(isActive(href))}
              >
                {label}
              </Link>
            );
          }

          const childActive = children.some((c) => isActive(c.href));
          const open = openGroups[label] ?? childActive;
          return (
            <div key={label}>
              <button
                type="button"
                onClick={() =>
                  setOpenGroups((g) => ({ ...g, [label]: !open }))
                }
                aria-expanded={open}
                className={`w-full ${linkCls(false)} justify-between`}
              >
                {label}
                <ChevronDown
                  className={`h-4 w-4 transition-transform ${open ? "rotate-180" : ""}`}
                  aria-hidden="true"
                />
              </button>
              {open && (
                <div className="mt-1 flex flex-col gap-1">
                  {children.map((c) => (
                    <Link
                      key={c.href}
                      href={c.href}
                      className={linkCls(isActive(c.href), true)}
                    >
                      {c.label}
                    </Link>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </nav>

      {/* Privacy & data-handling statement — visible to every authenticated
          role (no gate). Pinned just above the user footer. */}
      <Link
        href="/privacy"
        className={`mt-auto ${linkCls(isActive("/privacy"))}`}
      >
        Privacy
      </Link>

      <div className="mt-3 min-w-0 border-t border-navy-700 px-2 pt-3">
        <p className="truncate text-[13px] font-medium text-white">
          {name || email}
        </p>
        {name ? (
          <p className="truncate text-[11px] text-brand-blue-300">{email}</p>
        ) : null}
      </div>
    </aside>
  );
}
