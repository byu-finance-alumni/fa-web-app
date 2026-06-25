"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { ChevronDown } from "lucide-react";
import { ROLE, ROLE_LABEL } from "@/constants/roles";

type NavLeaf = {
  href: string;
  label: string;
  superAdminOnly?: boolean;
  /** Visible to full_access and super_admin only (admin tooling). */
  fullAccessOnly?: boolean;
  /** Visible to the engineer role only (e.g. support-contact management). */
  engineerOnly?: boolean;
  /** Hidden from view_only ("Professor"). Use for tabs that only error for
   *  unprovisioned/read-only users (e.g. Activity) — still shown to student and
   *  every higher tier. */
  hideViewOnly?: boolean;
};

type NavItem = NavLeaf & {
  children?: NavLeaf[];
};

const NAV: NavItem[] = [
  { href: "/dashboard", label: "Dashboard" },
  { href: "/alumni", label: "Alumni" },
  { href: "/map", label: "Map" },
  { href: "/events", label: "Events" },
  { href: "/activity", label: "Activity", hideViewOnly: true },
  { href: "/tasks", label: "Tasks", fullAccessOnly: true },
  {
    href: "/needs-surveying",
    label: "Needs Surveying",
    fullAccessOnly: true,
  },
  { href: "/data-quality", label: "Data quality", fullAccessOnly: true },
  {
    href: "/admin",
    label: "Admin",
    children: [
      { href: "/admin", label: "Users", superAdminOnly: true },
      {
        href: "/admin/vocabulary",
        label: "Vocabulary",
        engineerOnly: true,
      },
      { href: "/audit", label: "Audit", superAdminOnly: true },
      { href: "/admin/logins", label: "Logins", engineerOnly: true },
      {
        href: "/admin/support-contacts",
        label: "Support contacts",
        engineerOnly: true,
      },
      { href: "/admin/import", label: "Import CSV", fullAccessOnly: true },
    ],
  },
];

const isActivePath = (pathname: string, href: string) =>
  pathname === href || pathname.startsWith(`${href}/`);

export function Sidebar({ email, role }: { email: string; role: string }) {
  const pathname = usePathname();
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
    hideViewOnly?: boolean;
  }) =>
    (!n.superAdminOnly || isSuperAdmin) &&
    (!n.fullAccessOnly || hasFullAccess) &&
    (!n.engineerOnly || isEngineer) &&
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
                className={linkCls(isActivePath(pathname, href))}
              >
                {label}
              </Link>
            );
          }

          const childActive = children.some((c) =>
            isActivePath(pathname, c.href),
          );
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
                      className={linkCls(isActivePath(pathname, c.href), true)}
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
        className={`mt-auto ${linkCls(isActivePath(pathname, "/privacy"))}`}
      >
        Privacy
      </Link>

      <div className="mt-3 flex items-center gap-2.5 border-t border-navy-700 px-2 pt-3">
        <span className="flex h-8 w-8 items-center justify-center rounded-full bg-brand-blue-500 text-xs font-semibold text-white">
          {(email[0] ?? "?").toUpperCase()}
        </span>
        <div className="min-w-0">
          <p className="truncate text-[13px] font-medium text-white">{email}</p>
          <p className="text-[11px] text-brand-blue-300">
            {ROLE_LABEL[role] ?? "Not provisioned"}
          </p>
        </div>
      </div>
    </aside>
  );
}
