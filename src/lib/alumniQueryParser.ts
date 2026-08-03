import { INDUSTRY_OPTIONS } from "@/constants/dropdowns";
import { STATE_NAME_TO_ABBR } from "@/lib/usStates";
import { STATE_NAMES, toFullStateName } from "@/lib/geo/state-field";

/**
 * Lightweight, deterministic natural-language → alumni-filter parser (NO AI).
 *
 * Turns a typed phrase like
 *   "alumni near Las Vegas that work in investment banking"
 * into a deep-link the alumni list already understands
 *   /alumni?industry=Investment+Banking&near=Las+Vegas
 *
 * The phrasings it understands:
 *   "Gilbert, Arizona" / "Provo, UT"      → city + state (no preposition needed)
 *   "alumni in Gilbert"                   → city
 *   "alumni in Arizona"                   → state
 *   "near Los Angeles, California"        → near (backend geocodes it)
 *   "within 50 miles of Seattle"          → near + radius
 *   "Bay Area" / "Greater Seattle area"   → near
 *   "…that work in investment banking"    → industry
 *   "mentors" / "willing to mentor"       → mentor intent
 *   "recent grads" / "last 5 years"       → graduation-year window
 *
 * It only recognizes the known facets (industries from INDUSTRY_OPTIONS, US
 * states/cities, and a few intents). Anything it can't structure falls back to
 * a plain name search (?q=…). This is a heuristic, not language understanding —
 * deliberately conservative so it never sends a junk filter.
 */

const THIS_YEAR = new Date().getFullYear();

/** Common shorthands → canonical INDUSTRY_OPTIONS values. */
const INDUSTRY_ALIASES: Record<string, string> = {
  ib: "Investment Banking",
  "i-banking": "Investment Banking",
  "investment bank": "Investment Banking",
  pe: "Private Equity",
  vc: "Venture Capital",
  "venture cap": "Venture Capital",
  am: "Asset Management",
  "asset mgmt": "Asset Management",
  wealth: "Wealth Management",
  "equity research": "Equity Research",
  consulting: "Consulting",
  "real estate": "Real Estate",
};

/**
 * USPS state names → 2-letter codes. Shared with the alumni list's State-column
 * abbreviation so there's one canonical map (50 states + DC + territories).
 */
const STATE_NAME_TO_CODE = STATE_NAME_TO_ABBR;

/**
 * State names, LONGEST FIRST. Order matters: matched in map order, "west
 * virginia" would be read as "virginia" (VA) and "washington dc" as
 * "washington" (WA), because the shorter name is a substring of the longer one.
 */
const STATE_NAMES_LONGEST_FIRST = Object.entries(STATE_NAME_TO_CODE).sort(
  (a, b) => b[0].length - a[0].length,
);

/** Every USPS code we accept in the "<City>, ST" form. */
const STATE_CODES = new Set(Object.values(STATE_NAME_TO_CODE));

/**
 * The stored spelling for a state token (full name or USPS code), or null when
 * it isn't a state at all.
 *
 * The alumni list matches `state` against `current_employment.current_state`
 * with a literal case-insensitive LIKE — there is NO abbreviation expansion
 * server-side — and that column stores full names ("Arizona", "Utah",
 * "District of Columbia"). Emitting a code therefore produced a filter that
 * matched nothing: `?state=AZ` returned 0 alumni while `?state=Arizona`
 * returned 17. That is the empty page Tanya hit on "Gilbert, Arizona" even
 * after city/state extraction was fixed (#585) — the parse was right and the
 * search was still empty.
 *
 * `toFullStateName` is the app's existing canonical resolver (it mirrors
 * `to_full_name` in fa-web-api/app/core/us_states.py), so this deliberately
 * reuses it rather than deriving a second name table that could drift from the
 * one the state combobox and the backend already agree on.
 */
function canonicalStateName(token: string): string | null {
  const t = token.trim().toLowerCase();
  // Resolve through the CODE first, because the alias map carries spellings the
  // canonical list doesn't ("washington dc", "d.c." -> DC -> "District of
  // Columbia"). A bare 2-letter token is already a code.
  const code = STATE_NAME_TO_CODE[t] ?? (t.length === 2 ? t.toUpperCase() : null);
  const full = toFullStateName(code ?? token);
  return full && STATE_NAMES.includes(full) ? full : null;
}

/**
 * Words that look like a captured "place" but aren't — never set as a city.
 *
 * Covers the lead-in people actually type ("find me all alumni in …") plus the
 * connective tissue around a place, so none of it leaks into the city filter.
 * Deliberately excludes anything that is also a real city word — "new" (New
 * York), "lake", "city", "saint", "fort", "north"… — since these are matched
 * word-by-word.
 */
