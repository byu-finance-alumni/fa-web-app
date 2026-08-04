import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { getMaintenanceStatus } from "./maintenance";

/**
 * Maintenance mode, frontend side.
 *
 * THE PROPERTY THESE TESTS PROTECT is that an engineer can always get back in.
 * Two halves:
 *
 *   1. `getMaintenanceStatus` FAILS OPEN, so a hiccup reading the switch can
 *      never hide the app from anyone (including an engineer on their way to
 *      turn it off).
 *   2. The routes an engineer needs — `/login`, `/maintenance` — stay public,
 *      and the `(app)` layout's maintenance redirect skips engineers. Those are
 *      structural facts about specific files, so they are guarded the same way
 *      `session-invariants.test.ts` guards the session rules: by reading the
 *      source. A refactor that quietly drops the engineer skip fails here.
 */

function read(relPath: string): string {
  return readFileSync(resolve(process.cwd(), relPath), "utf8");
}

// --- getMaintenanceStatus: fail-open ----------------------------------------

describe("getMaintenanceStatus", () => {
  const OLD_URL = process.env.NEXT_PUBLIC_API_URL;

  beforeEach(() => {
    process.env.NEXT_PUBLIC_API_URL = "https://api.example.test";
  });

  afterEach(() => {
    process.env.NEXT_PUBLIC_API_URL = OLD_URL;
    vi.unstubAllGlobals();
  });

  function stubFetch(impl: () => unknown) {
    vi.stubGlobal("fetch", vi.fn(impl));
  }

  it("reports maintenance when the backend explicitly says enabled", async () => {
    stubFetch(() => ({
      ok: true,
      json: async () => ({ enabled: true, message: "Back at 5pm." }),
    }));
    expect(await getMaintenanceStatus()).toEqual({
      enabled: true,
      message: "Back at 5pm.",
    });
  });

  it("reports off when the backend says off", async () => {
    stubFetch(() => ({ ok: true, json: async () => ({ enabled: false }) }));
    expect(await getMaintenanceStatus()).toEqual({
      enabled: false,
      message: null,
    });
  });

  it("falls back to null message so the page uses its own copy", async () => {
    stubFetch(() => ({
      ok: true,
      json: async () => ({ enabled: true, message: "   " }),
    }));
    expect(await getMaintenanceStatus()).toEqual({
      enabled: true,
      message: null,
    });
  });

  // Every one of these must resolve to "site is up". A control that hides the
  // whole application must never be triggered by a failure to read it.
  it("fails open when the request throws", async () => {
    stubFetch(() => {
      throw new Error("network down");
    });
    expect((await getMaintenanceStatus()).enabled).toBe(false);
  });

  it("fails open on a non-OK response", async () => {
    stubFetch(() => ({ ok: false, status: 500, json: async () => ({}) }));
    expect((await getMaintenanceStatus()).enabled).toBe(false);
  });

  it("fails open on an unparseable body", async () => {
    stubFetch(() => ({
      ok: true,
      json: async () => {
        throw new Error("not json");
      },
    }));
    expect((await getMaintenanceStatus()).enabled).toBe(false);
  });

  it.each([undefined, null, "true", 1, {}])(
    "fails open on a non-boolean enabled value (%s)",
    async (enabled) => {
      stubFetch(() => ({ ok: true, json: async () => ({ enabled }) }));
      expect((await getMaintenanceStatus()).enabled).toBe(false);
    },
  );

  it("fails open when the API URL is unset", async () => {
    delete process.env.NEXT_PUBLIC_API_URL;
    stubFetch(() => {
      throw new Error("should not be called");
    });
    expect((await getMaintenanceStatus()).enabled).toBe(false);
  });

  it("never caches, so turning maintenance off is felt immediately", async () => {
    const fetchMock = vi.fn((_url: string, init?: RequestInit) => {
      void _url;
      void init;
      return { ok: true, json: async () => ({ enabled: false }) };
    });
    vi.stubGlobal("fetch", fetchMock);
    await getMaintenanceStatus();
    expect(fetchMock.mock.calls[0]?.[1]).toMatchObject({ cache: "no-store" });
  });
});

