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
 * ⚠️ The `brand-blue` scale is 600/500/300/50 ONLY. There is no 100 or 200, and
 * Tailwind emits nothing for a shade that does not exist — the labels here were
 * `text-brand-blue-100`, which silently left them inheriting the default dark
 * colour and invisible against the scrim. On dark surfaces use `text-white` at
 * an opacity, or `text-brand-blue-300`, which is what the sidebar uses.
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
          style={{ objectPosition: "center 55%" }}
        />
        {/* Much heavier than the dashboard hero's. On silverfund.byu.edu the
            photo is a TEXTURE — you register that the bar is not flat navy, and
            nothing more. Anything lighter and a 96px strip of building competes
            with the links sitting on it. */}
        <div aria-hidden="true" className="absolute inset-0 bg-navy-900/85" />
        <div
          aria-hidden="true"
          className="absolute inset-0 bg-gradient-to-r from-navy-900 via-navy-900/95 to-navy-900/75"
        />
      </div>

      {/* 96px, brand left, links RIGHT — the Silver Fund proportions. The links
          being right-aligned rather than packed against the brand is most of
          what makes that bar read as a masthead instead of a toolbar. */}
      <div className="relative flex h-24 items-center gap-6 px-8">
        <Link href="/dashboard" className="shrink-0">
          <span className="text-2xl font-bold tracking-tight text-white">
            BYU
          </span>
          <span className="ml-2 text-2xl font-normal text-white">
            Alumni Database
          </span>
        </Link>

        <nav className="ml-auto flex min-w-0 items-center gap-8">
          {visibleNav.map((item) => {
            if (!isGroup(item)) {
              const active = item.href === activeHref;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  aria-current={active ? "page" : undefined}
                  /* No pill. The reference marks the current page with weight
                     and full opacity only — a filled chip on a photo reads as a
                     button and there are eight of them. */
                  className={`whitespace-nowrap text-[15px] transition ${
                    active
                      ? "font-semibold text-white"
                      : "font-normal text-white/80 hover:text-white"
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
                  className={`flex items-center gap-1.5 whitespace-nowrap text-[15px] transition ${
                    active || open
                      ? "font-semibold text-white"
                      : "font-normal text-white/80 hover:text-white"
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
                    className="absolute right-0 top-full z-50 mt-2 min-w-56 rounded-lg border border-gray-200 bg-white py-1 shadow-card"
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

        {/* The reference has no account cluster at all — it is a public site.
            This one needs Sign out, so it sits after the links, separated by a
            hairline rule rather than by more spacing, which would otherwise read
            as another nav item. */}
        <div className="ml-8 flex shrink-0 items-center gap-4 border-l border-white/20 pl-8">
          <span className="text-[15px] text-white/80">{name || email}</span>
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
