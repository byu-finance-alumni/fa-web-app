import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

import {
  ACTIVITY_PERSIST_INTERVAL_MS,
  CLOCK_SKEW_TOLERANCE_MS,
  LAST_ACTIVITY_STORAGE_KEY,
  clearLastActivity,
  decideIdleOnMount,
  persistActivity,
  readLastActivity,
  writeLastActivity,
  type StorageLike,
} from "./idleSession";

const IDLE_MS = 15 * 60 * 1000;

/** In-memory Storage stand-in that counts writes, so the throttle is testable. */
function fakeStorage(initial?: Record<string, string>) {
  const map = new Map<string, string>(Object.entries(initial ?? {}));
  const calls = { setItem: 0, getItem: 0, removeItem: 0 };
  const storage: StorageLike & { calls: typeof calls; map: typeof map } = {
    calls,
    map,
    getItem(key) {
      calls.getItem += 1;
      return map.get(key) ?? null;
    },
    setItem(key, value) {
      calls.setItem += 1;
      map.set(key, value);
    },
    removeItem(key) {
      calls.removeItem += 1;
      map.delete(key);
    },
  };
  return storage;
}

/** Storage that throws on every operation (private mode / disabled by policy). */
function hostileStorage(): StorageLike {
  return {
    getItem() {
      throw new Error("SecurityError");
    },
    setItem() {
      throw new Error("QuotaExceededError");
    },
    removeItem() {
      throw new Error("SecurityError");
    },
  };
}

describe("decideIdleOnMount (#684)", () => {
  const now = 1_700_000_000_000;

  it("signs out when the stored timestamp is already older than the idle window", () => {
    const stored = String(now - IDLE_MS - 1);
    expect(decideIdleOnMount({ stored, now, idleMs: IDLE_MS })).toEqual({
      action: "sign-out",
      elapsedMs: IDLE_MS + 1,
    });
  });

  it("signs out on the exact boundary — the window has elapsed, so the session ends", () => {
    const stored = String(now - IDLE_MS);
    expect(decideIdleOnMount({ stored, now, idleMs: IDLE_MS }).action).toBe(
      "sign-out",
    );
  });

  it("signs out after a laptop restart hours later (the reported bug)", () => {
    const stored = String(now - 8 * 60 * 60 * 1000);
    expect(decideIdleOnMount({ stored, now, idleMs: IDLE_MS }).action).toBe(
      "sign-out",
    );
  });

  it("does NOT sign out when the stored timestamp is fresh", () => {
    const stored = String(now - 60_000);
    const decision = decideIdleOnMount({ stored, now, idleMs: IDLE_MS });
    expect(decision.action).toBe("arm");
  });

  it("carries the residual window rather than handing out a full one", () => {
    // 14 minutes idle, 15-minute window -> 1 minute left, not 15. Topping the
    // clock back up on every mount is exactly the bypass this fixes.
    const elapsed = 14 * 60 * 1000;
    const decision = decideIdleOnMount({
      stored: String(now - elapsed),
      now,
      idleMs: IDLE_MS,
    });
    expect(decision).toEqual({
      action: "arm",
      remainingMs: 60_000,
      elapsedMs: elapsed,
    });
  });

  it("never returns more remaining time than the in-memory timer would allow", () => {
    for (const elapsed of [0, 1, 1_000, 60_000, IDLE_MS - 1]) {
      const decision = decideIdleOnMount({
        stored: String(now - elapsed),
        now,
        idleMs: IDLE_MS,
      });
      expect(decision.action).toBe("arm");
      if (decision.action !== "arm") continue;
      expect(decision.remainingMs).toBeLessThanOrEqual(IDLE_MS);
      expect(decision.remainingMs).toBeGreaterThan(0);
    }
  });

  it("starts fresh when nothing is stored", () => {
    expect(decideIdleOnMount({ stored: null, now, idleMs: IDLE_MS })).toEqual({
      action: "start-fresh",
      reason: "missing",
    });
    expect(
      decideIdleOnMount({ stored: undefined, now, idleMs: IDLE_MS }),
    ).toEqual({ action: "start-fresh", reason: "missing" });
  });

  it("starts fresh (never signs out) on a corrupt value", () => {
    for (const stored of [
      "",
      "   ",
      "banana",
      "NaN",
      "12abc",
      "Infinity",
      "-Infinity",
      "-1",
      "0",
      "{}",
      '{"at":123}',
    ]) {
      const decision = decideIdleOnMount({ stored, now, idleMs: IDLE_MS });
      expect(decision, `stored=${JSON.stringify(stored)}`).toEqual({
        action: "start-fresh",
        reason: "corrupt",
      });
    }
  });

  it("starts fresh on a future timestamp (clock skew) instead of extending the session", () => {
    const decision = decideIdleOnMount({
      stored: String(now + 24 * 60 * 60 * 1000),
      now,
      idleMs: IDLE_MS,
    });
    // Crucially NOT an "arm" with a remainingMs larger than idleMs, which is
    // what a naive `idleMs - (now - stored)` would produce: that would keep the
    // user signed in for an extra day.
    expect(decision).toEqual({ action: "start-fresh", reason: "future" });
  });

  it("tolerates small forward skew by clamping elapsed to zero", () => {
    const decision = decideIdleOnMount({
      stored: String(now + CLOCK_SKEW_TOLERANCE_MS - 1),
      now,
      idleMs: IDLE_MS,
    });
    expect(decision).toEqual({
      action: "arm",
      remainingMs: IDLE_MS,
      elapsedMs: 0,
    });
  });

  it("never yields a negative elapsed or a remaining window above the cap", () => {
    for (const offset of [-IDLE_MS, -1, 0, 1, CLOCK_SKEW_TOLERANCE_MS]) {
      const decision = decideIdleOnMount({
        stored: String(now + offset),
        now,
        idleMs: IDLE_MS,
      });
      if (decision.action === "arm") {
        expect(decision.elapsedMs).toBeGreaterThanOrEqual(0);
        expect(decision.remainingMs).toBeLessThanOrEqual(IDLE_MS);
      }
    }
  });
});

