import { readdirSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

import { shouldShowBack } from "@/components/shell/BackLink";

const src = readFileSync(resolve(__dirname, "BackLink.tsx"), "utf-8");

/** Every real route under the (app) group, as a URL path. */
function appRoutes(dir: string, prefix = ""): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (entry.isDirectory()) {
      // Route groups like (app) add a directory but no path segment.
      const segment = entry.name.startsWith("(") ? "" : `/${entry.name}`;
      out.push(...appRoutes(resolve(dir, entry.name), prefix + segment));
    } else if (entry.name === "page.tsx") {
      out.push(prefix || "/");
    }
  }
  return out;
}

const ROUTES = appRoutes(resolve(__dirname, "../../app/(app)"));

/**
 * WHERE Back appears, asserted against the routes that actually exist.
 *
 * It replaces a breadcrumb that went away when navigation moved into the photo
 * bar, and it is deliberately NOT on every deep route — only the screens you
 * open to enter something and then leave. Listing the expected set here is the
 * point: add a form route and this test fails, which is the prompt to decide
 * whether it wants a Back rather than silently going without one.
 */
describe("where Back appears", () => {
  it("covers the data-entry screens and nothing else", () => {
    expect(ROUTES.length).toBeGreaterThan(30);
    expect(ROUTES.filter(shouldShowBack).sort()).toEqual([
      "/admin/import",
      "/admin/import/update",
      "/alumni/[id]/edit",
      "/alumni/[id]/edit/designation",
      "/alumni/[id]/edit/employment",
      "/alumni/[id]/edit/engagement",
      "/alumni/[id]/edit/graduate",
      "/alumni/[id]/edit/narrative",
      "/alumni/[id]/edit/personal",
      "/alumni/new",
      "/events/[id]/attendees/import",
      "/events/[id]/edit",
      "/events/import",
      "/events/new",
      "/friends/import",
      "/links/new",
      "/pay-it-forward/import",
    ]);
  });

  it("stays off the browse screens it used to sit on", () => {
    // These are DEEP but they are destinations, not forms — the earlier
    // "anything below its nav entry" rule put a button on all of them.
    for (const path of [
      "/dashboard",
      "/alumni",
      "/alumni/842",
      "/friends/17",
      "/map/state/UT",
      "/map/breakdown/industry",
      "/engineer/login-failures",
    ]) {
      expect(shouldShowBack(path)).toBe(false);
    }
  });

  it("goes back one step rather than to the parent route", () => {
    // `router.back()` returns you to the search you came from, filters intact —
    // a link to the parent would throw that away.
    expect(src).toContain("router.back()");
  });
});
