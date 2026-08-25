"use client";

import { useEffect, useRef, useState } from "react";
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
import { NavSearch } from "@/components/shell/NavSearch";
import { BrandPhotoBackdrop } from "@/components/shell/BrandPhotoBackdrop";
import { BrandWordmark } from "@/components/shell/BrandWordmark";

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
  // `email` and `name` are declared on the props but deliberately NOT
  // destructured — nothing renders them since the name came off the right edge.
  // Leaving them off here rather than aliasing them keeps the unused-vars rule
  // meaningful instead of muted.
  role,
  canVocab = false,
  capabilities = [],
  greeting,
}: {
  email?: string;
  /** Accepted but NOT rendered since the name came off the right edge. Kept on
   *  the props so this call site stays identical to the Sidebar's — swapping
   *  the two components back is one line either way. */
  name?: string;
  role: string;
  canVocab?: boolean;
  capabilities?: readonly string[];
  /**
   * The dashboard's masthead line. Passing it makes this ONE photo covering the
   * bar AND the greeting, rather than the bar's strip and a second band below —
   * which is the only way the two are genuinely continuous, since two separate
   * elements cannot be made to line up at every window width.
   *
   * The shell renders it because the shell owns the photo. It is derived here
   * from the same auth context the layout already reads for the user's name, so
   * no new request.
   */
  greeting?: string;
}) {
  const pathname = usePathname();
  const visibleNav = getVisibleNav(role, canVocab, capabilities);
  const activeHref = resolveActiveHref(pathname);
  const [openKey, setOpenKey] = useState<string | null>(null);
  const navRef = useRef<HTMLElement | null>(null);

  // Escape closes, and so does a click anywhere outside the nav. Without these
  // the only way out of a menu was to choose something from it, which is why an
  // open one felt stuck.
  useEffect(() => {
    if (!openKey) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpenKey(null);
    };
    const onClick = (e: MouseEvent) => {
      if (!navRef.current?.contains(e.target as Node)) setOpenKey(null);
    };
    document.addEventListener("keydown", onKey);
    // `click`, not `mousedown` — mousedown fires before the menu item's own
    // click and would close the panel out from under the selection.
    document.addEventListener("click", onClick);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("click", onClick);
    };
  }, [openKey]);

  // DASHBOARD ONLY: the bar shows the bare photo, no navy (Jake, 2026-08-21).
  // Everywhere else keeps the scrims. Matched exactly rather than by prefix —
  // there is no /dashboard/* subtree, and a prefix match would silently take the
  // scrim off any future one.
  const onDashboard = pathname === "/dashboard";
  // ONE PHOTO covering the bar and the masthead. Gated on the route as well as
  // the prop so a future page passing a greeting cannot silently grow a 240px
  // photo header.
  const showHero = onDashboard && Boolean(greeting);

  const isGroup = (item: NavItem): item is NavGroup =>
    (item as NavGroup).children !== undefined;

  return (
    <header className="relative hidden shrink-0 overflow-visible md:block">
      {/* The photo and its scrims, clipped to the bar. Same two-layer treatment
          the dashboard hero uses — a flat wash plus a left-heavy gradient — so
          the brand and the nav labels keep their contrast wherever the photo
          happens to be bright.

          Lives in `BrandPhotoBackdrop` since #756, because the PUBLIC survey
          shell wears the same background and a second copy of these opacities
          would drift from this one. Editing it changes the survey too — check
          both. Note it is the background ONLY: the nav below stays here, and
          must, since none of it is reachable for a survey respondent. */}
      <BrandPhotoBackdrop />

      {/* 96px, brand left, links RIGHT — the Silver Fund proportions. The links
          being right-aligned rather than packed against the brand is most of
          what makes that bar read as a masthead instead of a toolbar. */}
      {/* Just a positioning context. The h-16 row below owns the bar's height on
          EVERY page — this used to fall back to `h-24 flex items-center` when
          there was no masthead, which wrapped the 64px row inside a 96px flex
          box and pushed the links ~16px lower off the dashboard than on it. */}
      <div className="relative">
      <div className="flex h-16 items-center gap-6 px-8">
        {/* The type lives in `BrandWordmark` since #756 — the public survey
            shell shows the same lockup with a different descriptor and no link,
            since a stranger with a survey token has nowhere in the app to go. */}
        <Link href="/dashboard" className="shrink-0">
          <BrandWordmark trail="Alumni Database" />
        </Link>

        <nav ref={navRef} className="ml-auto flex min-w-0 items-center gap-8">
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

        {/* THE RIGHT EDGE. It was a hairline rule, the full user name and a
            white button, which over a photo read as three competing things
            crowding the corner. Now: the name is dropped (the bar is not where
            you check who you are signed in as — and it duplicated what the old
            sidebar footer showed), the rule goes with it, and Sign out sits on
            its own with the same 32px gap the links use between themselves. */}
        {/* Search sits between the links and Sign out (Jake, 2026-08-22). It is
            a control, not a destination, so it keeps the links' 32px gap on its
            left and rides in the same group as Sign out on its right. */}
        <div className="ml-8 flex shrink-0 items-center gap-3">
          <NavSearch />
          <SignOutButton onDark />
        </div>
      </div>

      {/* The greeting sits UNDER the nav row and INSIDE the same photo, which is
          the whole point of moving it here: one image, one scrim, no seam. The
          height is the old band's 144px, so the page below is unchanged. */}
      {showHero ? (
        /* `justify-start`, not `justify-center`. Centred in 144px the block sat
           low enough that the KPI tiles — which are pulled up 56px to straddle
           the photo — covered the subtitle; you could see the last few letters
           of it behind the first card. Top-aligned, the text finishes ~16px
           above where the tiles begin. */
        <div className="flex h-36 flex-col justify-start px-8 pt-2">
          <h1 className="text-3xl font-bold tracking-tight text-white drop-shadow-sm md:text-4xl">
            {greeting}
          </h1>
          <p className="mt-1 max-w-2xl text-sm font-normal text-white">
            Here&rsquo;s what&rsquo;s happening across the BYU Finance alumni
            network today.
          </p>
        </div>
      ) : null}
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
