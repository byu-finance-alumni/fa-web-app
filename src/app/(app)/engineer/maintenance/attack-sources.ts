/**
 * Presentation logic for the Maintenance page's failed-attack table.
 *
 * Split out from the JSX so it can be unit-tested: every function here is pure
 * and takes plain data, and the assertions that matter (a 16-second burst does
 * not read like a 10-minute grind; a source with no geo does not get an invented
 * location) are cheap to write against strings and impossible to write against a
 * rendered server component in this suite.
 */

/**
 * ⚠️ TEMPORARY LOCAL TYPES — REPLACE WITH THE GENERATED ONES.
 *
 * These mirror `LoginAttackSource` / `LoginAttackSourcePage` from
 * GET /admin/login-attack-sources. They are hand-written ONLY because the
 * backend endpoint has not reached dev yet, so `src/types/api.gen.ts` does not
 * describe it. Once it lands, run `npm run gen:api-types` and swap both of these
 * for the generated shapes, exactly as the Login-failures tab does:
 *
 *   export type LoginAttackSourcePage =
 *     components["schemas"]["LoginAttackSourcePage"];
 *   export type LoginAttackSource = LoginAttackSourcePage["items"][number];
 *
 * Until then the CI drift guard cannot see this contract, so a backend rename
 * would compile here and fail only at runtime. Do not extend it by hand — a
 * field the generator does not produce is a field that will vanish on regen.
 *
 * NOTE WHAT IS DELIBERATELY ABSENT: the attempted email addresses. The endpoint
 * returns `distinct_emails`, the COUNT, and never the addresses themselves —
 * they are unverified strings a stranger typed, some belong to real people, and
 * a list of them is an enumeration oracle. The per-attempt detail, addresses
 * included, lives on /engineer/login-failures behind the same engineer gate.
 */
export type LoginAttackSource = {
  ip_address: string;
  city: string | null;
  region: string | null;
  country: string | null;
  first_seen: string;
  last_seen: string;
  attempts: number;
  distinct_emails: number;
  /**
   * e.g. "spraying: many addresses, a few passwords each" — produced by the same
   * classifier the Slack alert renders, so the table and the alert cannot
   * describe one IP two different ways.
   */
  attack_type: string;
  /** Whether the source crossed the detector's thresholds at all. */
  is_attack: boolean;
};

/** See the warning above — replace with the generated `LoginAttackSourcePage`. */
export type LoginAttackSourcePage = {
  items: LoginAttackSource[];
  window_hours: number;
  limit: number;
};

/**
 * How much history the table shows. A day covers "did something happen
 * overnight" — the question the page gets opened to answer — and is short enough
 * that a week-old probe doesn't sit at the top pretending to be current. The
 * backend caps the parameter at a week.
 */
export const ATTACK_WINDOW_HOURS = 24;

/**
 * Utah time (Mountain), with SECONDS.
 *
 * Every other console formats to the minute, and this is the one screen where
 * that would destroy the information: on 2026-08-19 one source made 222 attempts
 * between 09:25:36 and 09:25:52, which to the minute is "09:25 to 09:25" — a
 * window that reads as a rendering bug rather than as the most aggressive thing
 * in the table. `America/Denver` tracks MST/MDT automatically; the zone is named
 * once in the column header rather than stamped onto every cell, because twelve
 * repetitions of "MDT" in a dense table is noise, not clarity.
 */
export function formatClock(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    timeZone: "America/Denver",
  });
}

/**
 * How long the source was active, in the coarsest unit that still separates the
 * two shapes at a glance.
 *
 * THE POINT OF THIS FUNCTION is that "222 attempts" and "190 attempts" look
 * almost identical until you see that one took sixteen seconds and the other
 * took ten minutes. Seconds below a minute (so the burst reads as a burst),
 * whole minutes below an hour, hours and minutes above. Sub-second and negative
 * spans — one attempt, or clocks that disagree — collapse to "under a second"
 * rather than "0 seconds", which would read as missing data.
 */
export function formatDuration(firstIso: string, lastIso: string): string {
  const from = new Date(firstIso).getTime();
  const to = new Date(lastIso).getTime();
  if (Number.isNaN(from) || Number.isNaN(to)) return "—";

  const seconds = Math.round(Math.max(0, to - from) / 1000);
  if (seconds < 1) return "under a second";
  if (seconds < 60) return `${seconds} sec`;

  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes} min`;

  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return rest ? `${hours} hr ${rest} min` : `${hours} hr`;
}

/** "Seattle, Washington, US" from whatever parts the edge captured, or "—". */
export function formatLocation(source: LoginAttackSource): string {
  const parts = [source.city, source.region, source.country].filter(Boolean);
  return parts.length ? parts.join(", ") : "—";
}

/**
 * Split the backend's classification into a short cell label and the sentence
 * that explains it.
 *
 * The API returns one string — `"spraying: many addresses, a few passwords
 * each"` — because that is what reads correctly in a Slack message. A table cell
 * wants the first word and a line of explanation underneath, so the split
 * happens here rather than by the backend returning two fields: the wording is a
 * presentation choice, and duplicating the vocabulary across the two surfaces is
 * exactly how the alert and the table would come to disagree.
 *
 * Anything without the `label: detail` shape is passed through whole rather than
 * mangled — a future pattern string must never render as an empty cell.
 */
export function splitAttackType(attackType: string): {
  label: string;
  detail: string;
} {
  const at = attackType.indexOf(":");
  if (at === -1) return { label: attackType.trim(), detail: "" };
  return {
    label: attackType.slice(0, at).trim(),
    detail: attackType.slice(at + 1).trim(),
  };
}

/** Capitalise the first letter for the cell, leaving the rest alone. */
export function attackTypeLabel(attackType: string): string {
  const { label } = splitAttackType(attackType);
  return label ? label.charAt(0).toUpperCase() + label.slice(1) : "—";
}

/**
 * The empty state, phrased as the reassurance it usually is.
 *
 * This is what the page shows on a normal day, so it is written to be READ as an
 * answer ("nothing has happened") rather than as an absence of data ("no rows").
 * It names the window because "no failed sign-ins" without one is a claim the
 * page is not making.
 */
export function emptyStateText(windowHours: number): string {
  const window =
    windowHours === 1
      ? "hour"
      : windowHours === 24
        ? "24 hours"
        : `${windowHours} hours`;
  return `No failed sign-in attempts in the last ${window}.`;
}
