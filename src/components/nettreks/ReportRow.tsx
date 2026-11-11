"use client";

import { useEffect, useRef, type MouseEvent, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { useProfileHref } from "@/hooks/useReturnTo";

/** How long a first click waits for a second one: a double-click selects a word
 *  to copy, and must not navigate away on its first click. */
const DOUBLE_CLICK_MS = 250;

/** Whether a click on a row should open it: not on a link or other control
 *  inside it, and not the end of a drag that selected text. */
export function clickOpensRow(target: Element, selectedText: string): boolean {
  return !target.closest("a, button, input, select, textarea") && selectedText === "";
}

/**
 * A table row that opens `href` when clicked anywhere (#920). The cells keep
 * their own links: the last name stays a real `<Link>` for keyboard and
 * open-in-new-tab, and the LinkedIn link still opens LinkedIn.
 *
 * `href` is a profile, so the row carries this list's URL as `?from=` (#937) —
 * the profile's Back button returns to the same filters, sort and page.
 */
export function ReportRow({
  href,
  className,
  children,
}: {
  href: string;
  className: string;
  children: ReactNode;
}) {
  const router = useRouter();
  const profileHref = useProfileHref();
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  function cancel() {
    if (timer.current !== null) clearTimeout(timer.current);
    timer.current = null;
  }

  useEffect(() => cancel, []);

  function onClick(e: MouseEvent<HTMLTableRowElement>) {
    cancel();
    const selected = () => window.getSelection()?.toString() ?? "";
    if (e.detail > 1 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    if (!clickOpensRow(e.target as Element, selected())) return;
    timer.current = setTimeout(() => {
      if (selected() === "") router.push(profileHref(href));
    }, DOUBLE_CLICK_MS);
  }

  return (
    <tr onClick={onClick} className={`cursor-pointer ${className}`}>
      {children}
    </tr>
  );
}
