import { INDUSTRY_OPTIONS } from "@/constants/dropdowns";

/**
 * Lightweight, deterministic natural-language → alumni-filter parser (NO AI).
 *
 * Turns a typed phrase like
 *   "alumni near Las Vegas that work in investment banking"
 * into a deep-link the alumni list already understands
 *   /alumni?industry=Investment+Banking&city=Las+Vegas
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

/** USPS state names → 2-letter codes (all 50 + DC). Keys are lowercase. */
const STATE_NAME_TO_CODE: Record<string, string> = {
  alabama: "AL", alaska: "AK", arizona: "AZ", arkansas: "AR", california: "CA",
  colorado: "CO", connecticut: "CT", delaware: "DE", florida: "FL", georgia: "GA",
  hawaii: "HI", idaho: "ID", illinois: "IL", indiana: "IN", iowa: "IA",
  kansas: "KS", kentucky: "KY", louisiana: "LA", maine: "ME", maryland: "MD",
  massachusetts: "MA", michigan: "MI", minnesota: "MN", mississippi: "MS",
  missouri: "MO", montana: "MT", nebraska: "NE", nevada: "NV",
  "new hampshire": "NH", "new jersey": "NJ", "new mexico": "NM", "new york": "NY",
  "north carolina": "NC", "north dakota": "ND", ohio: "OH", oklahoma: "OK",
  oregon: "OR", pennsylvania: "PA", "rhode island": "RI", "south carolina": "SC",
  "south dakota": "SD", tennessee: "TN", texas: "TX", utah: "UT", vermont: "VT",
  virginia: "VA", "west virginia": "WV", wisconsin: "WI", wyoming: "WY",
  "washington dc": "DC", "washington d.c.": "DC", "d.c.": "DC",
};

/** Words that look like a captured "place" but aren't — never set as a city. */
const NOT_A_CITY = new Set([
  "the", "a", "an", "this", "that", "alumni", "someone", "anyone", "people",
  "finance", "banking", "tech", "industry", "work", "working",
]);

function titleCase(s: string): string {
  return s
    .split(/\s+/)
    .map((w) => (w ? w[0].toUpperCase() + w.slice(1) : w))
    .join(" ");
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

  // 2) State — match a full state name (word-boundary), remove on hit.
  for (const [name, code] of Object.entries(STATE_NAME_TO_CODE)) {
    const re = new RegExp(`\\b${name.replace(/\./g, "\\.")}\\b`);
    if (re.test(text)) {
      params.set("state", code);
      text = text.replace(re, " ");
      structured = true;
      break;
    }
  }

  // 3) City — "near|in|around|from|based in … <place>" up to a stop word/end.
  if (!params.has("state") && !params.has("city")) {
    const m = text.match(
      /\b(?:near|around|based in|located in|living in|from|in)\s+([a-z][a-z .'-]*?)(?=\s+(?:that|who|whom|which|working|works|work|employed|and|with|in|near|,|\.)|\s*$)/,
    );
    if (m) {
      const place = m[1].trim();
      const words = place.split(/\s+/);
      if (place && words.length <= 3 && !NOT_A_CITY.has(place)) {
        params.set("city", titleCase(place));
        structured = true;
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