describe("persistActivity throttle (#684)", () => {
  it("writes the first time and then suppresses writes inside the interval", () => {
    const storage = fakeStorage();
    const t0 = 1_000_000;

    let last = persistActivity(storage, t0, 0);
    expect(storage.calls.setItem).toBe(1);
    expect(last).toBe(t0);

    // A burst of mousemove-shaped calls, one per 100ms for 10 seconds.
    for (let i = 1; i <= 100; i += 1) {
      last = persistActivity(storage, t0 + i * 100, last);
    }
    expect(storage.calls.setItem).toBe(1);
    expect(last).toBe(t0);
  });

  it("writes again once the interval has passed", () => {
    const storage = fakeStorage();
    const t0 = 1_000_000;
    let last = persistActivity(storage, t0, 0);
    last = persistActivity(storage, t0 + ACTIVITY_PERSIST_INTERVAL_MS - 1, last);
    expect(storage.calls.setItem).toBe(1);
    last = persistActivity(storage, t0 + ACTIVITY_PERSIST_INTERVAL_MS, last);
    expect(storage.calls.setItem).toBe(2);
    expect(last).toBe(t0 + ACTIVITY_PERSIST_INTERVAL_MS);
    expect(storage.map.get(LAST_ACTIVITY_STORAGE_KEY)).toBe(
      String(t0 + ACTIVITY_PERSIST_INTERVAL_MS),
    );
  });

  it("caps a busy hour of activity at four writes per minute", () => {
    const storage = fakeStorage();
    const t0 = 1_000_000;
    let last = 0;
    // One call per second for an hour — what the component's 1/sec activity
    // gate would feed it.
    for (let s = 0; s < 3600; s += 1) {
      last = persistActivity(storage, t0 + s * 1000, last);
    }
    expect(storage.calls.setItem).toBe(
      Math.ceil((3600 * 1000) / ACTIVITY_PERSIST_INTERVAL_MS),
    );
  });

  it("writes through when the clock jumps backwards instead of stalling forever", () => {
    const storage = fakeStorage();
    const t0 = 1_000_000;
    const last = persistActivity(storage, t0, 0);
    // Clock moved back an hour; the gap is negative, which must not read as
    // "just written".
    const next = persistActivity(storage, t0 - 3_600_000, last);
    expect(storage.calls.setItem).toBe(2);
    expect(next).toBe(t0 - 3_600_000);
  });
});