const NOT_A_CITY = new Set([
  "the", "a", "an", "this", "that", "alumni", "someone", "anyone", "people",
  "finance", "banking", "tech", "industry", "work", "working",
  // Lead-in / filler.
  "find", "show", "list", "search", "get", "give", "look", "looking", "up",
  "me", "my", "us", "our", "all", "any", "some", "every", "everyone", "please",
  "there", "who", "whom", "which", "are", "is", "was", "were", "and", "or",
  // Stray prepositions left behind by a half-typed phrase ("alumni in, Utah").
  "in", "at", "on", "to", "for", "with", "from", "near", "by",
  // Describing the person, not the place.
  "alum", "alums", "alumnus", "alumna", "grad", "grads", "graduate",
  "graduates", "graduated", "student", "students", "folks", "guys",
  "currently", "still", "live", "lives", "living", "based", "located",
  "employed", "works", "worked", "mentor", "mentors",
]);

function titleCase(s: string): string {
  return s
    .split(/\s+/)
    .map((w) => (w ? w[0].toUpperCase() + w.slice(1) : w))
    .join(" ");
}

/** Trim a captured place phrase: drop any trailing clause ("…that work in …"),
 *  surrounding punctuation, and collapse whitespace. Keeps a trailing state
 *  ("Los Angeles, California") so the backend geocoder has the full context. */
function cleanPlace(s: string): string {
  const cut = s
    .trim()
    .split(/\s+(?:that|who|whom|which|working|works?|employed|and|with|in)\b/i)[0];
  return cut.replace(/^[\s,.;]+|[\s,.;]+$/g, "").replace(/\s+/g, " ").trim();
}

/**
 * Reduce a captured phrase to a bare city name, or null when what's left isn't
 * one (#585).
 *
 * Everything up to the LAST location preposition is lead-in, not the place —
 * "find me all alumni in gilbert" is the city "Gilbert", not "me all alumni in
 * Gilbert" and not "all". What survives is then stripped of filler words and
 * capped at three words, because a longer phrase is almost never a city and a
 * junk city filter silently returns nothing.
 */
