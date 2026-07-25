"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { ChevronDown } from "lucide-react";
import { getVisibleNav, resolveActiveHref } from "@/components/shell/nav";

// Nav model + gating live in `@/components/shell/nav` (shared with the mobile
// "More" menu).

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
  // Track explicit open/close toggles per group; a group with an active child
  // defaults to open.
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>({});

  // Role-filtered nav (shared with the mobile "More" menu — see nav.ts).
  const visibleNav = getVisibleNav(role, canVocab);

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
