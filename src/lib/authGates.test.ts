import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";

/**
 * A permission gate must tell "the backend said no" apart from "the backend
 * said nothing" (#688), and must resolve the second one CLOSED.
 *
 * Before this, every route guard in the app had exactly two outcomes. A single
 * `catch` (or `.catch(() => null)`) collapsed a 403 and a 502 into the same
 * value and then redirected on it, which failed two different ways depending on
 * the screen:
 *
 *   * most gates redirected on a fault — a full-access user pressing "Add
 *     alumni" during the 2026-08-18 outage was silently returned to the roster,
 *     which reads as "my permission was revoked", not "the API is down", and
 *     moved them off the URL a reload would have retried;
 *   * two gates (the engineer console layout, the vocabulary editor)
 *     deliberately fell the OTHER way and rendered the screen on a fault, on the
 *     reasoning that the backend 403s the underlying endpoints anyway. That is
 *     fail-open: the endpoints do hold, but the UI had opened a door it never
 *     checked.
 *
 * Three outcomes now: render on a verified success, redirect on a real 401/403,
 * and render an in-place error when the context could not be read at all.
 *
 * Two halves, mirroring `loadError.test.ts`: the behaviour is exercised for
 * real against the one gate that lives in a plain module (`loadEditableProfile`
 * — every alumni edit screen goes through it), and the rest are pinned as
 * source invariants, because a Server Component page cannot be rendered in
 * vitest's node environment.
 */

function read(relPath: string): string {
  return readFileSync(resolve(process.cwd(), relPath), "utf8");
}

// --- behavioural: readAuthContext classifies every failure ------------------

/**
 * `@/lib/api` reaches for `next/headers`, which has no meaning outside a
 * request, so it is replaced wholesale. The stub `ApiError` keeps the same
 * shape the real one has, because the classification below turns on
 * `instanceof`.
 */
class StubApiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

const apiGetWithRetry = vi.fn();
const apiGet = vi.fn();

vi.mock("@/lib/api", () => ({
  ApiError: StubApiError,
  apiGet: (...args: unknown[]) => apiGet(...args),
  apiGetWithRetry: (...args: unknown[]) => apiGetWithRetry(...args),
}));

const redirect = vi.fn((to: string) => {
  // The real one throws a control-flow signal; anything after a redirect in a
  // gate is unreachable, and these tests must observe that too.
  throw new Error(`NEXT_REDIRECT:${to}`);
});
const notFound = vi.fn(() => {
  throw new Error("NEXT_NOT_FOUND");
});

vi.mock("next/navigation", () => ({
  redirect: (to: string) => redirect(to),
  notFound: () => notFound(),
}));

afterEach(() => {
  vi.clearAllMocks();
  // `getAuthContext` is wrapped in React's `cache()`. Re-import the module tree
  // per case so one test's resolved context can never be served to the next.
  vi.resetModules();
});

async function readAuth() {
  const { readAuthContext } = await import("./auth-context");
  return readAuthContext();
}

describe("readAuthContext separates a denial from a fault", () => {
  it("a successful read is ok, and carries the context through", async () => {
    apiGetWithRetry.mockResolvedValueOnce({
      roles: ["full_access"],
      capabilities: ["alumni.create"],
    });
    const auth = await readAuth();
    expect(auth.status).toBe("ok");
    expect(auth.status === "ok" && auth.ctx.roles).toEqual(["full_access"]);
  });

  it.each([401, 403])("%d is a real answer — denied, not unavailable", async (status) => {
    apiGetWithRetry.mockRejectedValueOnce(new StubApiError(status, "nope"));
    const auth = await readAuth();
    expect(auth.status).toBe("denied");
    expect(auth.status === "denied" && auth.httpStatus).toBe(status);
  });

  it.each([0, 408, 500, 502, 503, 504])(
    "%d is a fault — unavailable, never denied",
    async (status) => {
      apiGetWithRetry.mockRejectedValueOnce(new StubApiError(status, "boom"));
      const auth = await readAuth();
      expect(auth.status).toBe("unavailable");
      expect(auth.status === "unavailable" && auth.httpStatus).toBe(status);
    },
  );

  it("a throw that is not an ApiError is unavailable with no status", async () => {
    // A network fault, a thrown string, a bug in the fetch wrapper: we know
    // nothing, so we must not claim the user was denied.
    apiGetWithRetry.mockRejectedValueOnce(new TypeError("fetch failed"));
    const auth = await readAuth();
    expect(auth.status).toBe("unavailable");
    expect(auth.status === "unavailable" && auth.httpStatus).toBeNull();
  });

  it("never reports a fault as denied, across every status", async () => {
    // The property in one line: `denied` is reachable ONLY from 401/403.
    for (const status of [0, 400, 404, 408, 422, 429, 500, 502, 503, 504]) {
      apiGetWithRetry.mockRejectedValueOnce(new StubApiError(status, "x"));
      const auth = await readAuth();
      expect(auth.status).not.toBe("denied");
      vi.resetModules();
    }
  });
});