function cleanCity(phrase: string): string | null {
  let s = phrase
    .toLowerCase()
    .replace(/[^a-z .'-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  const leadIn = s.match(/^.*\b(?:based in|located in|living in|lives? in|from|in|at)\s+/);
  if (leadIn) s = s.slice(leadIn[0].length);

  const words = s.split(" ").filter(Boolean);
  while (words.length && NOT_A_CITY.has(words[0])) words.shift();
  while (words.length && NOT_A_CITY.has(words[words.length - 1])) words.pop();
  if (!words.length || words.length > 3) return null;
  if (words.some((w) => NOT_A_CITY.has(w))) return null;

  return titleCase(words.join(" "));
}

/** A comma followed by a state — the full name ("…, arizona") or a USPS code
 *  ("…, az"). Names are longest-first; the 2-letter fallback is validated
 *  against STATE_CODES, and `(?![a-z])` keeps it from biting off the front of a
 *  longer word ("gunnell, jake"). */
const CITY_STATE_RE = new RegExp(
  `,\\s*(${[
    ...STATE_NAMES_LONGEST_FIRST.map(([name]) => name.replace(/\./g, "\\.")),
    "[a-z]{2}",
  ].join("|")})(?![a-z])`,
);

/**
 * The "<City>, <State>" form — the single most natural way to type a location,
 * and the one #585 was dropping on the floor (city and state were mutually
 * exclusive, and the state won, so "Gilbert, Arizona" searched all of Arizona).
 *
 * The comma is a strong enough signal that no preposition is needed: a bare
 * "Gilbert, Arizona" parses. Returns the span it matched so the caller can cut
 * it out of the remaining text.
 */
function matchCityState(
  text: string,
): { city: string | null; state: string; from: number; to: number } | null {
  const m = CITY_STATE_RE.exec(text);
  if (!m) return null;

  const token = m[1];
  const name = canonicalStateName(token);
  if (!name) return null;

  return {
    city: cleanCity(text.slice(0, m.index)),
    state: name,
    from: m.index,
    to: m.index + m[0].length,
  };
}

/**
 * Location / radius intent detector for the plain-English search box (#358).
 * Recognizes the fuzzy, geocode-worthy phrasings the deterministic city/state
 * matcher can't ("Bay Area", "Greater Seattle area", "within 50 miles of
 * Seattle", "near Los Angeles, California") and hands the raw place text to the
 * backend, which owns the geocoding + radius search. Returns the place phrase
 * (and an optional radius in miles) or null when nothing location-like matched.
 */
function detectLocation(text: string): { near: string; radius?: string } | null {
  // "within 50 miles of Seattle" / "within 25 mi from Provo"
  let m = text.match(/\bwithin\s+(\d{1,4})\s*(?:mi|mile|miles)\s+(?:of|from)\s+(.+)/i);
  if (m) return { near: cleanPlace(m[2]), radius: m[1] };

  // "near / around / close to <place>"
  m = text.match(/\b(?:near|nearby|around|close to|closest to)\s+(.+)/i);
  if (m) return { near: cleanPlace(m[1]) };

  // Metro nicknames: "Bay Area", "Greater Seattle area", "greater NYC area".
  m = text.match(/\b((?:greater\s+)?[a-z][a-z .'-]*?\s+area)\b/i);
  if (m) return { near: cleanPlace(m[1]) };

  return null;
}

export function parseAlumniQuery(raw: string): string {
  const original = raw.trim();
  if (!original) return "/alumni";

  // Pad with spaces so \b-style word checks at the ends behave.
  let text = ` ${original.toLowerCase()} `;
  const params = new URLSearchParams();
  let structured = false;

  // 1) Industry — try full option names first (longest first to prefer the most
  //    specific), then shorthand aliases. Remove the match so it can't be
  //    mistaken for a city later ("...work in investment banking").
  const industries = [...INDUSTRY_OPTIONS]
    .filter((o) => o !== "Other")
    .sort((a, b) => b.length - a.length);
  for (const ind of industries) {
    const needle = ind.toLowerCase();
    if (text.includes(needle)) {
      params.set("industry", ind);
      text = text.replace(needle, " ");
      structured = true;
      break;
    }
  }
  if (!params.has("industry")) {
    for (const [alias, ind] of Object.entries(INDUSTRY_ALIASES)) {
      const re = new RegExp(`\\b${alias.replace(/[.\-]/g, "\\$&")}\\b`);
      if (re.test(text)) {
        params.set("industry", ind);
        text = text.replace(re, " ");
        structured = true;
        break;
      }
    }
  }

  // 2) Location — first try the fuzzy/radius phrasings and hand them to the
  //    backend geocoder via `near` (+ optional `radius`). Runs on the ORIGINAL
  //    text so the place keeps its real casing for display.
  const loc = detectLocation(original);
  if (loc && loc.near && !NOT_A_CITY.has(loc.near.toLowerCase())) {
    params.set("near", loc.near);
    if (loc.radius) params.set("radius", loc.radius);
    text = text.replace(loc.near.toLowerCase(), " ");
    structured = true;
  } else {
    // 2b) "<City>, <State>" — sets BOTH facets. City and state are independent
    //     filters, so "Gilbert, Arizona" must narrow to Gilbert rather than
    //     collapse to every alum in Arizona (#585).
    const cityState = matchCityState(text);
    if (cityState) {
      if (cityState.city) params.set("city", cityState.city);
      params.set("state", cityState.state);
      // Cut the ", <state>" span first — removing the city would shift it.
      text = `${text.slice(0, cityState.from)} ${text.slice(cityState.to)}`;
      if (cityState.city) text = text.replace(cityState.city.toLowerCase(), " ");
      structured = true;
    }

    // 2c) State — match a full state name (word-boundary), remove on hit.
    if (!params.has("state")) {
      for (const [name] of STATE_NAMES_LONGEST_FIRST) {
        const re = new RegExp(`\\b${name.replace(/\./g, "\\.")}\\b`);
        if (re.test(text)) {
          // The stored spelling, not the code — see CODE_TO_STATE_NAME.
          params.set("state", canonicalStateName(name) ?? name);
          text = text.replace(re, " ");
          structured = true;
          break;
        }
      }
    }

    // 3) City — "in|from|based in … <place>" up to a stop word/end. Runs even
    //    when a state matched: both can be true at once ("in Gilbert Arizona").
    if (!params.has("city")) {
      const m = text.match(
        /\b(?:based in|located in|living in|from|in)\s+([a-z][a-z .'-]*?)(?=\s*[,.]|\s+(?:that|who|whom|which|working|works|work|employed|and|with|in|near)|\s*$)/,
      );
      if (m) {
        const city = cleanCity(m[1]);
        if (city) {
          params.set("city", city);
          structured = true;
        }
      }
    }
  }

  // 4) Intents.
  if (/\bmentors?\b|willing to mentor/.test(text)) {
    params.set("mentor", "1");
    structured = true;
  }
  if (/\b(recent grad\w*|recently graduat\w*|new grad\w*)\b|last 5 years/.test(text)) {
    params.set("ymin", String(THIS_YEAR - 5));
    params.set("ymax", String(THIS_YEAR));
    structured = true;
  }

  // 5) Nothing structured → plain name/keyword search on the whole phrase.
  if (!structured) params.set("q", original);

  return `/alumni?${params.toString()}`;
}