// --- Structural guards: the way back in --------------------------------------

describe("maintenance mode leaves a way back in", () => {
  it("keeps /login and /maintenance publicly reachable", () => {
    // /maintenance must be public because maintenance mode signs everyone out.
    // /login must be public because that is how an exempt engineer signs in to
    // turn maintenance off.
    const src = read("src/utils/supabase/middleware.ts");
    expect(src).toContain('const PUBLIC_PATHS = ["/", "/login", "/maintenance"]');
  });

  it("skips the (app) maintenance redirect for engineers", () => {
    // If this check ever loses its engineer guard, an engineer would be bounced
    // to the maintenance page and could never reach the console to turn it off.
    const src = read("src/app/(app)/layout.tsx");
    expect(src).toContain(
      "if (!userIsEngineer && (await getMaintenanceStatus()).enabled)",
    );
    expect(src).toContain('redirect("/maintenance")');
  });

  it("exposes the maintenance console on the engineer home", () => {
    const src = read("src/app/(app)/engineer/page.tsx");
    expect(src).toContain('href: "/engineer/maintenance"');
  });

  it("the maintenance page links to sign-in rather than dead-ending", () => {
    const src = read("src/app/maintenance/page.tsx");
    expect(src).toContain('href="/login"');
  });

  it("the maintenance page sends visitors back once maintenance ends", () => {
    const src = read("src/app/maintenance/page.tsx");
    expect(src).toContain("if (!status.enabled) redirect(");
  });
});

describe("maintenance mode UI conventions", () => {
  const CONTROL = "src/components/engineer/MaintenanceModeControl.tsx";

  it("requires typing a confirm word before signing everyone out", () => {
    const src = read(CONTROL);
    expect(src).toContain('const CONFIRM_WORD = "MAINTENANCE"');
    // The ON path is two-step; the arming button stays disabled until it matches.
    expect(src).toContain("disabled={!matches || pending}");
  });

  it("keeps turning maintenance OFF to a single light confirm", () => {
    // The recovery direction must not be as ceremonious as the destructive one:
    // the OFF dialog has no type-to-confirm field at all.
    const src = read(CONTROL);
    const offDialog = src.slice(
      src.indexOf('id="maint-off-title"'),
      src.indexOf('id="maint-on-title"'),
    );
    expect(offDialog.length).toBeGreaterThan(0);
    expect(offDialog).not.toContain("CONFIRM_WORD");
    expect(offDialog).not.toContain("<Input");
    expect(offDialog).toContain("Turn off maintenance mode");
  });

  it("uses no icons, per the engineer console convention", () => {
    const src = read(CONTROL);
    expect(src).not.toContain("lucide-react");
  });

  it("does not hand-edit the generated API types", () => {
    // The maintenance endpoints are new, so their types are declared locally
    // until api.gen.ts is regenerated. Guard that nobody added them by hand.
    const generated = read("src/types/api.gen.ts");
    expect(generated).not.toContain("MaintenanceEnableRequest");
  });
});

describe("the login flow surfaces a maintenance refusal", () => {
  const SRC = "src/app/login/actions.ts";

  it("undoes the Supabase sign-in when the backend refuses for maintenance", () => {
    // Without the signOut the user would keep auth cookies for an account the
    // API rejects on every request — a session that looks valid and works for
    // nothing.
    const src = read(SRC);
    expect(src).toContain('body?.error?.code === "maintenance_mode"');
    expect(src).toContain("await supabase.auth.signOut()");
  });

  it("checks maintenance AFTER authentication, not in the public precheck", () => {
    // The refusal is role-aware (engineers are exempt), which the unauthenticated
    // precheck cannot be. Checking there would either lock engineers out or leak
    // role information to an anonymous caller.
    const src = read(SRC);
    const precheck = src.slice(
      src.indexOf("async function loginPrecheckAllowed"),
      src.indexOf("async function readLoginContext"),
    );
    expect(precheck).not.toContain("maintenance");
  });
});
