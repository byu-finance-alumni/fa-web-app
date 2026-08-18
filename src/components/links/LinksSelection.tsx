"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { Button } from "@/components/ui/button";
import {
  pruneLinkSelection,
  setPageLinkSelection,
  toggleLinkSelection,
} from "@/lib/opportunityLinks";

/**
 * The Links tab's selection mode — the shared, EPHEMERAL state behind the blue
 * Edit button, the row checkboxes and the bulk-delete bar.
 *
 * WHY A CONTEXT. The three pieces sit in three different places in the tree: the
 * Edit button belongs next to Filters in the toolbar, the checkboxes belong in
 * the table, and the count and Delete belong on their own row between them. They
 * are separated by a server component (the page), so a lifted `useState` would
 * mean turning the whole screen into one client component. The provider wraps
 * them instead; server-rendered children pass straight through.
 *
 * WHY IT IS NOT IN THE URL. Every other control on this page is URL-driven, and
 * this one deliberately is not. A shareable/bookmarkable "I have these four rows
 * ticked for deletion" is not a thing anyone wants, Back would step through
 * every checkbox click, and a link that arrives pre-armed for a destructive
 * action is a trap. Selection mode dies with the tab.
 *
 * FAIL CLOSED. `canDelete` comes from the `links.delete` capability, resolved on
 * the server; when the capability context can't be read the page passes `false`
 * and there is no way into selection mode at all. Consumers outside a provider
 * get `null` from {@link useLinksSelection} and render nothing. As always this is
 * UX — the backend re-checks the delete on every request.
 */

export interface LinksSelectionState {
  /** Holder of `links.delete`. False disables the whole mechanism. */
  canDelete: boolean;
  /** Selection mode is on — checkboxes are showing. */
  active: boolean;
  /** Selected link ids, in the order they were ticked. */
  selected: number[];
  enter: () => void;
  /** Leave selection mode. ALWAYS clears the selection (see the page docs). */
  exit: () => void;
  toggle: (id: number) => void;
  /** Select-all / clear-all across the rows currently on screen. */
  setPage: (pageIds: readonly number[], checked: boolean) => void;
  clear: () => void;
}

const LinksSelectionContext = createContext<LinksSelectionState | null>(null);

/** The selection state, or `null` outside a provider (render nothing). */
export function useLinksSelection(): LinksSelectionState | null {
  return useContext(LinksSelectionContext);
}

export function LinksSelectionProvider({
  canDelete,
  pageIds,
  children,
}: {
  canDelete: boolean;
  /**
   * The ids currently rendered. The selection is pruned to these whenever they
   * change — a filter edit or a page step must not leave rows armed for deletion
   * that the user can no longer see or untick.
   */
  pageIds: readonly number[];
  children: React.ReactNode;
}) {
  const [active, setActive] = useState(false);
  const [selected, setSelected] = useState<number[]>([]);

  // A stable, comparable identity for "which rows are on screen", so the prune
  // effect fires on a real page change rather than on every render's new array.
  const pageKey = pageIds.join(",");
  const pageIdsRef = useRef(pageIds);
  pageIdsRef.current = pageIds;

  useEffect(() => {
    setSelected((prev) =>
      prev.length === 0 ? prev : pruneLinkSelection(prev, pageIdsRef.current),
    );
  }, [pageKey]);

  const enter = useCallback(() => setActive(true), []);
  const exit = useCallback(() => {
    setActive(false);
    setSelected([]);
  }, []);
  const clear = useCallback(() => setSelected([]), []);
  const toggle = useCallback(
    (id: number) => setSelected((prev) => toggleLinkSelection(prev, id)),
    [],
  );
  const setPage = useCallback(
    (ids: readonly number[], checked: boolean) =>
      setSelected((prev) => setPageLinkSelection(prev, ids, checked)),
    [],
  );

  const value = useMemo<LinksSelectionState>(
    () => ({
      canDelete,
      // Belt and braces: without the capability there is no selection mode even
      // if something managed to call `enter()`.
      active: canDelete && active,
      selected,
      enter,
      exit,
      toggle,
      setPage,
      clear,
    }),
    [canDelete, active, selected, enter, exit, toggle, setPage, clear],
  );

  return (
    <LinksSelectionContext.Provider value={value}>
      {children}
    </LinksSelectionContext.Provider>
  );
}

/**
 * The blue Edit button that sits next to Filters, and its way out.
 *
 * Blue is the owner's ask; the hex is not ours to pick, so this is the standard
 * `primary` Button variant — `brand-blue-600` from the design tokens. Text-only
 * both ways, per the standing no-icons rule.
 */
export function LinksSelectionToggle() {
  const selection = useLinksSelection();
  if (!selection?.canDelete) return null;

  return (
    <Button
      type="button"
      variant={selection.active ? "secondary" : "primary"}
      onClick={() => (selection.active ? selection.exit() : selection.enter())}
      aria-pressed={selection.active}
      className="h-9"
    >
      {selection.active ? "Done" : "Edit"}
      <span className="sr-only">
        {selection.active
          ? " — leave selection mode"
          : " links — select rows to delete"}
      </span>
    </Button>
  );
}
