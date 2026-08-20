"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, type ReactNode } from "react";
import { ChevronDown } from "lucide-react";
import {
  currentNavToggles,
  getVisibleNav,
  isNavGroupOpen,
  navGroupKey,
  navGroupPanelId,
  resolveActiveHref,
  toggleNavGroup,
  NO_NAV_TOGGLES,
  type NavItem,
} from "@/components/shell/nav";

// Nav model + gating live in `@/components/shell/nav` (shared with the mobile
// "More" menu). Groups nest — Engineer holds a Security group — so the renderer
// below is recursive rather than one parent/child pass.

/** Left inset per nesting depth. Kept as whole class strings so Tailwind's
 *  source scan can see them. */
const INDENT = ["", "ml-3 pl-4", "ml-6 pl-4"] as const;

export function Sidebar({
  email,
  name = "",
  role,
  canVocab = false,
  capabilities = [],
}: {
  email: string;
  /** Display name for the footer; falls back to the email when empty. */
  name?: string;
  role: string;
  /** Holds the `vocab_admin` capability (engineer, or any granted role). Drives
   *  the capability-gated Vocabulary item independently of the role string. */
  canVocab?: boolean;
  /** The user's effective capability codes from `GET /auth/context`. Drives the
   *  per-section nav items #379 split out of the old "full access" role check —
   *  empty (the default) hides them, which is also the preview-as-role case. */
  capabilities?: readonly string[];
}) {
  const pathname = usePathname();
  // Single most-specific active link (see resolveActiveHref) — avoids a
  // parent-prefix href lighting up alongside its deeper sibling.
  const activeHref = resolveActiveHref(pathname);
  const isActive = (href: string) => href === activeHref;
  // Explicit open/close toggles, stamped with the route they were made on and
  // dropped when it changes (see NavToggles). Nothing is persisted: a group's
  // open state is the route plus whatever the user has toggled on this page, so
  // the group holding the current page is always open on arrival.
  const [toggles, setToggles] = useState(NO_NAV_TOGGLES);
  const openToggles = currentNavToggles(toggles, pathname);

  // Role- and capability-filtered nav (see nav.ts).
  const visibleNav = getVisibleNav(role, canVocab, capabilities);

  const linkCls = (active: boolean, depth = 0) =>
    `flex items-center rounded-lg px-3 py-2.5 text-sm transition-colors ${
      INDENT[Math.min(depth, INDENT.length - 1)]
    } ${
      active
        ? "bg-brand-blue-600 font-semibold text-white"
        : "font-medium text-brand-blue-300 hover:bg-navy-700 hover:text-white"
    }`;

  const renderItem = (
    item: NavItem,
    depth: number,
    ancestors: readonly string[],
  ): ReactNode => {
    if (!item.children) {
      return (
        <Link
          key={item.href}
          href={item.href}
          className={linkCls(isActive(item.href), depth)}
        >
          {item.label}
        </Link>
      );
    }

    const key = navGroupKey(ancestors, item.label);
    const panelId = navGroupPanelId(key);
    const open = isNavGroupOpen(item, key, activeHref, openToggles);
    return (
      <div key={key}>
        <button
          type="button"
          onClick={() =>
            setToggles((t) => toggleNavGroup(t, pathname, key, !open))
          }
          aria-expanded={open}
          aria-controls={panelId}
          className={`w-full ${linkCls(false, depth)} justify-between`}
        >
          {item.label}
          <ChevronDown
            className={`h-4 w-4 transition-transform ${open ? "rotate-180" : ""}`}
            aria-hidden="true"
          />
        </button>
        {/* The panel stays mounted so `aria-controls` always resolves; `hidden`
            is the Tailwind display:none utility, which also takes a closed
            group out of the accessibility tree and the tab order. */}
        <div
          id={panelId}
          className={open ? "mt-1 flex flex-col gap-1" : "hidden"}
        >
          {item.children.map((c) =>
            renderItem(c, depth + 1, [...ancestors, item.label]),
          )}
        </div>
      </div>
    );
  };

  return (
    <aside className="hidden w-60 shrink-0 flex-col bg-navy-800 px-3 py-5 md:flex">
      <div className="px-2 pb-3">
        <p className="text-[13px] font-semibold tracking-[0.15em] text-white">
          BYU FINANCE
        </p>
        <p className="text-xs text-brand-blue-300">Alumni Database</p>
      </div>

      <nav className="flex flex-col gap-1">
        {visibleNav.map((item) => renderItem(item, 0, []))}
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
