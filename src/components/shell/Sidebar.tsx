"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import {
  LayoutDashboard,
  Users,
  Map,
  Calendar,
  Activity,
  AlertTriangle,
  History,
  Shield,
  UserCog,
  ChevronDown,
  type LucideIcon,
} from "lucide-react";

type NavLeaf = {
  href: string;
  label: string;
  icon: LucideIcon;
};

type NavItem = NavLeaf & {
  superAdminOnly?: boolean;
  children?: NavLeaf[];
};

const NAV: NavItem[] = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/alumni", label: "Alumni", icon: Users },
  { href: "/map", label: "Map", icon: Map },
  { href: "/events", label: "Events", icon: Calendar },
  { href: "/activity", label: "Activity", icon: Activity },
  { href: "/data-quality", label: "Data quality", icon: AlertTriangle },
  {
    href: "/admin",
    label: "Admin",
    icon: Shield,
    superAdminOnly: true,
    children: [
      { href: "/admin", label: "Users", icon: UserCog },
      { href: "/audit", label: "Audit", icon: History },
    ],
  },
];

const ROLE_LABEL: Record<string, string> = {
  super_admin: "Super admin",
  full_access: "Full access",
  view_only: "View only",
};

const isActivePath = (pathname: string, href: string) =>
  pathname === href || pathname.startsWith(`${href}/`);

export function Sidebar({ email, role }: { email: string; role: string }) {
  const pathname = usePathname();
  const isSuperAdmin = role === "super_admin";
  // Track explicit open/close toggles per group; a group with an active child
  // defaults to open.
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>({});

  const linkCls = (active: boolean, indent = false) =>
    `flex items-center gap-2.5 rounded-lg px-3 py-2.5 text-sm transition-colors ${
      indent ? "ml-4" : ""
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
        {NAV.filter((n) => !n.superAdminOnly || isSuperAdmin).map((item) => {
          const { href, label, icon: Icon, children } = item;

          if (!children) {
            return (
              <Link
                key={href}
                href={href}
                className={linkCls(isActivePath(pathname, href))}
              >
                <Icon className="h-[18px] w-[18px]" aria-hidden="true" />
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
                <span className="flex items-center gap-2.5">
                  <Icon className="h-[18px] w-[18px]" aria-hidden="true" />
                  {label}
                </span>
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
                      <c.icon className="h-[18px] w-[18px]" aria-hidden="true" />
                      {c.label}
                    </Link>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </nav>

      <div className="mt-auto flex items-center gap-2.5 border-t border-navy-700 px-2 pt-3">
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
