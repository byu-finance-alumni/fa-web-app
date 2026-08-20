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

// --------------------------------------------------------- the collapsed panel --
//
// The same table also sits at the top of /engineer/login-failures, collapsed,
// because that is the page the owner actually opens when he goes looking. It is
// the SAME component and the SAME fetch as the Maintenance page — one
// implementation, so the two screens cannot drift into disagreeing about what an
// attack was.
//
// WHY THE OPEN/CLOSED STATE LIVES IN THE URL rather than in `useState` or a
// `<details>` element. Three things fall out of it that are worth more than the
// client-side animation we give up:
//
//   1. Collapsed is the default because the parameter is ABSENT, which is a
//      state no future refactor can accidentally invert — there is no initial
//      value to mistype. `isAttackPanelOpen` is the whole gate and it is pure.
//   2. The fetch is genuinely lazy. The page only calls the endpoint when the
//      panel is open, so simply visiting the login-failures list does not spend
//      an API round trip — or write an audit row — for a panel nobody opened.
//      A `<details>` element would render (and therefore fetch) regardless.
//   3. An expanded panel is linkable. During an incident "look at this" is a
//      URL you can paste, which is the entire reason this page gets opened.
//
// The cost is a server round trip to expand, which on an engineer console that
// already paginates by link is the pattern the page uses everywhere else.

/** The query parameter carrying the panel state. */
export const ATTACK_PANEL_PARAM = "attacks";

/** The only value that opens it. See `isAttackPanelOpen`. */
export const ATTACK_PANEL_OPEN_VALUE = "1";

/**
 * Is the summary panel open?
 *
 * Deliberately strict: ONLY the exact opt-in value opens it. Absent, empty,
 * "0", "false", "true", or anything a stray link picked up all mean collapsed.
 * Collapsed is the default and this is the single place that could change it —
 * so a bug here is a bug in one pure function with a test on it, rather than a
 * page that quietly ships expanded.
 */
export function isAttackPanelOpen(value: string | undefined | null): boolean {
  return value === ATTACK_PANEL_OPEN_VALUE;
}

/**
 * The toggle's href, preserving where the reader was in the attempt list.
 *
 * Losing their page position on expanding a panel would be its own small
 * betrayal — they were on offset 150 for a reason.
 */
export function attackPanelHref(
  basePath: string,
  { open, offset }: { open: boolean; offset: number },
): string {
  const params = new URLSearchParams();
  if (offset > 0) params.set("offset", String(offset));
  if (open) params.set(ATTACK_PANEL_PARAM, ATTACK_PANEL_OPEN_VALUE);
  const query = params.toString();
  return query ? `${basePath}?${query}` : basePath;
}

/**
 * The button copy.
 *
 * He asked for it to be funny. The constraint that outranks funny: someone
 * landing here at 9pm during an incident must not have to work out what the
 * button does. So the joke is carried by a phrase that is also a literally
 * accurate description of credential guessing — somebody is going down the row
 * trying the handle on every door — and the plain-English subtitle underneath
 * says exactly what the panel contains, with no joke in it at all.
 *
 * Kept as constants rather than inline JSX so the wording is asserted in one
 * place: this is copy that will get swapped, and the test should fail loudly
 * when it is, not silently pass on whatever replaced it.
 */
export const ATTACK_PANEL_SHOW_LABEL = "Show failed sign-ins by source";
export const ATTACK_PANEL_HIDE_LABEL = "Hide failed sign-ins by source";

/** The plain, joke-free line under the button. This one has to be unmissable. */
export const ATTACK_PANEL_DESCRIPTION =
  "Failed sign-ins grouped by source IP — who, from where, how many, and how fast.";

/** The button's label for a given state. */
export function attackPanelLabel(open: boolean): string {
  return open ? ATTACK_PANEL_HIDE_LABEL : ATTACK_PANEL_SHOW_LABEL;
}
