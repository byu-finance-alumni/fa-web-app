"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home, Users, Calendar } from "lucide-react";

const TABS = [
  { href: "/dashboard", label: "Home", icon: Home },
  { href: "/alumni", label: "Alumni", icon: Users },
  { href: "/events", label: "Events", icon: Calendar },
];

/** Bottom tab bar shown on phones (the desktop sidebar is hidden < md). */
export function MobileNav() {
  const pathname = usePathname();
  return (
    <nav className="fixed inset-x-0 bottom-0 z-20 flex border-t border-gray-300 bg-white pb-[env(safe-area-inset-bottom)] md:hidden">
      {TABS.map(({ href, label, icon: Icon }) => {
        const active = pathname === href || pathname.startsWith(`${href}/`);
        return (
          <Link
            key={href}
            href={href}
            className={`flex flex-1 flex-col items-center gap-1 py-2.5 text-[11px] ${
              active
                ? "font-semibold text-brand-blue-600"
                : "font-medium text-gray-500"
            }`}
          >
            <Icon className="h-5 w-5" aria-hidden="true" />
            {label}
          </Link>
        );
      })}
    </nav>
  );
}
