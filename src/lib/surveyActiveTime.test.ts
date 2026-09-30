import { describe, expect, it } from "vitest";

import { ActiveTimer } from "./surveyActiveTime";

/**
 * The active-time accounting behind the survey's median time-to-complete.
 *
 * Only the pure `ActiveTimer` is exercised here (the suite runs in Node with no
 * DOM — see vitest.config.ts); the `useActiveTimer` hook is a thin wrapper that
 * calls `start`/`pause` from `visibilitychange`, which is exactly what these
 * assertions pin. The clock is injected so time can be driven deterministically.
 */

function fakeClock(start = 0) {
  const state = { t: start };
  return { now: () => state.t, advance: (ms: number) => (state.t += ms) };
}

describe("ActiveTimer", () => {
  it("accumulates only the time between start and pause", () => {
    const clock = fakeClock(1000);
    const timer = new ActiveTimer(clock.now);
    timer.start();
    clock.advance(30_000);
    timer.pause();
    expect(timer.elapsedSeconds()).toBe(30);
  });

  it("does NOT count time while paused (tab hidden over lunch)", () => {
    const clock = fakeClock();
    const timer = new ActiveTimer(clock.now);
    timer.start();
    clock.advance(20_000); // reading — visible
    timer.pause();
    clock.advance(3_600_000); // an hour hidden
    timer.start();
    clock.advance(10_000); // came back — visible
    timer.pause();
    // 20s + 10s of active time; the hidden hour is not counted.
    expect(timer.elapsedSeconds()).toBe(30);
  });

  it("counts the currently-running interval when read without pausing", () => {
    const clock = fakeClock();
    const timer = new ActiveTimer(clock.now);
    timer.start();
    clock.advance(45_000);
    // Read at submit without a pause first — the live interval is included.
    expect(timer.elapsedSeconds()).toBe(45);
  });

  it("is idempotent: a double start does not reset the running interval", () => {
    const clock = fakeClock();
    const timer = new ActiveTimer(clock.now);
    timer.start();
    clock.advance(10_000);
    timer.start(); // resume while already running — no-op
    clock.advance(5_000);
    expect(timer.elapsedSeconds()).toBe(15);
  });

  it("banks nothing extra on a pause while already paused", () => {
    const clock = fakeClock();
    const timer = new ActiveTimer(clock.now);
    timer.start();
    clock.advance(12_000);
    timer.pause();
    timer.pause(); // second pause — no-op
    clock.advance(9_000);
    expect(timer.elapsedSeconds()).toBe(12);
  });

  it("never banks negative time when the clock jumps backwards", () => {
    const clock = fakeClock(100_000);
    const timer = new ActiveTimer(clock.now);
    timer.start();
    clock.advance(-50_000); // NTP correction / manual clock change
    timer.pause();
    expect(timer.elapsedSeconds()).toBe(0);
  });

  it("reads as zero before it is ever started", () => {
    const timer = new ActiveTimer(fakeClock().now);
    expect(timer.elapsedSeconds()).toBe(0);
  });

  it("rounds to whole seconds", () => {
    const clock = fakeClock();
    const timer = new ActiveTimer(clock.now);
    timer.start();
    clock.advance(1_600); // 1.6s -> 2
    expect(timer.elapsedSeconds()).toBe(2);
  });
});
