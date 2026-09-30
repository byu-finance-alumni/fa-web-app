"use client";

import {
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";

/**
 * A number (or other short value) in the Progress table that reveals a small
 * panel on hover or keyboard focus (#836, extended #543 follow-on).
 *
 * The open/close behaviour and — the fiddly part — the positioning are shared
 * here so every hover in the table behaves identically: the "Replied" and
 * "Looks good" name lists (`ResponderCount`) and the "Median time to complete"
 * breakdown (`MedianFillTimeCount`) all render one of these. Only the trigger's
 * value, its spoken label, the panel title and the panel body differ, so those
 * are props; the panel is portalled and `fixed` for the reason below, which is
 * the whole reason this is not just an `absolute` div.
 */

// Width of the panel in px (`w-64`), and the gap between it and the trigger.
const PANEL_WIDTH = 256;
const PANEL_GAP = 4;
// Below this much room under the trigger, the panel opens upwards instead.
const PANEL_ROOM = 280;
// Grace period for the pointer to cross the gap between trigger and panel.
const CLOSE_DELAY_MS = 120;

type PanelPosition = { left: number; top?: number; bottom?: number };

/**
 * Where the panel goes, in viewport pixels. It is portalled and `fixed`
 * because the table sits in an `overflow-x-auto` wrapper, which clips an
 * absolutely-positioned child in BOTH directions — a panel under the last row
 * would be cut off or scroll the table.
 */
function panelPosition(rect: DOMRect): PanelPosition {
  // Right edge under the trigger's right edge (the cells are right-aligned),
  // kept inside the viewport.
  const left = Math.max(
    8,
    Math.min(rect.right - PANEL_WIDTH, window.innerWidth - PANEL_WIDTH - 8),
  );
  return window.innerHeight - rect.bottom < PANEL_ROOM
    ? { left, bottom: window.innerHeight - rect.top + PANEL_GAP }
    : { left, top: rect.bottom + PANEL_GAP };
}

export function HoverPopover({
  label,
  ariaLabel,
  title,
  onOpen,
  children,
}: {
  /** The trigger's visible content — a count, or a formatted time. */
  label: ReactNode;
  /** How the trigger reads to a screen reader. */
  ariaLabel: string;
  /** The panel's heading. */
  title: ReactNode;
  /** Run each time the panel opens — e.g. kick off the year's one fetch. */
  onOpen?: () => void;
  /** The panel body. */
  children: ReactNode;
}) {
  const [position, setPosition] = useState<PanelPosition | null>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const panelId = useId();
  const open = position !== null;

  const cancelClose = useCallback(() => {
    if (closeTimer.current) clearTimeout(closeTimer.current);
    closeTimer.current = null;
  }, []);

  const show = useCallback(() => {
    cancelClose();
    const el = triggerRef.current;
    if (!el) return;
    setPosition(panelPosition(el.getBoundingClientRect()));
    onOpen?.();
  }, [cancelClose, onOpen]);

  const hide = useCallback(() => {
    cancelClose();
    setPosition(null);
  }, [cancelClose]);

  const hideSoon = useCallback(() => {
    cancelClose();
    closeTimer.current = setTimeout(() => setPosition(null), CLOSE_DELAY_MS);
  }, [cancelClose]);

  // A `fixed` panel does not follow its trigger when the page scrolls, so it
  // closes instead. Capture phase, because the app scrolls `<main>`, not the
  // window, and a scroll event does not bubble. Scrolling the panel's OWN list
  // is not a page scroll and must not close it.
  useEffect(() => {
    if (!open) return;
    const onScroll = (e: Event) => {
      if (e.target instanceof Node && panelRef.current?.contains(e.target)) {
        return;
      }
      hide();
    };
    window.addEventListener("scroll", onScroll, true);
    window.addEventListener("resize", hide);
    return () => {
      window.removeEventListener("scroll", onScroll, true);
      window.removeEventListener("resize", hide);
    };
  }, [open, hide]);

  useEffect(() => cancelClose, [cancelClose]);

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        className="tabular-nums underline decoration-gray-300 decoration-dotted underline-offset-4 hover:text-navy-800 hover:decoration-navy-800 focus-visible:rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-blue-500"
        aria-label={ariaLabel}
        aria-describedby={open ? panelId : undefined}
        onMouseEnter={show}
        onMouseLeave={hideSoon}
        onFocus={show}
        onBlur={hide}
        onKeyDown={(e) => {
          if (e.key === "Escape") hide();
        }}
      >
        {label}
      </button>
      {open
        ? createPortal(
            <div
              ref={panelRef}
              id={panelId}
              role="tooltip"
              style={{ ...position, width: PANEL_WIDTH }}
              className="fixed z-50 rounded-lg border border-gray-200 bg-white p-3 text-left shadow-md"
              onMouseEnter={cancelClose}
              onMouseLeave={hideSoon}
            >
              <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                {title}
              </p>
              {children}
            </div>,
            document.body,
          )
        : null}
    </>
  );
}