// --- behavioural: the alumni edit gate, end to end -------------------------

const EDIT_GATE = "@/app/(app)/alumni/[id]/edit/load-profile";

async function loadEditable(id: string) {
  const { loadEditableProfile } = await import(EDIT_GATE);
  return loadEditableProfile(id);
}

describe("loadEditableProfile: outage and denial diverge", () => {
  it("an edit-tier role gets the profile", async () => {
    apiGetWithRetry.mockResolvedValueOnce({ roles: ["full_access"] });
    apiGet.mockResolvedValueOnce({ alumni: { alumni_id: 7 } });
    const result = await loadEditable("7");
    expect(result).toEqual({ status: "ok", profile: { alumni: { alumni_id: 7 } } });
    expect(redirect).not.toHaveBeenCalled();
  });

  it("a view-only role is redirected to the read-only profile", async () => {
    // The backend answered, and the answer is no. Moving them is correct.
    apiGetWithRetry.mockResolvedValueOnce({ roles: ["view_only"] });
    await expect(loadEditable("7")).rejects.toThrow("NEXT_REDIRECT:/alumni/7");
    expect(redirect).toHaveBeenCalledWith("/alumni/7");
    expect(apiGet).not.toHaveBeenCalled();
  });

  it.each([401, 403])("a %d is also a redirect", async (status) => {
    apiGetWithRetry.mockRejectedValueOnce(new StubApiError(status, "denied"));
    await expect(loadEditable("7")).rejects.toThrow("NEXT_REDIRECT:/alumni/7");
    expect(redirect).toHaveBeenCalledWith("/alumni/7");
  });

  it("a 500 does NOT redirect — it reports unavailable in place", async () => {
    // The regression this whole change exists to prevent: an outage that reads
    // as a revoked permission and silently changes the URL.
    apiGetWithRetry.mockRejectedValueOnce(new StubApiError(500, "boom"));
    const result = await loadEditable("7");
    expect(result).toEqual({ status: "unavailable", httpStatus: 500 });
    expect(redirect).not.toHaveBeenCalled();
  });

  it("an unreachable API does not redirect either", async () => {
    apiGetWithRetry.mockRejectedValueOnce(new StubApiError(0, "unreachable"));
    const result = await loadEditable("7");
    expect(result).toEqual({ status: "unavailable", httpStatus: 0 });
    expect(redirect).not.toHaveBeenCalled();
  });

  it("FAILS CLOSED: an unreadable context never fetches the profile", async () => {
    // The other half of the property, and the one that matters most. Not
    // redirecting must not mean falling through into the editable screen: the
    // profile read is the first thing an "allowed" path does, so its absence is
    // the proof that nothing downstream ran.
    apiGetWithRetry.mockRejectedValueOnce(new StubApiError(503, "down"));
    const result = await loadEditable("7");
    expect(result.status).toBe("unavailable");
    expect(apiGet).not.toHaveBeenCalled();
  });
});

// --- structural: every route guard splits the two, and defaults to closed ---

/**
 * Guards that redirect on a real denial and render {@link AccessCheckError} on
 * an unreadable context. Server Component pages can't be rendered here, so the
 * shape is pinned by reading the source — the same altitude as
 * `session-invariants.test.ts`.
 */
const GATED_PAGES = [
  "src/app/(app)/alumni/new/page.tsx",
  "src/app/(app)/alumni/[id]/edit/page.tsx",
  "src/app/(app)/alumni/[id]/edit/designation/page.tsx",
  "src/app/(app)/alumni/[id]/edit/employment/page.tsx",
  "src/app/(app)/alumni/[id]/edit/engagement/page.tsx",
  "src/app/(app)/alumni/[id]/edit/graduate/page.tsx",
  "src/app/(app)/alumni/[id]/edit/narrative/page.tsx",
  "src/app/(app)/alumni/[id]/edit/personal/page.tsx",
  "src/app/(app)/admin/page.tsx",
  "src/app/(app)/admin/import/page.tsx",
  "src/app/(app)/admin/import/update/page.tsx",
  "src/app/(app)/audit/page.tsx",
  "src/app/(app)/engineer/layout.tsx",
  "src/app/(app)/engineer/page.tsx",
  "src/app/(app)/engineer/login-failures/page.tsx",
  "src/app/(app)/engineer/logins/page.tsx",
  "src/app/(app)/engineer/maintenance/page.tsx",
  "src/app/(app)/engineer/permissions/page.tsx",
  "src/app/(app)/engineer/preview/page.tsx",
  "src/app/(app)/engineer/support-contacts/page.tsx",
  "src/app/(app)/engineer/surveys/page.tsx",
  "src/app/(app)/events/new/page.tsx",
  "src/app/(app)/events/import/page.tsx",
  "src/app/(app)/events/[id]/edit/page.tsx",
  "src/app/(app)/events/[id]/attendees/import/page.tsx",
  "src/app/(app)/friends/import/page.tsx",
  "src/app/(app)/links/new/page.tsx",
  "src/app/(app)/pay-it-forward/import/page.tsx",
  "src/app/(app)/vocabulary/page.tsx",
];

