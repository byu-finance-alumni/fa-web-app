"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronDown } from "lucide-react";
import {
  getVisibleNav,
  resolveActiveHref,
  leafHrefs,
  navGroupPanelId,
  type NavItem,
  type NavGroup,
} from "@/components/shell/nav";
import { SignOutButton } from "@/components/auth/SignOutButton";

/**
 * EXPERIMENT ONLY — horizontal navigation across the top, over the Marriott
 * School photo, instead of the navy sidebar.
 *
 * This branch exists to look at the idea and nothing else. It is deliberately
 * NOT a finished component:
 *
 *   * the group menus open on click and close on selection, with no focus trap,
 *     no Escape handling and no outside-click dismissal;
 *   * it renders only from `md` up — the mobile bar is untouched and the
 *     sidebar's own mobile behaviour is out of scope here;
 *   * the photo is the existing dashboard hero, reused as-is.
 *
 * If the direction is kept, this gets rebuilt properly. Do not merge it as is.
 */
export function TopNav({
  email,
  name = "",
  role,
  canVocab = false,
  capabilities = [],
}: {
  email: string;
  name?: string;
  role: string;
  canVocab?: boolean;
  capabilities?: readonly string[];
}) {
  const pathname = usePathname();
  const visibleNav = getVisibleNav(role, canVocab, capabilities);
  const activeHref = resolveActiveHref(pathname);
  const [openKey, setOpenKey] = useState<string | null>(null);

  const isGroup = (item: NavItem): item is NavGroup =>
    (item as NavGroup).children !== undefined;

  return (
    <header className="relative hidden shrink-0 overflow-visible md:block">
      {/* The photo and its scrims, clipped to the bar. Same two-layer treatment
          the dashboard hero uses — a flat wash plus a left-heavy gradient — so
          the brand and the nav labels keep their contrast wherever the photo
          happens to be bright. */}
      <div className="absolute inset-0 overflow-hidden">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/images/dashboard-hero.jpg"
          srcSet="/images/dashboard-hero-960.jpg 960w, /images/dashboard-hero-1280.jpg 1280w, /images/dashboard-hero.jpg 1920w"
          sizes="100vw"
          alt=""
          aria-hidden="true"
          className="h-full w-full object-cover"
          style={{ objectPosition: "center 40%" }}
        />
        <div aria-hidden="true" className="absolute inset-0 bg-navy-900/70" />
        <div
          aria-hidden="true"
          className="absolute inset-0 bg-gradient-to-r from-navy-900/90 via-navy-900/75 to-navy-900/60"
        />
      </div>

      <div className="relative flex h-16 items-center gap-6 px-6">
        <Link href="/dashboard" className="shrink-0 leading-tight">
          <span className="block text-sm font-bold tracking-wide text-white">
            BYU FINANCE
          </span>
          <span className="block text-xs text-brand-blue-300">
            Alumni Database
          </span>
        </Link>

        <nav className="flex min-w-0 flex-1 items-center gap-1">
          {visibleNav.map((item) => {
            if (!isGroup(item)) {
              const active = item.href === activeHref;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  aria-current={active ? "page" : undefined}
                  className={`rounded-md px-3 py-2 text-sm font-medium transition ${
                    active
                      ? "bg-white/20 text-white"
                      : "text-brand-blue-100 hover:bg-white/10 hover:text-white"
                  }`}
                >
                  {item.label}
                </Link>
              );
            }

            const key = item.label;
            const open = openKey === key;
            // A group counts as current when the page you are on is one of its
            // leaves — at any depth, so the nested Security group still lights
            // its parent.
            const active = leafHrefs(item).includes(activeHref ?? "");
            return (
              <div key={key} className="relative">
                <button
                  type="button"
                  aria-expanded={open}
                  aria-controls={navGroupPanelId(key)}
                  onClick={() => setOpenKey(open ? null : key)}
                  className={`flex items-center gap-1 rounded-md px-3 py-2 text-sm font-medium transition ${
                    active || open
                      ? "bg-white/20 text-white"
                      : "text-brand-blue-100 hover:bg-white/10 hover:text-white"
                  }`}
                >
                  {item.label}
                  <ChevronDown
                    className={`h-4 w-4 transition-transform ${open ? "rotate-180" : ""}`}
                    aria-hidden="true"
                  />
                </button>
                {open ? (
                  <div
                    id={navGroupPanelId(key)}
                    className="absolute left-0 top-full z-50 mt-1 min-w-56 rounded-lg border border-gray-200 bg-white py-1 shadow-card"
                  >
                    {item.children.map((child: NavItem) =>
                      isGroup(child) ? (
                        <div key={child.label} className="py-1">
                          <p className="px-3 pb-1 text-xs font-semibold uppercase tracking-wide text-gray-400">
                            {child.label}
                          </p>
                          {child.children.map((leaf: NavItem) =>
                            isGroup(leaf) ? null : (
                              <MenuLink
                                key={leaf.href}
                                href={leaf.href}
                                label={leaf.label}
                                active={leaf.href === activeHref}
                                onSelect={() => setOpenKey(null)}
                                indented
                              />
                            ),
                          )}
                        </div>
                      ) : (
                        <MenuLink
                          key={child.href}
                          href={child.href}
                          label={child.label}
                          active={child.href === activeHref}
                          onSelect={() => setOpenKey(null)}
                        />
                      ),
                    )}
                  </div>
                ) : null}
              </div>
            );
          })}
        </nav>

        <div className="flex shrink-0 items-center gap-4">
          <div className="text-right leading-tight">
            <p className="text-sm font-medium text-white">{name || email}</p>
            <p className="text-xs text-brand-blue-200">{email}</p>
          </div>
          <SignOutButton onDark />
        </div>
      </div>
    </header>
  );
}

function MenuLink({
  href,
  label,
  active,
  onSelect,
  indented = false,
}: {
  href: string;
  label: string;
  active: boolean;
  onSelect: () => void;
  indented?: boolean;
}) {
  return (
    <Link
      href={href}
      onClick={onSelect}
      aria-current={active ? "page" : undefined}
      className={`block px-3 py-2 text-sm transition ${indented ? "pl-6" : ""} ${
        active
          ? "bg-brand-blue-50 font-medium text-brand-blue-700"
          : "text-gray-700 hover:bg-gray-50"
      }`}
    >
      {label}
    </Link>
  );
}
