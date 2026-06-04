"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Users,
  Map,
  Calendar,
  History,
  Shield,
  type LucideIcon,
} from "lucide-react";

type NavItem = {
  href: string;
  label: string;
  icon: LucideIcon;
  superAdminOnly?: boolean;
};

const NAV: NavItem[] = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/alumni", label: "Alumni", icon: Users },
  { href: "/map", label: "Map", icon: Map },
  { href: "/events", label: "Events", icon: Calendar },
  { href: "/audit", label: "Audit", icon: History },
  { href: "/admin", label: "Admin", icon: Shield, superAdminOnly: true },
];

const ROLE_LABEL: Record<string, string> = {
  super_admin: "Super admin",
  full_access: "Full access",
  view_only: "View only",
};

export function Sidebar({ email, role }: { email: string; role: string }) {
  const pathname = usePathname();
  const isSuperAdmin = role === "super_admin";

  return (
    <aside className="flex w-60 shrink-0 flex-col bg-navy-800 px-3 py-5">
      <div className="px-2 pb-3">
        <p className="text-[13px] font-semibold tracking-[0.15em] text-white">
          BYU FINANCE
        </p>
        <p className="text-xs text-brand-blue-300">Alumni Database</p>
      </div>

      <nav className="flex flex-col gap-1">
        {NAV.filter((n) => !n.superAdminOnly || isSuperAdmin).map(
          ({ href, label, icon: Icon }) => {
            const active =
              pathname === href || pathname.startsWith(`${href}/`);
            return (
              <Link
                key={href}
                href={href}
                className={`flex items-center gap-2.5 rounded-lg px-3 py-2.5 text-sm transition-colors ${
                  active
                    ? "bg-brand-blue-600 font-semibold text-white"
                    : "font-medium text-brand-blue-300 hover:bg-navy-700 hover:text-white"
                }`}
              >
                <Icon className="h-[18px] w-[18px]" aria-hidden="true" />
                {label}
              </Link>
            );
          },
        )}
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
