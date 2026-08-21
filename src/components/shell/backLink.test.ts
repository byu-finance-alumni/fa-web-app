import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

import { resolveActiveHref } from "@/components/shell/nav";

const src = readFileSync(
  resolve(__dirname, "BackLink.tsx"),
  "utf-8",
);

/**
 * The rule the Back button is derived from, asserted on the real nav model.
 *
 * The button replaces a breadcrumb that was removed when navigation moved into
 * the photo bar, so the thing worth pinning is WHERE it appears: nowhere on a
 * destination, everywhere below one. Deriving that from `resolveActiveHref`
 * rather than a list is what makes a new sub-route get one for free — and this
 * test is what stops someone "simplifying" it back into a list.
 */
describe("where Back appears", () => {
  it("does not appear on a top-level destination", () => {
    for (const href of ["/dashboard", "/alumni", "/events", "/map"]) {
      expect(resolveActiveHref(href)).toBe(href);
    }
  });

  it("appears on anything below one", () => {
    for (const path of ["/alumni/842", "/events/12", "/alumni/842/edit"]) {
      expect(resolveActiveHref(path)).not.toBe(path);
    }
  });

  it("is derived, not a hard-coded list of routes", () => {
    expect(src).toContain("resolveActiveHref");
    expect(src).not.toMatch(/const\s+\w*(ROUTES|PATHS)\w*\s*=\s*\[/);
  });

  it("goes back one step rather than to the parent route", () => {
    // `router.back()` returns you to the search you came from, filters intact —
    // a link to the parent would throw that away.
    expect(src).toContain("router.back()");
  });
});