describe("storage access is always safe (#684)", () => {
  it("read/write/clear are no-ops when storage is null", () => {
    expect(readLastActivity(null)).toBeNull();
    expect(() => writeLastActivity(null, Date.now())).not.toThrow();
    expect(() => clearLastActivity(null)).not.toThrow();
    expect(persistActivity(null, 1000, 0)).toBe(1000);
  });

  it("swallows a storage implementation that throws", () => {
    const storage = hostileStorage();
    expect(readLastActivity(storage)).toBeNull();
    expect(() => writeLastActivity(storage, Date.now())).not.toThrow();
    expect(() => clearLastActivity(storage)).not.toThrow();
  });

  it("an unreadable store degrades to start-fresh, never to a sign-out", () => {
    const decision = decideIdleOnMount({
      stored: readLastActivity(hostileStorage()),
      now: Date.now(),
      idleMs: IDLE_MS,
    });
    expect(decision).toEqual({ action: "start-fresh", reason: "missing" });
  });

  it("round-trips through a real storage shape", () => {
    const storage = fakeStorage();
    writeLastActivity(storage, 1234);
    expect(readLastActivity(storage)).toBe("1234");
    clearLastActivity(storage);
    expect(readLastActivity(storage)).toBeNull();
  });
});

/**
 * Source-level guards. The wiring is what makes the persistence real; a future
 * edit that drops the mount check or the clear-on-sign-out would silently
 * restore the bypass without failing any behavioural test.
 */
function read(relPath: string): string {
  return readFileSync(resolve(process.cwd(), relPath), "utf8");
}

describe("SessionTimeout wiring invariants (#684)", () => {
  const src = read("src/components/auth/SessionTimeout.tsx");

  it("decides from the persisted timestamp on mount", () => {
    expect(src).toContain("decideIdleOnMount(");
    expect(src).toContain("readLastActivity(storage)");
  });

  it("signs out when the mount decision says the window already elapsed", () => {
    expect(src).toMatch(/decision\.action === "sign-out"[\s\S]{0,120}signOut\(\)/);
  });

  it("persists activity through the throttled helper, not a raw setItem", () => {
    expect(src).toContain("persistActivity(storage, now, lastPersistedAt)");
    expect(src).not.toContain("localStorage.setItem");
  });

  it("clears the stored timestamp on sign-out", () => {
    expect(src).toContain("clearLastActivity(storage)");
  });

  it("still synchronizes across tabs over BroadcastChannel", () => {
    // Persistence is IN ADDITION to the cross-tab channel, not a replacement.
    expect(src).toContain('new BroadcastChannel("fa-session")');
    expect(src).toContain('channel?.postMessage({ t: "active" })');
  });
});

describe("sign-out paths clear the persisted timestamp (#684)", () => {
  it.each([
    ["src/components/auth/SignOutButton.tsx"],
    ["src/components/auth/SessionGuard.tsx"],
  ])("%s clears it", (path) => {
    expect(read(path)).toContain("clearLastActivity(");
  });

  it("the login form stamps it so a stale value can't bounce a fresh login", () => {
    expect(read("src/components/auth/LoginForm.tsx")).toContain(
      "writeLastActivity(getActivityStorage(), Date.now())",
    );
  });
});
