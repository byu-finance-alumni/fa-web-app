import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

import { describeLoadFailure, isPermissionAnswer } from "./loadError";

/**
 * The failure-copy rules from #688.
 *
 * THE PROPERTY THESE TESTS PROTECT is that a failed read can never be read as
 * an empty one. Two halves, mirroring `maintenance.test.ts`:
 *
 *   1. `describeLoadFailure` always produces copy that names the failure, keeps
 *      a permission answer separate from a fault, and never echoes the
 *      backend's own message.
 *   2. The pages that render a failed load actually use the shared component
 *      rather than a bespoke card that quietly leaks `error.message` again.
 *      That's a structural fact about specific files, so it is guarded by
 *      reading the source — a re-introduced one-off card fails here.
 */

const ALL_STATUSES = [0, 400, 401, 403, 404, 408, 422, 429, 500, 502, 503, 504];

function read(relPath: string): string {
  return readFileSync(resolve(process.cwd(), relPath), "utf8");
}

// --- describeLoadFailure: a fault never reads as an empty result -------------

describe("describeLoadFailure", () => {
  it("never renders as an empty result, whatever the status", () => {
    for (const status of ALL_STATUSES) {
      const { title, message } = describeLoadFailure(status, "links");
      // "No links yet" / "No links match your filters" is the EMPTY state. None
      // of these may be mistakable for it.
      expect(title.toLowerCase()).not.toMatch(/^no /);
      expect(message.length).toBeGreaterThan(20);
    }
  });

  it("says outright that nothing loaded on every fault", () => {
    // The four fault classes (as opposed to the two permission answers) each
    // have to state the fact the incident's screen failed to state.
    for (const status of [0, 408, 500, 503, 504, 429]) {
      const { message } = describeLoadFailure(status, "links");
      expect(message.toLowerCase()).toMatch(
        /couldn’t connect|didn’t answer|returned an error|wasn’t loaded/,
      );
    }
  });

  it("classifies each status the way the UI branches on it", () => {
    expect(describeLoadFailure(null, "links").kind).toBe("unreachable");
    expect(describeLoadFailure(0, "links").kind).toBe("unreachable");
    expect(describeLoadFailure(408, "links").kind).toBe("timeout");
    expect(describeLoadFailure(504, "links").kind).toBe("timeout");
    expect(describeLoadFailure(401, "links").kind).toBe("signed-out");
    expect(describeLoadFailure(403, "links").kind).toBe("forbidden");
    expect(describeLoadFailure(429, "links").kind).toBe("rate-limited");
    expect(describeLoadFailure(500, "links").kind).toBe("server");
    expect(describeLoadFailure(503, "links").kind).toBe("server");
    expect(describeLoadFailure(404, "links").kind).toBe("rejected");
    expect(describeLoadFailure(422, "links").kind).toBe("rejected");
  });

  it("offers a retry only where the same request could succeed", () => {
    // Transient: worth a second try.
    for (const status of [0, 408, 429, 500, 503, 504]) {
      expect(describeLoadFailure(status, "links").retryable).toBe(true);
    }
    // Settled answers and deterministic rejections: a retry re-asks a question
    // that has already been answered.
    for (const status of [401, 403, 404, 422]) {
      expect(describeLoadFailure(status, "links").retryable).toBe(false);
    }
  });

  it("carries the status as a support reference, and nothing else", () => {
    expect(describeLoadFailure(503, "links").reference).toBe(503);
    // Nothing answered, so there is no status to quote.
    expect(describeLoadFailure(0, "links").reference).toBeNull();
    expect(describeLoadFailure(null, "links").reference).toBeNull();
  });

  it("names what failed to load", () => {
    const { message } = describeLoadFailure(500, "the audit log");
    expect(message).toContain("nothing was loaded");
    expect(describeLoadFailure(500, "the audit log").title).toContain(
      "the audit log",
    );
  });
});

// --- isPermissionAnswer: the distinction the incident turned on -------------

describe("isPermissionAnswer", () => {
  it("treats only 401/403 as an answer about the account", () => {
    expect(isPermissionAnswer(401)).toBe(true);
    expect(isPermissionAnswer(403)).toBe(true);
    // A fault is not a denial. Collapsing these two is what rendered a Super
    // Admin as a no-capability account during the 2026-08-18 incident.
    for (const status of [null, 0, 408, 429, 500, 502, 503, 504]) {
      expect(isPermissionAnswer(status)).toBe(false);
    }
  });
});

// --- structural: the shared state is actually the one being used ------------

describe("failed loads use the shared error state", () => {
  /** Pages whose primary list/panel renders a failed API read. */
  const PAGES = [
    "src/app/(app)/activity/page.tsx",
    "src/app/(app)/admin/page.tsx",
    "src/app/(app)/audit/page.tsx",
    "src/app/(app)/dashboard/page.tsx",
    "src/app/(app)/data-quality/page.tsx",
    "src/app/(app)/engineer/login-failures/page.tsx",
    "src/app/(app)/engineer/logins/page.tsx",
    "src/app/(app)/engineer/maintenance/page.tsx",
    "src/app/(app)/engineer/permissions/page.tsx",
    "src/app/(app)/engineer/preview/page.tsx",
    "src/app/(app)/engineer/support-contacts/page.tsx",
    "src/app/(app)/engineer/surveys/page.tsx",
    "src/app/(app)/events/page.tsx",
    "src/app/(app)/links/page.tsx",
    "src/app/(app)/map/page.tsx",
    "src/app/(app)/pay-it-forward/page.tsx",
    "src/app/(app)/tasks/page.tsx",
    "src/app/(app)/vocabulary/page.tsx",
    "src/components/alumni/AlumniRoster.tsx",
  ];

  it.each(PAGES)("%s renders <LoadError>", (page) => {
    expect(read(page)).toContain("<LoadError");
  });

  it.each(PAGES)("%s does not print the backend's message", (page) => {
    // `error.message` is the upstream text. On this app it can carry table
    // names, record ids and internal URLs, and it used to be rendered straight
    // into the page. The status code (via LoadError) is the only detail we show.
    expect(read(page)).not.toMatch(/\{error\??\.message\}/);
  });
});

// --- structural: a capability fault must not read as a permission answer ----

describe("capability reads separate a denial from a fault", () => {
  it("the app shell refuses to render a guessed sidebar", () => {
    const layout = read("src/app/(app)/layout.tsx");
    // The incident: `catch { }` left every nav flag false and a Super Admin got
    // a stripped sidebar with no indication anything was wrong.
    expect(layout).toContain("readAuthContext");
    expect(layout).toContain('auth.status === "unavailable"');
    expect(layout).toContain("<LoadError");
  });

  it.each([
    "src/app/(app)/events/page.tsx",
    "src/app/(app)/links/page.tsx",
    "src/app/(app)/pay-it-forward/page.tsx",
    "src/app/(app)/alumni/[id]/page.tsx",
    "src/components/alumni/AlumniRoster.tsx",
  ])("%s handles an unreadable capability list explicitly", (page) => {
    const source = read(page);
    expect(source).toContain("readAuthContext");
    expect(source).toContain('"unavailable"');
  });
});
