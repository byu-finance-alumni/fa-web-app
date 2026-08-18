"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { LinksSelectionToggle } from "@/components/links/LinksSelection";
import {
  DEFAULT_STATUS,
  EMPTY_LINKS_FILTERS,
  ROLE_TYPES,
  ROLE_TYPE_LABELS,
  STATUSES,
  STATUS_LABELS,
  hasActiveLinkFilters,
  toLinksQs,
  type LinksFilterState,
} from "@/lib/opportunityLinks";

/**
 * Toolbar for the Links list: "Add link" on the left, the live search spanning
 * the middle, then the blue Edit (selection-mode) button and the Filters menu
 * pinned far right.
 *
 * Deliberately the same machine as `EventsToolbar` / `AuditToolbar` — live
 * filtering with no Apply button, `replace()` rather than `push()` so Back does
 * not step through every keystroke, a 300 ms debounce that clearing skips, and a
 * guarded re-seed so a deep link updates the inputs without clobbering typing.
 * The serializer lives in `@/lib/opportunityLinks` because the page uses the
 * same one to build the backend query.
 */
export function LinksToolbar({
  initial,
  canReview,
  createHref = null,
}: {
  initial: LinksFilterState;
  /**
   * Holder of the surveys-management permission. Only they may request
   * `status=pending|rejected` — the backend 403s anyone else — so for everyone
   * else the status control is not rendered at all rather than offered and
   * rejected.
   */
  canReview: boolean;
  /** Destination for the "Add link" button, or `null` to hide it. */
  createHref?: string | null;
}) {
  const router = useRouter();
  const [f, setF] = useState<LinksFilterState>(initial);
  const [menuOpen, setMenuOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const menuRef = useRef<HTMLDivElement>(null);
  // Query string of the last navigation WE initiated (or were seeded with) —
  // distinguishes our own URL updates from external ones (deep links, Clear).
  const lastPushedRef = useRef(toLinksQs(initial));

  const serialized = toLinksQs(f);
  const initialQs = toLinksQs(initial);

  useEffect(() => {
    if (serialized === lastPushedRef.current) return;
    const navigate = () => {
      lastPushedRef.current = serialized;
      startTransition(() => {
        // Any filter change resets paging — offset is deliberately dropped here
        // rather than carried, so page 4 of "approved" can't survive into a
        // two-row "pending" list and render an empty table.
        router.replace(serialized ? `/links?${serialized}` : "/links");
      });
    };
    if (serialized === "") {
      navigate();
      return;
    }
    const timer = setTimeout(navigate, 300);
    return () => clearTimeout(timer);
  }, [serialized, router]);

  // Re-seed only when the URL changed from outside (e.g. a deep link) — never
  // in response to our own pushes mid-typing.
  useEffect(() => {
    if (initialQs !== lastPushedRef.current) {
      lastPushedRef.current = initialQs;
      setF(initial);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialQs]);

  // Close the menu on any click outside it.
  useEffect(() => {
    function onMouseDown(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    }
    document.addEventListener("mousedown", onMouseDown);
    return () => document.removeEventListener("mousedown", onMouseDown);
  }, []);

  const set = <K extends keyof LinksFilterState>(
    key: K,
    value: LinksFilterState[K],
  ) => setF((prev) => ({ ...prev, [key]: value }));

  const activeCount =
    (f.status !== DEFAULT_STATUS ? 1 : 0) +
    (f.role_type ? 1 : 0) +
    (f.company.trim() ? 1 : 0);

  const isDirty = hasActiveLinkFilters(f);

  return (
    <div className="mb-4 flex flex-wrap items-center gap-2 rounded-lg border border-gray-200 bg-white p-3 shadow-card">
      {createHref ? (
        <Button asChild className="shrink-0">
          <Link href={createHref}>Add link</Link>
        </Button>
      ) : null}

      {/* Text-only controls throughout, per the standing project rule — no
          magnifier glyph, no slider glyph, and the in-flight state is the word
          "Searching" rather than a spinner. */}
      <div className="flex h-9 min-w-[160px] flex-1 items-center gap-2 rounded-md border border-gray-300 bg-white px-3 focus-within:border-brand-blue-600 focus-within:ring-2 focus-within:ring-brand-blue-500 focus-within:ring-offset-1 md:min-w-[220px]">
        <input
          value={f.q}
          onChange={(e) => set("q", e.target.value)}
          placeholder="Search company, location, details or URL"
          aria-label="Search opportunity links"
          className="w-full bg-transparent text-base text-gray-900 placeholder:text-gray-400 focus:outline-none md:text-sm"
        />
        <span
          aria-hidden={!isPending}
          className={`shrink-0 text-xs font-medium text-gray-500 ${
            isPending ? "" : "invisible"
          }`}
        >
          Searching…
        </span>
      </div>

      {/* Status sits inline rather than in the menu: on a moderation surface it
          is the control staff reach for most, and burying "show me what's
          waiting" behind a dropdown-in-a-dropdown is the wrong default. */}
      {canReview ? (
        <Select
          value={f.status}
          onChange={(e) =>
            set("status", e.target.value as LinksFilterState["status"])
          }
          aria-label="Moderation status"
          className="hidden w-auto shrink-0 font-semibold text-gray-700 md:block"
          style={{ colorScheme: "light" }}
        >
          {STATUSES.map((s) => (
            <option key={s} value={s}>
              {STATUS_LABELS[s]}
            </option>
          ))}
        </Select>
      ) : null}

      {/* The owner's ask: a blue Edit button "next to filters". It renders only
          for holders of `links.delete` — the component reads the selection
          context, which the page seeds from the capability and which is absent
          (so the button is absent) for everyone else. */}
      <LinksSelectionToggle />

      <div ref={menuRef} className="relative shrink-0">
        <Button
          type="button"
          variant="secondary"
          onClick={() => setMenuOpen((o) => !o)}
          aria-expanded={menuOpen}
          aria-haspopup="true"
          className="h-9"
        >
          Filters
          {activeCount > 0 && (
            <Badge variant="solid" size="sm" className="tabular-nums">
              {activeCount}
            </Badge>
          )}
        </Button>

        {menuOpen && (
          <div className="absolute right-0 top-full z-50 mt-1 w-80 max-w-[calc(100vw-2rem)] rounded-lg border border-gray-200 bg-white p-4 shadow-card">
            <div className="space-y-4">
              {/* Mobile only: status lives in the menu (desktop has it inline). */}
              {canReview ? (
                <div className="md:hidden">
                  <Label className="mb-1.5">Status</Label>
                  <Select
                    value={f.status}
                    onChange={(e) =>
                      set("status", e.target.value as LinksFilterState["status"])
                    }
                    aria-label="Moderation status"
                    style={{ colorScheme: "light" }}
                  >
                    {STATUSES.map((s) => (
                      <option key={s} value={s}>
                        {STATUS_LABELS[s]}
                      </option>
                    ))}
                  </Select>
                </div>
              ) : null}

              <div>
                <Label className="mb-1.5">Role type</Label>
                <Select
                  value={f.role_type}
                  onChange={(e) => {
                    set(
                      "role_type",
                      e.target.value as LinksFilterState["role_type"],
                    );
                    // A role-type pick is a complete selection; close the menu
                    // so the user isn't left clicking outside to dismiss it.
                    setMenuOpen(false);
                  }}
                  aria-label="Role type"
                  style={{ colorScheme: "light" }}
                >
                  <option value="">Any role type</option>
                  {ROLE_TYPES.map((r) => (
                    <option key={r} value={r}>
                      {ROLE_TYPE_LABELS[r]}
                    </option>
                  ))}
                </Select>
              </div>

              <div>
                <Label className="mb-1.5" htmlFor="links-company-filter">
                  Company
                </Label>
                <Input
                  id="links-company-filter"
                  value={f.company}
                  onChange={(e) => set("company", e.target.value)}
                  placeholder="e.g. Goldman"
                  className="min-w-0"
                />
              </div>

              <Button
                type="button"
                variant="secondary"
                onClick={() => setF(EMPTY_LINKS_FILTERS)}
                disabled={!isDirty}
                className="w-full"
              >
                Clear all filters
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