/** The subset that resolves the gate itself rather than delegating to it. */
const DIRECT_GATES = GATED_PAGES.filter(
  (p) => !p.startsWith("src/app/(app)/alumni/[id]/edit/"),
);

describe("every permission gate handles an unreadable context", () => {
  it.each(GATED_PAGES)("%s renders <AccessCheckError>", (page) => {
    // Not a redirect, and not the page: an explicit error, on the URL the user
    // asked for.
    expect(read(page)).toContain("<AccessCheckError");
  });

  it.each(DIRECT_GATES)("%s branches on the unavailable status", (page) => {
    expect(read(page)).toContain("readAuthContext");
    expect(read(page)).toContain('auth.status === "unavailable"');
  });

  it.each(GATED_PAGES)("%s still redirects a real denial", (page) => {
    // The gate must not have been softened into "always show an error" — a
    // 401/403 is an answer and moving the user is the right response to it.
    const src = read(page);
    if (page.startsWith("src/app/(app)/alumni/[id]/edit/")) {
      // These delegate the denial redirect to the shared loader.
      expect(src).toContain("loadEditableProfile");
    } else {
      expect(src).toMatch(/redirect\(/);
    }
  });

  it.each(GATED_PAGES)("%s reads no capability from a catch block", (page) => {
    // The conflating shapes, by name. `catch { canX = false }` and
    // `.catch(() => null)` are exactly what could not tell 403 from 503.
    const src = read(page);
    expect(src).not.toContain("getAuthContext().catch(");
    expect(src).not.toMatch(/catch\s*\{[^}]*can[A-Z]\w*\s*=/);
  });

  it.each(DIRECT_GATES)("%s raises its flags only on a verified success", (page) => {
    const src = read(page);
    // Every capability/role flag a gate resolves starts false…
    for (const [, flag] of src.matchAll(/\blet (can\w+|denied|gate)\b/g)) {
      if (flag === "denied") {
        // …with `denied` inverted: it starts TRUE and is cleared on success.
        expect(src).toMatch(new RegExp(`let ${flag} = true;`));
      } else if (flag !== "gate") {
        expect(src).toMatch(new RegExp(`let ${flag} = false;`));
      }
    }
    // …and the only thing that can raise one is the verified-success
    // discriminant, in whichever form the page reads it (an `if` block, or the
    // `auth.status === "ok" ? auth.ctx : null` ternary the role gates use).
    expect(src).toContain('auth.status === "ok"');
  });

  it.each(DIRECT_GATES)("%s no longer calls /auth/context directly", (page) => {
    // Each of these used to cost its own uncached round-trip on top of the
    // layout's. `readAuthContext` goes through the same React `cache()` as
    // `getAuthContext`, so the page and the shell now share one call.
    expect(read(page)).not.toContain('apiGet<UserContext>("/auth/context")');
  });
});

describe("no gate falls open on a fault", () => {
  it("the engineer console layout renders nothing it could not verify", () => {
    // It used to render `children` on any non-401/403 error. The console
    // carries maintenance mode, the permission editor and the survey kill
    // switch — an unverified render there is a door opened on a guess.
    const src = read("src/app/(app)/engineer/layout.tsx");
    expect(src).toContain('auth.status === "unavailable"');
    expect(src).toContain(
      'const isConfirmedEngineer = auth.status === "ok" && isEngineer(auth.ctx.roles);',
    );
    expect(src).toContain("if (!isConfirmedEngineer) redirect");
    // The old fail-open shape: a catch that only flips the flag on 401/403 and
    // leaves it false (i.e. "allowed") otherwise.
    expect(src).not.toContain("deniedByBackend");
  });

  it("the vocabulary editor starts denied", () => {
    const src = read("src/app/(app)/vocabulary/page.tsx");
    expect(src).toContain("let denied = true;");
    expect(src).toContain('if (auth.status === "ok") {');
  });
});

describe("the gate error screen leaks nothing and shows no icon", () => {
  const COMPONENT = "src/components/shared/AccessCheckError.tsx";

  it("never renders an upstream message", () => {
    const src = read(COMPONENT);
    // Only the status code crosses into the UI — LoadError prints it as a bare
    // "Reference: HTTP nnn". The backend's own text can carry table names and
    // record ids.
    expect(src).not.toMatch(/\{error\??\.message\}/);
    expect(src).toContain("status={status}");
  });

  it("is text-only, per the house rule", () => {
    const src = read(COMPONENT);
    expect(src).not.toContain("lucide-react");
    expect(src).not.toMatch(/<svg/);
  });

  it("takes its styling from the shared component, not a literal hex", () => {
    expect(read(COMPONENT)).not.toMatch(/#[0-9a-fA-F]{6}/);
    expect(read(COMPONENT)).toContain("<LoadError");
  });
});
